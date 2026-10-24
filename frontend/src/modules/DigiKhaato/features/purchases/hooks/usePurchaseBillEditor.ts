'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useSearchParams } from 'next/navigation';

import { useForm, useWatch, type UseFormReturn } from 'react-hook-form';
import { useStore } from 'react-redux';
import { ValidationError } from 'yup';

import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { useDraftSaveQueue } from 'src/hooks/useDraftSaveQueue';
import { useIdempotencyKey } from 'src/hooks/useIdempotencyKey';
import { usePartyEditorSeed } from 'src/hooks/usePartyEditorSeed';
import { usePermissions } from 'src/hooks/usePermissions';
import { useReviewedRepeat } from 'src/hooks/useReviewedRepeat';
import { useTranslation } from 'src/hooks/useTranslation';
import { cacheInvalidated } from 'src/redux/invalidation/listener';
import { INVALIDATION } from 'src/redux/invalidation/map';
import { selectNetworkImpaired } from 'src/redux/slice/networkSlice';
import {
  selectActiveTenant,
  selectSessionUser,
  selectTenantTimezone,
} from 'src/redux/slice/sessionSlice';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import type { RootState } from 'src/redux/store';
import { readOrderItems } from 'src/routes';
import { applyServerErrors } from 'src/utils/applyServerErrors';
import { todayInTenantTz } from 'src/utils/dates';
import { draftReplyOutcome, draftSnapshot, settleAutosave } from 'src/utils/draftCreation';
import { formQty } from 'src/utils/quantity';
import { newRequestId } from 'src/utils/requestId';
import { mayHaveBeenSaved } from 'src/utils/requestKey';

import { computeDocumentTotals, type EngineResult } from '../../sales/view-model/taxEngine';
import { getPurchaseBill } from '../api/purchaseBillService';
import { PURCHASE_AUTOSAVE_MS } from '../constants/purchaseConstants';
import {
  purchaseDraftReply,
  purchaseEditorReset,
  purchaseRecordRecovered,
  selectPurchaseBillEditor,
  type PurchaseBillEditorState,
} from '../redux/purchaseBillEditorSlice';
import {
  checkDuplicateSupplierInvoice,
  fetchPurchaseBill,
  fetchPurchaseContext,
  movePurchaseOrder,
  recordPurchaseBill,
  savePurchaseBillDraft,
  type SavePurchaseDraftArg,
  type RecordPurchaseBillArg,
} from '../redux/purchaseBillThunk';
import { usePurchaseBillSchemas } from '../validation/purchaseBillSchemas';
import {
  emptyPurchaseForm,
  emptyPurchaseLine,
  fromPurchaseBill,
  isCompletePurchaseLine,
  hasIncompletePurchaseInput,
  purchasePaymentWireBody,
  purchaseLineFromItem,
  purchasePreviewInput,
  purchaseWireSnapshot,
  toPurchaseWireBody,
  type PurchaseBillFormValues,
  type PurchasePaymentRow,
} from '../view-model/purchaseBillForm';

import type { PurchaseBillEnvelope, PurchaseKind } from '../types/purchase.types';

/** The fields `applyServerErrors` may anchor a server 400 on. */
const FORM_FIELDS: readonly string[] = [
  'partyId',
  'supplierInvoiceNumber',
  'supplierInvoiceDate',
  'documentDate',
  'dueOn',
  'discountValue',
  'notes',
  'lines',
];

/**
 * PUR-01 — the purchase bill editor's orchestrator, the shape of the invoice
 * editor's `useInvoiceEditor`. React Hook Form owns what the merchant types;
 * `purchaseBillEditorSlice` owns what the server says. The preview is the
 * shared GST engine over the form, replaced by the server's figures the moment
 * a save returns — and at Record the server recomputes everything (§0.11-3).
 *
 * FR-8 autosave lives here too: 10 s after the last change, while the form is
 * dirty and the bill means something (a supplier or a complete line), the
 * draft is PATCHed quietly; the header shows the state.
 *
 * SH-011 / ADR-063 — every save (autosave, supplier pick, "Save draft", the
 * save before Record) runs in ONE queue, and the first create carries a
 * creation key kept for this editor session, so a retry after a lost reply
 * finds the same draft instead of making a second. The key lives in memory
 * only: this editor keeps no device copy, so a reload starts a new bill; a
 * stored "new" key would let a second tab adopt the first tab's draft.
 */
export interface UsePurchaseBillEditorResult {
  readonly form: UseFormReturn<PurchaseBillFormValues>;
  /**
   * The form holds the opened draft (or a blank bill), not the defaults it was
   * created with. The draft is reset into the form in an effect AFTER the load
   * succeeds, so a page that renders on the load alone draws one frame of an
   * empty bill: the supplier fold opened itself for a "new" bill on every
   * reopened draft (WP-05, found by measuring).
   */
  readonly seeded: boolean;
  readonly values: PurchaseBillFormValues;
  readonly preview: EngineResult;
  readonly editor: PurchaseBillEditorState;
  readonly today: string;
  readonly canWrite: boolean;
  readonly regular: boolean;
  readonly save: (quiet: boolean) => Promise<PurchaseBillEnvelope | null>;
  /** Record; `payment` is FR-6h's "Paid now" rows, absent or empty for a bill on credit. */
  readonly record: (
    payment?: readonly PurchasePaymentRow[] | null
  ) => Promise<PurchaseBillEnvelope | null>;
  /** The header rules, run before the "Paid now" sheet opens so it never opens on a bad bill. */
  readonly validate: () => Promise<boolean>;
  /** PUR-02 — "Paid now" is a supplier payment: the payments module and its write codename. */
  readonly canPayNow: boolean;
  readonly offline: boolean;
  readonly hasUnsavedChanges: boolean;
  readonly hasServerCopy: boolean;
  /** A Record reply was lost: freeze the intent until its actual outcome is checked. */
  readonly recordRecovery: boolean;
  readonly checkDuplicate: () => void;
  readonly restart: () => void;
}

export const usePurchaseBillEditor = (
  documentId: string | null,
  kind: PurchaseKind = 'purchase_bill'
): UsePurchaseBillEditorResult => {
  const { partyId: initialParty, partyName: initialPartyName } = usePartyEditorSeed();
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const { t } = useTranslation();
  const tenantId = useAppSelector(selectActiveTenant)?.id;
  const userId = useAppSelector(selectSessionUser)?.id;
  const saves = useDraftSaveQueue(tenantId, userId);
  /** The first create's identity, minted on the first save of a new bill. */
  const creationKey = useRef<string | null>(null);
  const editor = useAppSelector(selectPurchaseBillEditor);
  const timezone = useAppSelector(selectTenantTimezone);
  const offline = useAppSelector(selectNetworkImpaired);
  const { can, hasModule } = usePermissions();
  const { purchaseBillSchema, quantityValidation } = usePurchaseBillSchemas();
  const today = useMemo(() => todayInTenantTz(timezone ?? undefined), [timezone]);
  const canWrite = hasModule('purchases') && can('purchases.bill.write');
  const idempotency = useIdempotencyKey();

  const form = useForm<PurchaseBillFormValues>({
    defaultValues: emptyPurchaseForm(today, true),
    mode: 'onTouched',
  });
  const values = useWatch({ control: form.control }) as PurchaseBillFormValues;

  // Seed the form ONCE per editor: from the draft, or from the shop's defaults.
  const seeded = useRef<string | null>(null);
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const scope = `${tenantId}:${userId}:${kind}:${documentId ?? 'new'}`;
  const recordIntent = useRef<{ scope: string; arg: RecordPurchaseBillArg } | null>(null);
  const [uncertainScope, setUncertainScope] = useState<string | null>(null);
  const recordRecovery = uncertainScope === scope;

  const [draftState, setDraftState] = useState<{
    scope: string;
    initial: string;
    acknowledged: string | null;
  } | null>(null);

  // Load: the shop's context always, the draft when editing one. A different
  // document, business or user is a new editor: queued saves are abandoned.
  useEffect(() => {
    saves.invalidate();
    creationKey.current = null;
    recordIntent.current = null;
    seeded.current = null;
    dispatch(purchaseEditorReset());
    const context = dispatch(fetchPurchaseContext(today));
    const draft = documentId ? dispatch(fetchPurchaseBill({ id: documentId, kind })) : null;
    return () => {
      saves.invalidate();
      context.abort();
      draft?.abort();
    };
  }, [dispatch, documentId, today, kind, tenantId, userId, saves]);

  const { context, document } = editor;
  useEffect(() => {
    if (documentId) {
      if (document && document.id === documentId && seeded.current !== documentId) {
        seeded.current = documentId;
        const opened = fromPurchaseBill(document);
        form.reset(opened);
        const snapshot = purchaseWireSnapshot(toPurchaseWireBody(opened));
        setDraftState({ scope, initial: snapshot, acknowledged: snapshot });
        setSeededFor(documentId);
      }
      return;
    }
    if (context && seeded.current !== 'new') {
      recordIntent.current = null;
      setUncertainScope(null);
      seeded.current = 'new';
      const opened = {
        ...emptyPurchaseForm(today, context.gstType === 'regular'),
        partyId: initialParty,
        partyName: initialPartyName,
      };
      form.reset(opened);
      setDraftState({
        scope,
        initial: purchaseWireSnapshot(toPurchaseWireBody(opened)),
        acknowledged: null,
      });
      setSeededFor('new');
    }
  }, [documentId, document, context, form, today, initialParty, initialPartyName, scope]);

  const readRepeat = useCallback(async (id: string, signal: AbortSignal) => {
    const source = await getPurchaseBill(id, signal);
    const previous = fromPurchaseBill(source.bill);
    if (source.bill.kind !== 'purchase_bill' || ['draft', 'void'].includes(source.bill.status))
      throw new Error('Repeat source unavailable');
    return {
      partyId: previous.partyId,
      partyName: previous.partyName,
      partyStateCode: previous.partyStateCode,
      partyCreditDays: previous.partyCreditDays,
      lines: previous.lines,
      notes: previous.notes,
      discountType: previous.discountType,
      discountValue: previous.discountValue,
    };
  }, []);
  useReviewedRepeat({
    ready: !!context && seededFor === 'new',
    documentId,
    form,
    read: readRepeat,
  });
  const repeatId = useSearchParams()?.get('repeat');

  /* 09 §8.7 — "Order" from Low stock opens a new order with its items on it
     (`purchaseOrderForItemsPath`). Each item is fetched, so the line takes the
     item's own unit, tax and (permission allowing) purchase price; the supplier
     is still the merchant's choice. Like a repeat, it seeds a form nobody has
     typed into and never overwrites one somebody has. */
  const orderItems = useSearchParams()?.get('items');
  useEffect(() => {
    const wanted = readOrderItems(orderItems);
    if (!wanted.length || documentId || !context || seededFor !== 'new') return undefined;
    const abort = new AbortController();
    void import('../../inventory/api/itemService')
      .then(({ getItem }) => Promise.all(wanted.map((line) => getItem(line.itemId, abort.signal))))
      .then((items) => {
        if (abort.signal.aborted || form.formState.isDirty) return;
        form.reset({
          ...form.getValues(),
          lines: items.map((item, index) => ({
            ...emptyPurchaseLine(),
            ...purchaseLineFromItem(item),
            qty: formQty(wanted[index]?.qty ?? '1', item.unit.allowDecimal),
          })),
        });
      })
      .catch(() => {
        if (!abort.signal.aborted)
          dispatch(showSnackbar({ severity: 'error', id: 'error.generic' }));
      });
    return () => abort.abort();
  }, [orderItems, documentId, context, seededFor, form, dispatch]);

  // Rates are by the bill's date; a changed date re-reads them.
  const documentDate = values.documentDate;
  useEffect(() => {
    if (!context || !documentDate || context.ratesDate === documentDate) return undefined;
    const promise = dispatch(fetchPurchaseContext(documentDate));
    return () => promise.abort();
  }, [dispatch, context, documentDate]);

  const preview: EngineResult = useMemo(
    () =>
      computeDocumentTotals(
        purchasePreviewInput(values, context?.rates ?? {}, context?.stateCode ?? '')
      ),
    [values, context]
  );

  const { documentId: savedId } = editor;
  const save = useCallback(
    (quiet: boolean): Promise<PurchaseBillEnvelope | null> =>
      saves.enqueue(async (currentScope) => {
        // Read when the task STARTS: an earlier save in the queue may have
        // just created the draft or moved its version.
        const current = selectPurchaseBillEditor(store.getState());
        if (
          recordIntent.current?.scope === scope ||
          current.saveState === 'conflict' ||
          current.recorded ||
          (documentId && current.loadStatus !== 'succeeded')
        )
          return null;
        const send = async (
          arg: Omit<SavePurchaseDraftArg, 'kind' | 'quiet'>
        ): Promise<PurchaseBillEnvelope | null> => {
          const pending = dispatch(savePurchaseBillDraft({ ...arg, kind, quiet }));
          saves.track(pending);
          const result = await pending;
          if (!currentScope()) return null;
          if (savePurchaseBillDraft.fulfilled.match(result)) return result.payload;
          if (!quiet && result.payload?.code === 'validation_error') {
            applyServerErrors(result.payload, form.setError, FORM_FIELDS);
          }
          return null;
        };
        const id = current.documentId ?? documentId;
        const captureRows = () =>
          form
            .getValues('lines')
            .flatMap((line, index) =>
              isCompletePurchaseLine(line)
                ? [{ index, itemId: line.itemId, snapshot: draftSnapshot(line) }]
                : []
            );
        let submittedRows = captureRows();
        let submittedBody = toPurchaseWireBody(form.getValues());
        const body = { ...submittedBody };
        if (!id) {
          creationKey.current ??= newRequestId();
          body.client_draft_key = creationKey.current;
        }
        let result = await send({ id, version: current.version, body });
        if (!result) return null;
        const outcome = draftReplyOutcome(purchaseDraftReply(result));
        if (outcome === 'adopt') {
          // The retry only looked the draft up. Save today's typing explicitly
          // against version 1, so an edit made elsewhere still conflicts.
          const latestBody = toPurchaseWireBody(form.getValues());
          submittedBody = latestBody;
          submittedRows = captureRows();
          result = await send({ id: result.bill.id, version: 1, body: latestBody });
        }
        if (result && outcome !== 'conflict' && result.bill.status === 'draft') {
          // Null cost means the item's default on the server, NOT a free item.
          // Reconcile from the accepted response, never by repricing in the UI.
          const wires = submittedBody.lines as Record<string, unknown>[];
          const resolved = wires.map((wire, index) => {
            const sent = submittedRows[index];
            const actual = result.bill.lines[index];
            if (
              wire.unit_cost !== null ||
              !sent?.itemId ||
              !actual ||
              actual.itemId !== sent.itemId
            )
              return wire;
            const current = form.getValues(`lines.${sent.index}`);
            if (current && draftSnapshot(current) === sent.snapshot) {
              form.setValue(`lines.${sent.index}.unitCost`, actual.unitCost, {
                shouldDirty: false,
              });
            }
            return { ...wire, unit_cost: actual.unitCost };
          });
          const submittedSnapshot = purchaseWireSnapshot({ ...submittedBody, lines: resolved });
          setDraftState((previous) =>
            previous?.scope === scope ? { ...previous, acknowledged: submittedSnapshot } : previous
          );
        }
        return outcome === 'conflict' ? null : result;
      }),
    [saves, store, documentId, dispatch, kind, form, scope]
  );

  /** §10 — the header rules at Record only; a draft is saved half-entered (FR-8). */
  const validate = useCallback(async (): Promise<boolean> => {
    form.clearErrors();
    const rows = form.getValues('lines');
    const incomplete = rows.findIndex(hasIncompletePurchaseInput);
    if (incomplete >= 0) {
      const line = rows[incomplete];
      if (!line) return false;
      const field =
        !line.itemId && !line.description.trim()
          ? 'itemId'
          : !isCompletePurchaseLine({ ...line, unitCost: '' })
            ? 'qty'
            : 'unitCost';
      form.setError(`lines.${incomplete}.${field}`, {
        type: 'client',
        message: t('purchases.line.incomplete', { n: incomplete + 1 }),
      });
      dispatch(
        showSnackbar({
          severity: 'error',
          id: 'purchases.line.incomplete',
          params: { n: incomplete + 1 },
        })
      );
      return false;
    }
    for (const [index, line] of rows.entries()) {
      if (!line.itemId && !line.description.trim()) continue;
      try {
        quantityValidation(line.allowDecimal !== false).validateSync(line.qty);
      } catch (error) {
        if (!(error instanceof ValidationError)) throw error;
        form.setError(`lines.${index}.qty`, { type: 'client', message: error.message });
        dispatch(
          showSnackbar({
            severity: 'error',
            id: 'purchases.line.quantityInvalid',
            params: { n: index + 1 },
          })
        );
        return false;
      }
    }
    try {
      await purchaseBillSchema.validate(form.getValues(), { abortEarly: false });
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        error.inner.forEach((issue) => {
          if (issue.path)
            form.setError(issue.path as keyof PurchaseBillFormValues, {
              type: 'client',
              message: issue.message,
            });
        });
      }
      return false;
    }
  }, [purchaseBillSchema, quantityValidation, form, t, dispatch]);

  const record = useCallback(
    async (
      payment?: readonly PurchasePaymentRow[] | null
    ): Promise<PurchaseBillEnvelope | null> => {
      const retry = recordIntent.current?.scope === scope ? recordIntent.current.arg : null;
      let arg = retry;
      if (!arg) {
        if (!(await validate())) return null;
        const saved = await save(false);
        if (!saved) return null;
        if (saved.bill.status !== 'draft') return saved;
        arg = {
          id: saved.bill.id,
          version: saved.bill.version,
          idempotencyKey: idempotency.key,
          payment:
            kind === 'purchase_bill' && payment?.length
              ? purchasePaymentWireBody(payment, form.getValues('documentDate'))
              : null,
        };
      }
      const original = arg;
      return saves.enqueue(async (currentScope) => {
        if (!currentScope()) return null;
        if (retry) {
          // Read first: the server may already have recorded money while its reply was lost.
          const read = dispatch(fetchPurchaseBill({ id: original.id, kind }));
          saves.track(read);
          const checked = await read;
          if (!currentScope() || !fetchPurchaseBill.fulfilled.match(checked)) return null;
          if (checked.payload.bill.status !== 'draft') {
            dispatch(purchaseRecordRecovered(checked.payload));
            // The write happened despite its lost reply. Reuse normal cache rules,
            // without fabricating a fulfilled mutation or patching balances twice.
            const entry =
              INVALIDATION[kind === 'purchase_order' ? 'movePurchaseOrder' : 'recordPurchaseBill'];
            if (entry.stale?.length)
              dispatch(cacheInvalidated({ slices: entry.stale, urgency: 'next-mount' }));
            recordIntent.current = null;
            setUncertainScope(null);
            idempotency.rotate();
            return checked.payload;
          }
        }
        recordIntent.current = { scope, arg: original };
        const pending =
          kind === 'purchase_order'
            ? dispatch(
                movePurchaseOrder({ id: original.id, verb: 'send', version: original.version })
              )
            : dispatch(recordPurchaseBill(original));
        saves.track(pending);
        const result = await pending;
        if (!currentScope()) return null;
        if (
          recordPurchaseBill.fulfilled.match(result) ||
          movePurchaseOrder.fulfilled.match(result)
        ) {
          if (kind === 'purchase_order') dispatch(purchaseRecordRecovered(result.payload));
          recordIntent.current = null;
          setUncertainScope(null);
          idempotency.rotate();
          form.reset(form.getValues());
          return result.payload;
        }
        if (retry || mayHaveBeenSaved(result.payload)) {
          // A definitive refusal on a later CHECK cannot disprove an earlier lost payment.
          setUncertainScope(scope);
        } else {
          recordIntent.current = null;
          setUncertainScope(null);
          idempotency.rotate();
        }
        if (result.payload?.code === 'validation_error') {
          applyServerErrors(result.payload, form.setError, FORM_FIELDS, t);
        }
        return null;
      });
    },
    [validate, form, save, dispatch, idempotency, t, kind, saves, scope]
  );

  /** FR-7 — on blur of the supplier invoice number. */
  const checkDuplicate = useCallback(() => {
    const { partyId, supplierInvoiceNumber } = form.getValues();
    const number = supplierInvoiceNumber.trim();
    if (!partyId || !number) return;
    void dispatch(checkDuplicateSupplierInvoice({ partyId, number, excludeId: savedId }));
  }, [dispatch, form, savedId]);

  const currentSnapshot = useMemo(() => purchaseWireSnapshot(toPurchaseWireBody(values)), [values]);
  const incompleteInput = (values.lines ?? []).some(hasIncompletePurchaseInput);
  const currentDraft = draftState?.scope === scope ? draftState : null;
  const hasUnsavedChanges =
    !!currentDraft &&
    !editor.recorded &&
    (currentSnapshot !== (currentDraft.acknowledged ?? currentDraft.initial) || incompleteInput);

  // FR-8 — the quiet server copy, 10 s after the last change.
  const dirty = form.formState.isDirty;
  const meaningful = !!values.partyId || (values.lines ?? []).some(isCompletePurchaseLine);
  const blocked =
    offline ||
    recordRecovery ||
    editor.saveState === 'conflict' ||
    editor.recording ||
    !!editor.recorded;
  const saving = useRef(false);
  const [saveRevision, setSaveRevision] = useState(0);
  useEffect(() => {
    if (repeatId || !dirty || !hasUnsavedChanges || blocked || !meaningful || !canWrite)
      return undefined;
    const timer = window.setTimeout(() => {
      if (saving.current) return;
      saving.current = true;
      const submitted = draftSnapshot(form.getValues());
      void save(true).then((result) => {
        saving.current = false;
        // Only what was submitted is saved; typing since stays dirty and re-arms.
        if (result && settleAutosave(form, submitted)) setSaveRevision((n) => n + 1);
      });
    }, PURCHASE_AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [
    values,
    dirty,
    hasUnsavedChanges,
    blocked,
    meaningful,
    canWrite,
    save,
    form,
    saveRevision,
    repeatId,
  ]);

  /** "New bill" after recording on `/new`: a blank editor without a page load. */
  const restart = useCallback(() => {
    saves.invalidate();
    creationKey.current = null;
    dispatch(purchaseEditorReset());
    recordIntent.current = null;
    setUncertainScope(null);
    seeded.current = 'new';
    const opened = emptyPurchaseForm(today, context?.gstType === 'regular');
    form.reset(opened);
    setDraftState({
      scope,
      initial: purchaseWireSnapshot(toPurchaseWireBody(opened)),
      acknowledged: null,
    });
    setSeededFor('new');
    idempotency.rotate();
  }, [dispatch, form, today, context, idempotency, saves, scope]);

  return {
    form,
    seeded: seededFor === (documentId ?? 'new'),
    values,
    preview,
    editor,
    today,
    canWrite,
    regular: (context?.gstType ?? 'regular') === 'regular',
    save,
    record,
    validate,
    canPayNow: hasModule('payments') && can('payments.payment.write'),
    offline,
    hasUnsavedChanges,
    hasServerCopy: !!currentDraft?.acknowledged,
    recordRecovery,
    checkDuplicate,
    restart,
  };
};

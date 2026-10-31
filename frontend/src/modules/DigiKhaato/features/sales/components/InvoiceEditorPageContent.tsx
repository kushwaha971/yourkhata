'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import dynamic from 'next/dynamic';

import { Banknote, PauseCircle, Save, ScanLine, Send, Trash2 } from 'lucide-react';
import { useStore } from 'react-redux';

import {
  UbButton,
  UbDialogLoading,
  UbDrawerLoading,
  UbEmptyState,
  UbForm,
  UbGrid,
  UbMoreActions,
  UbPageHeader,
  UbPageShell,
  UbPageSkeleton,
  UbPanel,
  UbStack,
  UbStatusBadge,
  UbStatusBanner,
  UbTaskBar,
  UbText,
  UbTotalDock,
  useIsMobileLayer,
  useMediaQuery,
} from 'src/design-system';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { useDocksEditorTotals } from 'src/hooks/useDocksEditorTotals';
import { useDocumentEditorWindowEffects } from 'src/hooks/useDocumentEditorWindowEffects';
import { useStillWorking } from 'src/hooks/useStillWorking';
import { useTranslation } from 'src/hooks/useTranslation';
import { selectLocale } from 'src/redux/slice/localeSlice';
import { selectNetworkState } from 'src/redux/slice/networkSlice';
import { selectMayOverrideCreditLimit } from 'src/redux/slice/sessionSlice';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import type { RootState } from 'src/redux/store';
import { ROUTES } from 'src/routes';
import { formatBusinessDate } from 'src/utils/dates';
import { formatInr, sumMoney } from 'src/utils/money';

import { listInvoices } from '../api/salesService';
import { useDraftAutosave } from '../hooks/useDraftAutosave';
import { useInvoiceEditor, type EditorKind } from '../hooks/useInvoiceEditor';
import { deleteEstimateDraft } from '../redux/salesFlowThunk';
import { deleteInvoiceDraft } from '../redux/salesThunk';
import { firstWrongField } from '../view-model/firstWrongField';
import { documentTitleId, stockShortLines, stockShortMessage } from '../view-model/invoiceDisplay';
import { fullCashPayment, type PaymentRowForm } from '../view-model/invoiceForm';
import { serverReason } from '../view-model/serverReason';

import { InvoiceBillAdjustments } from './InvoiceBillAdjustments';
import { InvoiceEditorDialogs } from './InvoiceEditorDialogs';
import { InvoiceHeldBills } from './InvoiceHeldBills';
import { InvoiceLinesSection } from './InvoiceLinesSection';
import { InvoicePartySection } from './InvoicePartySection';
import { InvoiceSaveIndicator } from './InvoiceSaveIndicator';
import { InvoiceTotalsPanel } from './InvoiceTotalsPanel';

import type { InvoiceListRow } from '../types/sales.types';

/* The payment sheet and the success sheet load with the tap that opens them. */
const PaymentDrawerLazy = dynamic(
  () => import('./InvoicePaymentDrawer').then((m) => m.InvoicePaymentDrawer),
  { ssr: false, loading: () => <UbDrawerLoading /> }
);
/* Shop item 4 — only a challan has these fields, so only a challan's editor loads them. */
const ChallanDetailsSection = dynamic(
  () => import('./ChallanDetailsSection').then((m) => m.ChallanDetailsSection),
  { ssr: false }
);
const IssuedDialogLazy = dynamic(
  () => import('./InvoiceIssuedDialog').then((m) => m.InvoiceIssuedDialog),
  { ssr: false, loading: () => <UbDialogLoading /> }
);

/**
 * SAL-02 / SAL-06 / SAL-07 — `/sales/invoices/new` and `/[id]/edit`: the
 * billing counter. Party (or walk-in) and dates on the left with the line
 * grid; the totals panel sticky on the right; Save draft (Ctrl+S) and Issue
 * (Ctrl+Enter) in the header. A walk-in pays in full through the payment
 * sheet (F8); a party bill issues on credit to the khata.
 *
 * SAL-01 — `kind="estimate"` is the SAME editor (TSK-SAL-01-07): "Valid until"
 * in place of the due date, "Estimated GST" in the totals, and "Save & send"
 * in place of Issue — which numbers the estimate and opens it, never posting
 * stock, ledger or a payment.
 */
export function InvoiceEditorPageContent({
  documentId,
  kind = 'invoice',
}: Readonly<{ documentId: string | null; kind?: EditorKind }>): React.JSX.Element {
  const { t } = useTranslation();
  const router = useAppRouter();
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();
  const locale = useAppSelector(selectLocale);
  const editor = useInvoiceEditor(documentId, kind);
  const autosave = useDraftAutosave(editor, documentId);
  const { form, preview, editor: server, canWrite, save, issue, values, today } = editor;
  const [paying, setPaying] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  /* C1 (design dScan): once a code has been scanned onto this bill, the desktop
     says the scanner is working ("Scanner connected · beep on") and what it
     does. Before the first scan nothing is claimed: a USB scanner is a
     keyboard, and the browser cannot tell one is plugged in. */
  const [scanSeen, setScanSeen] = useState(false);
  const markScanned = useCallback(() => setScanSeen(true), []);
  // Shop item 3 — a sales order is written as an estimate is: saved, then numbered, never paid.
  // Shop item 4 — a delivery challan likewise: saved, then issued (stock out), never paid.
  const estimate = kind !== 'invoice';
  const order = kind === 'sales_order';
  const challan = kind === 'delivery_challan';
  const home = order
    ? ROUTES.SALES_ORDERS
    : challan
      ? ROUTES.SALES_CHALLANS
      : estimate
        ? ROUTES.SALES_ESTIMATES
        : ROUTES.SALES_INVOICES;

  const context = server.context;
  const taxFree = context ? context.gstType !== 'regular' : false;
  const walkIn = values.mode === 'walkIn';
  const docksTotals = useDocksEditorTotals();
  // dBill's two columns start at 1280; below it the totals stay under the lines.
  const desk = useMediaQuery('(min-width: 1280px)');
  const phoneBar = useIsMobileLayer() && !order && !challan && !estimate;
  const hasLines = preview.lines.length > 0 && values.lines.some((l) => l.itemId || l.description);
  const locked = server.issuing || !!server.issued;
  // Nothing to keep: no item, no customer, never saved. Save draft on such a
  // bill made an empty server draft, listed on hold as "Quick sale ₹0.00"
  // (manual beginner pass, 27 Oct 2026) — the same reason Hold refuses it.
  const worthSaving = hasLines || !!values.partyId || !!server.documentId;
  // A bill that is no longer a draft opens on its own page, as the purchase
  // editor already does. Its issue reply was lost and the merchant reloaded
  // (a4-edges slow-issue): the server had issued it, yet /edit showed "New
  // bill" with Paid cash live and offered the device copy back.
  const loadedIssued = Boolean(
    documentId &&
    server.loadStatus === 'succeeded' &&
    server.document?.id === documentId &&
    server.document.status !== 'draft' &&
    !server.issued
  );
  const { clearLocal } = autosave;
  useEffect(() => {
    if (!loadedIssued || !documentId) return;
    clearLocal();
    router.replace(`${home}/${documentId}`);
  }, [loadedIssued, documentId, router, home, clearLocal]);
  const creditBlocked = server.error?.code === 'credit_limit_exceeded';
  /*
   * QA B1 — `insufficient_stock` is a locally presented code (it never toasts),
   * and the editor had no surface for it: Issue went quiet with the payment
   * sheet still open over a bill that could not be issued. It is drawn here,
   * naming each short item and what is on hand.
   */
  // The other locally presented codes an issue can meet; none of them toasts.
  const otherRefusal =
    !server.issuing &&
    ['stale_version', 'document_not_draft', 'idempotency_conflict'].includes(
      server.error?.code ?? ''
    ) &&
    server.saveState !== 'conflict';
  const stockShort =
    server.error?.code === 'insufficient_stock' ? stockShortLines(server.error.details) : [];
  const mayOverride = useAppSelector(selectMayOverrideCreditLimit);
  /*
   * 07-screens/09 §3 — with the network confirmed gone, Issue is disabled with
   * its reason under it, BEFORE the tap: typing goes on and the device copy
   * keeps the bill. Only `offline`; a `degraded` link still tries, because the
   * issue is keyed and a slow answer is not a refused one.
   */
  const offline = useAppSelector(selectNetworkState) === 'offline';
  const stillIssuing = useStillWorking(server.issuing);
  const issueNote = offline
    ? t('sales.editor.offlineIssue')
    : stillIssuing
      ? t('sales.editor.stillIssuing')
      : null;

  const finishIssue = useCallback(
    async (payment: readonly PaymentRowForm[] | null, override = false) => {
      const result = await issue(payment, override);
      // The sheet would hide the banner that says why nothing happened (QA B1).
      const refused = store.getState().invoiceEditor?.error?.code;
      if (!result && (refused === 'insufficient_stock' || refused === 'credit_limit_exceeded')) {
        setPaying(false);
      }
      if (result) {
        setPaying(false);
        autosave.clearLocal();
        // An estimate has no success sheet: it opens, numbered, to be shared.
        if (estimate) router.push(`${home}/${result.document.id}`);
      }
    },
    [issue, autosave, estimate, router, home, store]
  );
  const startIssue = useCallback(() => {
    if (!hasLines || locked) return;
    // SAL-07 FR-3 / SAL-02 FR-10 — a walk-in pays in full; a party bill may
    // take a payment at issue or go on "Full credit" from the same sheet. An
    // estimate moves no money (SAL-01 FR-8): it is saved, never paid.
    if (!estimate && preview.grandTotal !== '0.00') setPaying(true);
    else void finishIssue(null);
  }, [hasLines, locked, estimate, preview.grandTotal, finishIssue]);
  // Every way to issue (the button, Ctrl+Enter, the form's own submit) runs the
  // schema first, so a half-filled row stops the issue with its reason under
  // the cell instead of being left off the bill.
  const requestIssue = useCallback(
    () => void form.handleSubmit(() => startIssue())(),
    [form, startIssue]
  );
  /*
   * 07-screens/09 §3 — most Quick Sales are paid in cash, in full, and the
   * sheet that opened for them only confirmed what it already said. "Paid
   * cash" issues with exactly the row that sheet defaults to; anything else
   * (UPI, a split) is one tap away on the other button. Same schema check, same
   * keyed issue, same offline refusal.
   */
  const cashSale = walkIn && !estimate;
  const requestCash = useCallback(
    () =>
      void form.handleSubmit(() => {
        if (!hasLines || locked) return;
        void finishIssue(fullCashPayment(preview.grandTotal));
      })(),
    [form, hasLines, locked, finishIssue, preview.grandTotal]
  );
  const { submitCount, errors } = form.formState;
  const refused = submitCount > 0 && Object.keys(errors).length > 0;
  /* Design §A4: the line above the pay buttons says why they are off: no item
     yet, or which field is wrong (and the page scrolls to it). */
  const wrong = refused ? firstWrongField(errors, values.lines.length) : null;
  const finishNote =
    issueNote ??
    (wrong
      ? wrong.n
        ? t('sales.dock.fixLineField', { n: wrong.n, field: t(wrong.label) })
        : t('sales.dock.fixField', { field: t(wrong.label) })
      : !hasLines && !locked
        ? t('sales.dock.addItem')
        : null);
  const wrongPath = wrong?.path;
  const wrongCol = wrong?.n
    ? Math.max(1, ['', 'qty', 'unitPrice', 'discountValue'].indexOf(wrongPath?.split('.')[2] ?? ''))
    : 0;
  const wrongLine = wrong?.n ?? 0;
  const openLine = useMemo(
    () => (wrongLine ? { row: wrongLine - 1, col: wrongCol, seq: submitCount } : null),
    [wrongLine, wrongCol, submitCount]
  );
  useEffect(() => {
    if (!wrongPath) return;
    // A line's rate or discount lives in its details, which may be closed:
    // then the line's Qty takes the caret, on the row the message names.
    const el =
      document.getElementById(wrongPath) ??
      document.getElementById(wrongPath.replace(/\.\w+$/, '.qty'));
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (el instanceof HTMLInputElement) el.focus({ preventScroll: true });
  }, [wrongPath, submitCount]);

  /*
   * Counter Mode — hold a bill and start the next one ("Hold & create
   * another"). A sales draft already saves itself; holding saves it NOW and
   * opens a blank bill, and the held ones sit above the editor to be picked up.
   * Only when the save answered: a hold that restarted over an unsaved bill
   * would throw it away.
   */
  const [held, setHeld] = useState<{ rows: readonly InvoiceListRow[]; total: number }>({
    rows: [],
    total: 0,
  });
  const [heldSeq, setHeldSeq] = useState(0);
  const currentId = server.documentId;
  useEffect(() => {
    if (kind !== 'invoice' || !canWrite) return undefined;
    const controller = new AbortController();
    listInvoices(
      { tab: 'draft', dateFrom: '', dateTo: '', partyId: null, q: '', page: 1 },
      controller.signal
    )
      .then((page) => {
        const rows = page.rows.filter((row) => row.id !== currentId);
        // The bill open here is a draft too, but it is not on hold.
        const self = page.rows.length - rows.length;
        setHeld({ rows, total: page.total - self });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [kind, canWrite, currentId, heldSeq]);
  const [holding, setHolding] = useState(false);
  const hold = useCallback(async () => {
    if (!hasLines || locked) return;
    setHolding(true);
    const saved = await save(false);
    setHolding(false);
    if (!saved) return;
    autosave.clearLocal();
    dispatch(showSnackbar({ severity: 'success', id: 'sales.hold.done' }));
    setHeldSeq((seq) => seq + 1);
    if (documentId) {
      router.push(`${ROUTES.SALES_INVOICES}/new`);
      return;
    }
    editor.restart();
    window.history.replaceState(null, '', `${ROUTES.SALES_INVOICES}/new`);
  }, [hasLines, locked, save, autosave, dispatch, documentId, router, editor]);

  // Hold and Save draft are checked like Paid cash: a save leaves out a line
  // that is not complete, so a line whose Qty was cleared (or typed over with
  // letters) was saved away — and Hold, which then clears the device copy,
  // lost it for good while the screen still showed it (monkey seed 7713).
  // Refused, the wrong field is named and the caret goes to it.
  const saveNow = useCallback(() => {
    if (worthSaving) void form.handleSubmit(() => void save(false))();
  }, [form, save, worthSaving]);
  const checkedHold = useCallback(() => void form.handleSubmit(() => hold())(), [form, hold]);
  useDocumentEditorWindowEffects({
    basePath: home,
    documentId,
    savedId: server.documentId,
    dirty: autosave.dirty,
    onSave: saveNow,
    onIssue: requestIssue,
  });

  const onDelete = useCallback(() => {
    if (!server.documentId) return;
    const id = server.documentId;
    const deleting = estimate
      ? dispatch(
          deleteEstimateDraft({
            id,
            kind: order ? 'sales_order' : challan ? 'delivery_challan' : 'estimate',
          })
        )
      : dispatch(deleteInvoiceDraft(id));
    void deleting.then(() => {
      autosave.clearLocal();
      router.push(home);
    });
  }, [server.documentId, estimate, order, challan, dispatch, autosave, router, home]);

  if (!canWrite) {
    return (
      <UbPageShell>
        <UbEmptyState
          variant="firstUse"
          title={t('sales.noAccess.title')}
          description={t('sales.noAccess.writeBody')}
        />
      </UbPageShell>
    );
  }
  if (!context || loadedIssued || (documentId && server.loadStatus !== 'succeeded')) {
    return <UbPageSkeleton variant="card" />;
  }

  const bill = !order && !challan && !estimate;
  const title = t(
    documentTitleId(
      order
        ? 'sales_order'
        : challan
          ? 'delivery_challan'
          : estimate
            ? 'estimate'
            : context.gstType === 'composition'
              ? 'bill_of_supply'
              : 'invoice',
      context.gstType
    )
  );
  const issueLabel = t(
    order
      ? 'sales.order.confirm'
      : challan
        ? 'sales.challan.issue'
        : estimate
          ? 'sales.estimate.saveAndSend'
          : cashSale
            ? 'sales.editor.otherPayment'
            : 'sales.editor.issue'
  );
  const cashLabel = t('sales.editor.paidCash');
  const issueBusyLabel = t(
    order
      ? 'sales.order.confirming'
      : challan
        ? 'sales.challan.issuing'
        : estimate
          ? 'sales.estimate.sending'
          : 'sales.editor.issuing'
  );

  // The accessible name carries the total ("Issue, ₹378.00"): a screen reader
  // hears what it is about to bill without leaving the button.
  const issueName = server.issuing
    ? undefined
    : t('sales.editor.issueWithTotal', {
        action: issueLabel,
        total: formatInr(preview.grandTotal),
      });
  const issueDisabled = !hasLines || locked || offline;
  const cashName = server.issuing
    ? undefined
    : t('sales.editor.issueWithTotal', { action: cashLabel, total: formatInr(preview.grandTotal) });
  /* The sheet's own confirm shows "Issuing…"; with no sheet the button tapped does. */
  const cashBusy = server.issuing && !paying;

  /*
   * Counter Mode step 10 — under the docked total, what it counts and the GST
   * in it, and the draft's save state beside the buttons that finish it (one
   * place: two live regions saying the same thing would be read twice).
   */
  const saveIndicator = (
    <InvoiceSaveIndicator
      indicator={autosave.indicator}
      savedAt={autosave.savedAt}
      reason={serverReason(server.error, t)}
    />
  );
  const itemCount = values.lines.filter((l) => l.itemId || l.description).length;
  const gst = sumMoney([
    preview.cgstTotal,
    preview.sgstTotal,
    preview.igstTotal,
    preview.cessTotal,
  ]);
  const dockCaption = itemCount
    ? [
        t('sales.dock.items', { count: itemCount }),
        taxFree || gst === '0.00' ? null : t('sales.dock.includesGst', { amount: formatInr(gst) }),
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined;

  return (
    <UbPageShell>
      {phoneBar ? (
        /* Design §A4 phone (R-DEC-55): × · New bill / its kind · ⋯. Hold, Save
           draft and Discard draft are behind the ⋯, one tap away; the dock
           keeps the two ways to finish. × leaves for the bills list, and the
           bill is kept (it autosaves, and the device keeps a copy). */
        <UbTaskBar
          title={t('sales.newBill')}
          subtitle={title}
          onClose={() => router.push(home)}
          closeLabel={t('common.action.close')}
          // Full width, as the design's bar: out of the page's 16 px padding.
          className="-mx-4 -mt-4 mb-1"
          trailing={
            <UbMoreActions
              label={t('common.action.moreActions')}
              title={t('common.action.moreActions')}
              closeLabel={t('common.action.close')}
              testId="invoice-more"
              // The design's bar controls are plain 40 px squares (`.ib`).
              className="h-10 w-10 border-transparent bg-transparent shadow-none"
              rows={[
                ...(kind === 'invoice' && hasLines && !locked
                  ? [
                      {
                        key: 'hold',
                        label: t('sales.hold.action'),
                        icon: <PauseCircle className="h-5 w-5" aria-hidden />,
                        onSelect: checkedHold,
                        testId: 'invoice-hold',
                      },
                    ]
                  : []),
                ...(!locked && worthSaving
                  ? [
                      {
                        key: 'save',
                        label: t('sales.editor.saveDraft'),
                        icon: <Save className="h-5 w-5" aria-hidden />,
                        onSelect: saveNow,
                      },
                    ]
                  : []),
                ...(server.documentId && !locked
                  ? [
                      {
                        key: 'delete',
                        label: t('sales.editor.delete'),
                        icon: <Trash2 className="h-5 w-5" aria-hidden />,
                        tone: 'danger' as const,
                        onSelect: () => setConfirmDelete(true),
                      },
                    ]
                  : []),
              ]}
            />
          }
        />
      ) : (
        <UbPageHeader
          /* Design §A3/A4 (owner, 26 Oct 2026: the design's words everywhere): a
           sales bill is "New bill", with what kind of bill it is underneath.
           A draft has no number until it is issued, so none is shown. The
           other documents have no design yet and keep their titles. */
          title={
            bill
              ? t('sales.newBill')
              : documentId || server.documentId
                ? t('sales.editor.editTitle', { title })
                : estimate && !order && !challan
                  ? // Design D13 pEstimate: "New estimate", sentence case.
                    t('sales.estimate.new')
                  : t('sales.editor.newTitle', { title })
          }
          subtitle={
            bill
              ? title
              : estimate && !order && !challan
                ? values.validUntil
                  ? t('sales.estimate.validLine', { date: formatBusinessDate(values.validUntil) })
                  : t('sales.estimate.validFor')
                : undefined
          }
          controls={docksTotals ? undefined : saveIndicator}
          actions={
            <>
              {/* Design dScan: the badge sits on the header's right, level
                  with the title, beside the bill's own actions. */}
              {bill && desk && scanSeen && (
                <UbStatusBadge
                  label={t('sales.scan.badge')}
                  icon={<ScanLine aria-hidden className="h-3.5 w-3.5" />}
                  className="self-center bg-accent-quiet text-text-accent"
                />
              )}
              {server.documentId && (
                <UbButton
                  variant="ghost"
                  iconOnly="mobile"
                  icon={<Trash2 className="h-4 w-4" aria-hidden />}
                  onClick={() => setConfirmDelete(true)}
                  disabled={locked}
                >
                  {t('sales.editor.delete')}
                </UbButton>
              )}
              {kind === 'invoice' && (
                <UbButton
                  variant="ghost"
                  iconOnly="mobile"
                  icon={<PauseCircle className="h-4 w-4" aria-hidden />}
                  onClick={checkedHold}
                  busy={holding}
                  disabled={!hasLines || locked}
                  data-testid="invoice-hold"
                >
                  {t('sales.hold.action')}
                </UbButton>
              )}
              <UbButton
                variant="secondary"
                iconOnly="mobile"
                icon={<Save className="h-4 w-4" aria-hidden />}
                onClick={saveNow}
                busy={server.saveState === 'saving'}
                disabled={locked || !worthSaving}
                /* Below 1536 px Save and Issue are docked under the total (below);
                 a cash Quick Sale's dock holds its two ways to be paid instead. */
                className={cashSale ? undefined : 'max-2xl:hidden'}
              >
                {t('sales.editor.saveDraft')}
              </UbButton>
              <UbButton
                variant={cashSale ? 'secondary' : 'primary'}
                iconOnly="mobile"
                icon={<Send className="h-4 w-4" aria-hidden />}
                onClick={requestIssue}
                busy={server.issuing && !cashBusy}
                busyLabel={issueBusyLabel}
                disabled={issueDisabled}
                aria-label={issueName}
                data-testid="invoice-issue"
                className="max-2xl:hidden"
              >
                {issueLabel}
              </UbButton>
              {cashSale && (
                <UbButton
                  iconOnly="mobile"
                  icon={<Banknote className="h-4 w-4" aria-hidden />}
                  onClick={requestCash}
                  busy={cashBusy}
                  busyLabel={issueBusyLabel}
                  disabled={issueDisabled}
                  aria-label={cashName}
                  data-testid="invoice-paid-cash"
                  className="max-2xl:hidden"
                >
                  {cashLabel}
                </UbButton>
              )}
            </>
          }
        />
      )}
      <UbForm
        form={form}
        onSubmit={() => startIssue()}
        // Design §A4: the dock names the wrong field; the old general banner
        // stays only for an error no field can be named for.
        formErrors={refused && !wrong ? [t('sales.validation.fixHighlighted')] : undefined}
      >
        {/* Design §A4 dBill (owner, 26 Oct 2026, over WP-05): from 1280 px
            up the lines take the width and a 340 px column beside them holds
            More details and the totals, so a laptop sees both at once. */}
        <UbGrid columns={1} gap={4} className="xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
          <UbStack gap={4} className="min-w-0">
            <InvoiceHeldBills rows={held.rows} total={held.total} />
            {/* From 1536 px Issue is in the header, so its reason heads the form. */}
            {finishNote && !docksTotals && (
              <UbText
                variant="body-sm"
                tone="secondary"
                role="status"
                data-testid="invoice-issue-note"
              >
                {finishNote}
              </UbText>
            )}
            {stockShort.length > 0 && (
              <UbStatusBanner
                tone="error"
                title={t('sales.stock.blocked')}
                description={stockShort.map((line) => stockShortMessage(line, t)).join(' · ')}
              />
            )}
            {otherRefusal && (
              <UbStatusBanner
                tone="error"
                title={t('sales.editor.error.issue')}
                description={serverReason(server.error, t) ?? undefined}
              />
            )}
            {creditBlocked && (
              <UbStatusBanner
                tone="error"
                title={t('sales.credit.blocked')}
                description={server.error?.message}
                action={
                  mayOverride ? (
                    <UbButton
                      size="sm"
                      variant="secondary"
                      onClick={() => void finishIssue(null, true)}
                    >
                      {t('sales.credit.override')}
                    </UbButton>
                  ) : undefined
                }
              />
            )}
            <UbPanel>
              <InvoicePartySection
                form={form}
                today={today}
                tenantState={context.stateCode}
                locale={locale}
                disabled={locked}
                kind={kind}
                part={desk ? 'who' : 'all'}
                adjustments={
                  <InvoiceBillAdjustments
                    form={form}
                    roundOffAmount={preview.roundOff}
                    subtotal={preview.subtotal}
                    disabled={locked}
                  />
                }
              />
            </UbPanel>
            {challan && !desk && (
              <UbPanel>
                <ChallanDetailsSection form={form} disabled={locked} />
              </UbPanel>
            )}
            <InvoiceLinesSection
              form={form}
              preview={preview}
              rateOptions={context.rateOptions}
              taxFree={taxFree}
              disabled={locked}
              onSubmitShortcut={requestIssue}
              openLine={openLine}
              onScanned={markScanned}
              stockRule={order ? 'order' : estimate && !challan ? 'estimate' : 'takes'}
            />
          </UbStack>
          <UbStack gap={3} className="min-w-0" data-testid="invoice-side">
            {/* Design D13 dChallan: Transport is the side column's first card. */}
            {challan && desk && (
              <UbPanel>
                <ChallanDetailsSection form={form} disabled={locked} side />
              </UbPanel>
            )}
            {desk && (
              <InvoicePartySection
                form={form}
                today={today}
                tenantState={context.stateCode}
                locale={locale}
                disabled={locked}
                kind={kind}
                part="details"
                adjustments={
                  <InvoiceBillAdjustments
                    form={form}
                    roundOffAmount={preview.roundOff}
                    subtotal={preview.subtotal}
                    disabled={locked}
                  />
                }
              />
            )}
            {/* Design §A4 pBillEmpty / dBillTop: a bill with no item has no
                totals card; the dock already says ₹0 and why it cannot finish. */}
            {(hasLines || !bill) && (
              <InvoiceTotalsPanel
                form={form}
                preview={preview}
                taxFree={taxFree}
                estimated={estimate}
                alwaysDiscount={desk}
                rule46={estimate ? null : server.rule46}
                warnings={server.warnings}
              />
            )}
            {bill && desk && scanSeen && (
              // Design dScan `.card.pad.small.sec`: what the scanner does.
              <UbPanel data-testid="scan-help">
                <UbStack gap={1} className="p-4">
                  <UbText as="h2" variant="body-sm-medium">
                    {t('sales.scan.help.title')}
                  </UbText>
                  <UbText as="p" variant="body-sm" tone="secondary">
                    {t('sales.scan.help.same')}
                  </UbText>
                  <UbText as="p" variant="body-sm" tone="secondary">
                    {t('sales.scan.help.caret')}
                  </UbText>
                </UbStack>
              </UbPanel>
            )}
          </UbStack>
        </UbGrid>
      </UbForm>

      {/* docs/mobile-redesign (A14) — the total and the two ways to finish are
          docked at the bottom, always in view while lines are added; the
          header no longer carries them there. WP-05 layout A extends it from
          phones to every width below 1536 px, where the totals panel moves
          under the lines so they have room for a table. */}
      {docksTotals && (
        <UbTotalDock
          data-testid="invoice-dock"
          // Design §A4: the dock sits at the bottom of the screen, also on a
          // short bill (it followed the content and floated mid-screen).
          className="mt-auto"
          totalLabel={t(
            estimate && !order && !challan ? 'sales.estimate.total' : 'sales.totals.grand'
          )}
          total={formatInr(preview.grandTotal)}
          caption={dockCaption}
          meta={saveIndicator}
          note={finishNote}
        >
          {/* A cash Quick Sale's two finishing buttons take the dock; its
              Save stays in the header (the device copy and autosave keep
              the bill either way). */}
          {!cashSale && (
            <UbButton
              variant="secondary"
              onClick={saveNow}
              busy={server.saveState === 'saving'}
              disabled={locked}
            >
              {t('sales.editor.saveDraft')}
            </UbButton>
          )}
          <UbButton
            variant={cashSale ? 'secondary' : 'primary'}
            onClick={requestIssue}
            busy={server.issuing && !cashBusy}
            busyLabel={issueBusyLabel}
            disabled={issueDisabled}
            aria-label={issueName}
          >
            {issueLabel}
          </UbButton>
          {cashSale && (
            <UbButton
              onClick={requestCash}
              busy={cashBusy}
              busyLabel={issueBusyLabel}
              disabled={issueDisabled}
              aria-label={cashName}
              data-testid="invoice-dock-paid-cash"
            >
              {cashLabel}
            </UbButton>
          )}
        </UbTotalDock>
      )}

      {paying && (
        <PaymentDrawerLazy
          open
          grandTotal={preview.grandTotal}
          busy={server.issuing}
          onClose={() => setPaying(false)}
          onConfirm={(rows) => void finishIssue(rows)}
          onCredit={walkIn ? undefined : () => void finishIssue(null)}
        />
      )}
      {server.issued && (
        <IssuedDialogLazy
          issued={server.issued}
          onPrint={() =>
            router.push(`${ROUTES.SALES_INVOICES}/${server.issued?.document.id}?print=1`)
          }
          onView={() => router.push(`${ROUTES.SALES_INVOICES}/${server.issued?.document.id}`)}
          onNewBill={() => {
            if (documentId) {
              router.push(`${ROUTES.SALES_INVOICES}/new`);
              return;
            }
            editor.restart();
            window.history.replaceState(null, '', `${ROUTES.SALES_INVOICES}/new`);
          }}
        />
      )}
      <InvoiceEditorDialogs
        autosave={autosave}
        server={server}
        confirmDelete={confirmDelete}
        onConfirmDeleteChange={setConfirmDelete}
        onDelete={onDelete}
      />
    </UbPageShell>
  );
}

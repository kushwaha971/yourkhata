'use client';

import { useCallback, useState } from 'react';

import dynamic from 'next/dynamic';

import { Save, Send, Trash2, X } from 'lucide-react';

import {
  UbButton,
  UbConfirmDialog,
  UbEmptyState,
  UbForm,
  UbGrid,
  UbPageHeader,
  UbPageShell,
  UbPageSkeleton,
  UbPanel,
  UbStack,
  UbText,
  UbTotalDock,
} from 'src/design-system';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { useAppDispatch } from 'src/hooks/useAppStore';
import { useAsyncAction } from 'src/hooks/useAsyncAction';
import { useDocksEditorTotals } from 'src/hooks/useDocksEditorTotals';
import { useDocumentEditorWindowEffects } from 'src/hooks/useDocumentEditorWindowEffects';
import { useTranslation } from 'src/hooks/useTranslation';
import { hideSnackbar, showSnackbar } from 'src/redux/slice/snackbarSlice';
import { ROUTES } from 'src/routes';
import { formatTimestamp } from 'src/utils/dates';
import { formatInr, sumMoney } from 'src/utils/money';

import { usePurchaseBillEditor } from '../hooks/usePurchaseBillEditor';
import {
  purchaseConflictResolved,
  purchaseDuplicateCleared,
} from '../redux/purchaseBillEditorSlice';
import { deletePurchaseBillDraft } from '../redux/purchaseBillThunk';
import { hasRecordableLines, type PurchasePaymentRow } from '../view-model/purchaseBillForm';
import { recordedToast } from '../view-model/purchaseToasts';

import { PurchaseBillHeaderSection } from './PurchaseBillHeaderSection';
import { PurchaseBillLinesSection } from './PurchaseBillLinesSection';
import { PurchaseBillTotalsPanel } from './PurchaseBillTotalsPanel';

import type { PurchaseBillEnvelope, PurchaseKind } from '../types/purchase.types';

/* The "Paid now" sheet loads with the tap on Record, never with the editor. */
const PaidNowDrawerLazy = dynamic(
  () => import('./PurchasePaidNowDrawer').then((m) => m.PurchasePaidNowDrawer),
  { ssr: false }
);

/**
 * PUR-01 — `/purchases/bills/new` and `/[id]/edit`: the supplier and dates on
 * the left with the line grid (a COST column where the invoice has a rate);
 * the totals panel sticky on the right; Save draft and Record in the one-row
 * header. Record posts stock, the last cost and the supplier's khata in one
 * transaction on the server; the toast says the khata effect in the
 * supplier's terms (§8) and the bill opens.
 *
 * PUR-02 / FR-6h — Record asks one more question when the role may pay
 * suppliers: "Paid now?" (`PurchasePaidNowDrawer`, loaded with the tap). The
 * money goes to the server with the record call and becomes a PAYOUT voucher
 * allocated to this bill in the same transaction; "Pay later" records it on
 * credit. A role that may not pay suppliers, or a ₹0 bill, records at once.
 */
export function PurchaseBillEditorPageContent({
  documentId,
  kind = 'purchase_bill',
}: Readonly<{ documentId: string | null; kind?: PurchaseKind }>): React.JSX.Element {
  const { t } = useTranslation();
  const router = useAppRouter();
  const dispatch = useAppDispatch();
  const editor = usePurchaseBillEditor(documentId, kind);
  // Shop item 3 — the same editor writes an order: Send in place of Record, never paid.
  const order = kind === 'purchase_order';
  const home = order ? ROUTES.PURCHASE_ORDERS : ROUTES.PURCHASE_BILLS;
  const { form, preview, editor: server, canWrite, save, record, values, today, regular } = editor;
  const { validate, canPayNow, offline, hasUnsavedChanges, hasServerCopy } = editor;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paymentTotal, setPaymentTotal] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const shortcutsBlocked =
    paying || confirmLeave || confirmDelete || server.saveState === 'conflict';
  const context = server.context;
  const hasLines = hasRecordableLines(values, preview);
  const docksTotals = useDocksEditorTotals();
  const claimable = regular && values.itcEligible && !order;

  const openFinished = useCallback(
    (result: PurchaseBillEnvelope) => {
      setPaying(false);
      dispatch(
        showSnackbar(
          order
            ? {
                severity: 'success',
                id: 'purchases.order.sent',
                params: { number: result.bill.number ?? '' },
              }
            : recordedToast(result, values.partyName)
        )
      );
      router.push(`${home}/${result.bill.id}`);
    },
    [dispatch, order, values.partyName, router, home]
  );
  const finishRecord = useCallback(
    async (payment: readonly PurchasePaymentRow[] | null) => {
      if (!hasLines || server.recording || server.recorded || offline) return;
      const result = await record(payment);
      if (result) openFinished(result);
    },
    [hasLines, server.recording, server.recorded, offline, record, openFinished]
  );

  const { run: finishOnce, pending: finishing } = useAsyncAction(finishRecord);
  const baseLocked = server.recording || finishing || !!server.recorded;
  const needsSourceCosts = values.lines.some(
    (line) => !!line.itemId && line.unitCost.trim() === ''
  );
  const startRecord = useCallback(async () => {
    if (!hasLines || baseLocked || offline || shortcutsBlocked) return;
    if (order || !canPayNow) {
      finishOnce(null);
      return;
    }
    if (!(await validate())) return;
    let total = preview.grandTotal;
    if (needsSourceCosts) {
      const resolved = await save(false);
      if (!resolved) return;
      if (resolved.bill.status !== 'draft') {
        openFinished(resolved);
        return;
      }
      total = resolved.bill.grandTotal;
    }
    if (total === '0.00') {
      finishOnce(null);
      return;
    }
    setPaymentTotal(total);
    setPaying(true);
  }, [
    hasLines,
    baseLocked,
    offline,
    shortcutsBlocked,
    order,
    canPayNow,
    finishOnce,
    validate,
    preview.grandTotal,
    needsSourceCosts,
    save,
    openFinished,
  ]);
  const { run: startOnce, pending: preparing } = useAsyncAction(startRecord);
  const locked = baseLocked || preparing;
  const submitShortcut = useCallback(() => {
    if (!shortcutsBlocked) void form.handleSubmit(() => startOnce())();
  }, [form, startOnce, shortcutsBlocked]);

  const onPickSupplier = useCallback(
    (id: string, name: string) => {
      form.setValue('partyName', name);
      form.setValue('partyStateCode', null);
      form.setValue('partyCreditDays', null);
      dispatch(purchaseDuplicateCleared());
      if (!id) return;
      // The pick is saved at once, so the server can say where the supplier
      // is (inter-state or not) and their credit days — the list row a
      // search returns carries neither.
      void save(true).then((saved) => {
        const party = saved?.bill.party;
        if (!party) return;
        form.setValue('partyStateCode', party.stateCode);
        form.setValue('partyCreditDays', party.creditDays);
      });
    },
    [form, dispatch, save]
  );

  const saveNow = useCallback(() => {
    if (!locked && !offline && !shortcutsBlocked) void save(false);
  }, [locked, offline, save, shortcutsBlocked]);
  const requestClose = useCallback(() => {
    dispatch(hideSnackbar());
    if (hasUnsavedChanges) setConfirmLeave(true);
    else router.push(home);
  }, [dispatch, hasUnsavedChanges, router, home]);
  useDocumentEditorWindowEffects({
    basePath: home,
    documentId,
    savedId: server.documentId,
    dirty: hasUnsavedChanges,
    onSave: saveNow,
    onIssue: submitShortcut,
  });

  if (!canWrite) {
    return (
      <UbPageShell>
        <UbEmptyState
          variant="firstUse"
          title={t('purchases.noAccess.title')}
          description={t('purchases.noAccess.writeBody')}
        />
      </UbPageShell>
    );
  }
  if (!context || (documentId && server.loadStatus !== 'succeeded') || !editor.seeded) {
    return <UbPageSkeleton variant="card" />;
  }

  const savedAt = server.savedAt ?? server.document?.updatedAt;
  const savedTime = savedAt ? (formatTimestamp(savedAt).split(', ')[1] ?? '') : '';
  const indicator =
    offline ||
    (hasUnsavedChanges && server.saveState !== 'saving') ||
    (!hasServerCopy && server.saveState !== 'saving')
      ? t('purchases.draft.unsaved')
      : server.saveState === 'saving'
        ? t('purchases.draft.saving')
        : server.saveState === 'error' || server.saveState === 'conflict'
          ? t('purchases.draft.unsaved')
          : t('purchases.draft.saved', { time: savedTime });

  const saveIndicator = indicator ? (
    <UbText variant="caption" tone="tertiary" role="status">
      {indicator}
    </UbText>
  ) : undefined;
  const itemCount = values.lines.filter((line) => line.itemId || line.description).length;
  const gst = sumMoney([
    preview.cgstTotal,
    preview.sgstTotal,
    preview.igstTotal,
    preview.cessTotal,
  ]);
  const dockCaption = itemCount
    ? [
        t('purchases.dock.items', { count: itemCount }),
        gst === '0.00' ? null : t('purchases.dock.includesGst', { amount: formatInr(gst) }),
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined;

  return (
    <UbPageShell>
      <UbPageHeader
        title={
          documentId || server.documentId
            ? t(order ? 'purchases.order.editTitle' : 'purchases.editor.editTitle')
            : t(order ? 'purchases.order.newTitle' : 'purchases.editor.newTitle')
        }
        controls={docksTotals ? undefined : saveIndicator}
        actions={
          <>
            <UbButton
              variant="ghost"
              iconOnly
              icon={<X className="h-4 w-4" aria-hidden />}
              onClick={requestClose}
              disabled={locked}
            >
              {t(order ? 'purchases.order.close' : 'purchases.editor.close')}
            </UbButton>
            {server.documentId && (
              <UbButton
                variant="ghost"
                iconOnly="mobile"
                icon={<Trash2 className="h-4 w-4" aria-hidden />}
                onClick={() => setConfirmDelete(true)}
                disabled={locked}
              >
                {t('purchases.editor.delete')}
              </UbButton>
            )}
            <UbButton
              variant="secondary"
              iconOnly="mobile"
              icon={<Save className="h-4 w-4" aria-hidden />}
              onClick={saveNow}
              busy={server.saveState === 'saving'}
              disabled={locked || offline}
              /* Below 1536 px Save and Record are docked under the total (below). */
              className="max-2xl:hidden"
            >
              {t('purchases.editor.saveDraft')}
            </UbButton>
            <UbButton
              iconOnly="mobile"
              icon={<Send className="h-4 w-4" aria-hidden />}
              onClick={submitShortcut}
              busy={preparing || finishing || server.recording}
              busyLabel={t(
                preparing
                  ? 'purchases.editor.checking'
                  : order
                    ? 'purchases.order.sending'
                    : 'purchases.editor.recording'
              )}
              disabled={!hasLines || locked || offline}
              data-testid="purchase-record"
              className="max-2xl:hidden"
            >
              {t(order ? 'purchases.order.send' : 'purchases.editor.record')}
            </UbButton>
          </>
        }
      />
      <UbForm form={form} onSubmit={() => startOnce()}>
        <UbGrid columns={1} gap={4} className="2xl:grid-cols-3">
          <UbStack gap={4} className="2xl:col-span-2">
            <UbPanel>
              <PurchaseBillHeaderSection
                form={form}
                today={today}
                regular={regular}
                interState={preview.isInterState}
                duplicate={server.duplicate}
                disabled={locked}
                onPickSupplier={onPickSupplier}
                onInvoiceNumberBlur={editor.checkDuplicate}
                order={order}
              />
            </UbPanel>
            <PurchaseBillLinesSection
              form={form}
              preview={preview}
              rateOptions={context.rateOptions}
              disabled={locked}
              onSubmitShortcut={submitShortcut}
            />
          </UbStack>
          <PurchaseBillTotalsPanel
            form={form}
            preview={preview}
            claimable={claimable}
            warnings={server.warnings}
            disabled={locked}
          />
        </UbGrid>
      </UbForm>

      {/* docs/mobile-redesign (A14) — the total and the finishing actions,
          docked below 1536 px (WP-05 layout A; see useDocksEditorTotals). */}
      {docksTotals && (
        <UbTotalDock
          data-testid="purchase-dock"
          totalLabel={t('purchases.totals.grand')}
          total={formatInr(preview.grandTotal)}
          caption={dockCaption}
          meta={saveIndicator}
        >
          <UbButton
            variant="secondary"
            onClick={saveNow}
            busy={server.saveState === 'saving'}
            disabled={locked || offline}
          >
            {t('purchases.editor.saveDraft')}
          </UbButton>
          <UbButton
            onClick={submitShortcut}
            busy={preparing || finishing || server.recording}
            busyLabel={t(
              preparing
                ? 'purchases.editor.checking'
                : order
                  ? 'purchases.order.sending'
                  : 'purchases.editor.recording'
            )}
            disabled={!hasLines || locked || offline}
          >
            {t(order ? 'purchases.order.send' : 'purchases.editor.record')}
          </UbButton>
        </UbTotalDock>
      )}
      {paying && (
        <PaidNowDrawerLazy
          grandTotal={paymentTotal ?? preview.grandTotal}
          busy={preparing || finishing || server.recording}
          onClose={() => setPaying(false)}
          onConfirm={(rows) => finishOnce(rows)}
          onPayLater={() => finishOnce(null)}
        />
      )}

      <UbConfirmDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        title={t(order ? 'purchases.order.leaveTitle' : 'purchases.draft.leaveTitle')}
        description={t('purchases.draft.leaveBody')}
        confirmLabel={t('purchases.draft.leave')}
        cancelLabel={t('purchases.draft.stay')}
        closeLabel={t('common.action.close')}
        destructive
        onConfirm={() => {
          setConfirmLeave(false);
          router.push(home);
        }}
      />
      <UbConfirmDialog
        open={server.saveState === 'conflict'}
        onOpenChange={(open) => {
          // "Use the saved one": reopen the draft as the server has it. On /new a
          // recovered draft (ADR-063) is opened by its id, which a reload would lose.
          if (open) return;
          if (!documentId && server.documentId) router.replace(`${home}/${server.documentId}/edit`);
          else window.location.reload();
        }}
        title={t('purchases.draft.conflictTitle')}
        description={t('purchases.draft.conflictBody')}
        confirmLabel={t('purchases.draft.keepMine')}
        cancelLabel={t('purchases.draft.useServer')}
        closeLabel={t('common.action.close')}
        onConfirm={() => {
          const current = Number(server.error?.details?.current_version ?? server.version);
          dispatch(purchaseConflictResolved({ version: current }));
        }}
      />
      <UbConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('purchases.editor.deleteTitle')}
        description={t('purchases.editor.deleteBody')}
        confirmLabel={t('purchases.editor.delete')}
        cancelLabel={t('common.action.cancel')}
        closeLabel={t('common.action.close')}
        destructive
        onConfirm={() => {
          if (!server.documentId) return;
          void dispatch(deletePurchaseBillDraft({ id: server.documentId, kind })).then(() =>
            router.push(home)
          );
        }}
      />
    </UbPageShell>
  );
}

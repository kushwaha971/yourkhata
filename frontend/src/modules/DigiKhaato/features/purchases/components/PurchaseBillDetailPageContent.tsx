'use client';

import { useState } from 'react';

import dynamic from 'next/dynamic';

import { Ban, FileOutput, Pencil, Trash2, TriangleAlert, Wallet, XCircle } from 'lucide-react';

import {
  UbActionLink,
  UbActionSheet,
  UbAmount,
  UbButton,
  UbConfirmDialog,
  UbDialogLoading,
  UbDrawerLoading,
  UbEmptyState,
  UbInfoRow,
  UbLink,
  UbPageHeader,
  UbPageShell,
  UbPageSkeleton,
  UbPanel,
  UbStack,
  UbStatusBadge,
  UbStatusBanner,
  UbText,
} from 'src/design-system';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { usePermissions } from 'src/hooks/usePermissions';
import { useTranslation } from 'src/hooks/useTranslation';
import { selectNetworkImpaired } from 'src/redux/slice/networkSlice';
import { ROUTES } from 'src/routes';
import { formatBusinessDate, formatTimestamp } from 'src/utils/dates';
import { formatInr } from 'src/utils/money';
import { taxRateLabel } from 'src/utils/taxRateLabel';

import { usePurchaseBillDetail } from '../hooks/usePurchaseBillDetail';
import { deletePurchaseBillDraft, movePurchaseOrder } from '../redux/purchaseBillThunk';
import { PURCHASE_STATUS_TONE, supplierName, trimQty } from '../view-model/purchaseBillDisplay';

import type { PaymentContext } from '../../payments/types/payment.types';
import type { PurchaseBill, PurchaseKind } from '../types/purchase.types';

/* The void form (RHF, the resolver, the schema) loads with the tap that opens it. */
const VoidDialogLazy = dynamic(
  () => import('./PurchaseBillVoidDialog').then((m) => m.PurchaseBillVoidDialog),
  { ssr: false, loading: () => <UbDialogLoading /> }
);

const OrderCancelDialogLazy = dynamic(
  () => import('./PurchaseOrderCancelDialog').then((m) => m.PurchaseOrderCancelDialog),
  { ssr: false, loading: () => <UbDialogLoading /> }
);

/* Shop P0 — "Return goods": the lines, the reason and the stock switch load with the tap. */
const DebitNoteDrawerLazy = dynamic(
  () => import('./DebitNoteDrawer').then((m) => m.DebitNoteDrawer),
  { ssr: false,
  loading: () => <UbDrawerLoading /> }
);

const PaymentFormDrawerLazy = dynamic(
  () => import('../../payments/components/PaymentFormDrawer').then((m) => m.PaymentFormDrawer),
  { ssr: false,
  loading: () => <UbDrawerLoading /> }
);

const VOIDABLE = new Set(['recorded', 'partially_paid', 'paid', 'overdue']);
/**
 * Shop item 3 — an order is billed once; again only if that bill was voided or its
 * draft discarded (the server's rule, so the button never offers a 409).
 */
const billable = (doc: PurchaseBill): boolean =>
  doc.status === 'sent' ||
  (doc.status === 'billed' && (!doc.links.bill || doc.links.bill.status === 'void'));

/** PUR-02 FR-3 — the statuses a supplier payment may be allocated to. */
const PAYABLE = new Set(['recorded', 'partially_paid', 'overdue']);

/** A full-width two-up action that wraps its words instead of cutting them. */
const ROW_BUTTON = 'h-auto min-h-11 whitespace-normal';

/**
 * Revamp §6 (`docs/revamp/07-screens/09` §6) — `/purchases/{bills|orders|debit-notes}/{id}`,
 * in the order a merchant reads it: what is still to pay, then paying it, then what
 * the paper is tied to, then its lines. On a phone that is one column; from 1280 the
 * lines move left and the money, actions and links stay on the right (the bill page's
 * composition, §2, with supplier words).
 *
 * A bill's two ways of being wrong are ONE "Something's wrong…" chooser rather than
 * two header buttons: "The bill was entered wrongly" (PUR-04 void, consequences shown
 * before the reason) and "Goods went back" (a debit note). "Supplier gave money back"
 * is not offered: the page holds no supplier advance figure to gate it on, and an
 * option that may record money against nothing is worse than none (§6 risk note).
 *
 * Not here yet, each for a reason: the bill photo (no attachment wiring), Duplicate
 * and Print (FR-9's `PurchaseBillPrint`) — no control for an unbuilt feature.
 */
export function PurchaseBillDetailPageContent({
  id,
  kind = 'purchase_bill',
}: Readonly<{ id: string; kind?: PurchaseKind }>): React.JSX.Element {
  const { t } = useTranslation();
  const router = useAppRouter();
  const dispatch = useAppDispatch();
  const { can, hasModule } = usePermissions();
  const impaired = useAppSelector(selectNetworkImpaired);
  const detail = usePurchaseBillDetail(id, kind);
  const [voiding, setVoiding] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [billing, setBilling] = useState(false);
  const [returning, setReturning] = useState(false);
  const [wrongOpen, setWrongOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [paymentContext, setPaymentContext] = useState<PaymentContext | null>(null);
  const bill = detail.bill?.id === id ? detail.bill : null;
  // Shop item 3 — the same page shows an order: Create bill and Cancel, no money owed.
  const order = kind === 'purchase_order';
  // Shop P0 — a debit note: against its bill, Void only, what it took off and what is left.
  const note = kind === 'debit_note';
  const home = order ? ROUTES.PURCHASE_ORDERS : note ? ROUTES.DEBIT_NOTES : ROUTES.PURCHASE_BILLS;
  const isBill = !order && !note;

  const createBill = async () => {
    if (!bill) return;
    setBilling(true);
    const result = await dispatch(movePurchaseOrder({ id: bill.id, verb: 'create-bill' }));
    setBilling(false);
    if (movePurchaseOrder.fulfilled.match(result)) {
      router.push(`${ROUTES.PURCHASE_BILLS}/${result.payload.bill.id}/edit`);
    }
  };
  const deleteDraft = async () => {
    if (!bill) return;
    const result = await dispatch(deletePurchaseBillDraft({ id: bill.id, kind }));
    setDeleting(false);
    if (deletePurchaseBillDraft.fulfilled.match(result)) router.push(home);
  };

  if (!detail.canRead) {
    return (
      <UbPageShell>
        <UbEmptyState
          variant="firstUse"
          title={t('purchases.noAccess.title')}
          description={t('purchases.noAccess.body')}
        />
      </UbPageShell>
    );
  }
  if (detail.status === 'failed' && !bill) {
    return (
      <UbPageShell>
        <UbEmptyState
          variant="error"
          title={t('purchases.detail.error.title')}
          description={detail.error?.message ?? t('purchases.detail.error.body')}
        />
      </UbPageShell>
    );
  }
  if (!bill) return <UbPageSkeleton variant="card" />;

  const draft = bill.status === 'draft';
  const voided = bill.status === 'void';
  const canPay =
    isBill &&
    !!bill.party &&
    PAYABLE.has(bill.status) &&
    hasModule('payments') &&
    can('payments.payment.write');
  const canMistake = isBill && VOIDABLE.has(bill.status) && detail.canVoid;
  const canGoodsBack = isBill && VOIDABLE.has(bill.status) && detail.canWrite;
  const canCancelOrder = order && bill.status === 'sent' && detail.canWrite;
  const canCreateBill = order && billable(bill) && detail.canWrite;
  const canVoidNote = note && bill.status === 'issued' && detail.canVoid;
  const canEditDraft = draft && !note && detail.canWrite;
  const anyAction =
    canPay || canMistake || canGoodsBack || canCancelOrder || canCreateBill || canVoidNote;

  /* Total · Paid · To pay — the last one is what the page is for (§6 "What matters most"). */
  /* Each row: label, value, whether it is the figure the page is for, whether it is taken off. */
  const money: readonly (readonly [string, string, boolean, boolean?])[] = order
    ? [['purchases.order.estimatedTotal', bill.grandTotal, false]]
    : note
      ? [
          ['purchases.debitNote.total', bill.grandTotal, false],
          ...(bill.status === 'issued'
            ? ([
                ['purchases.debitNote.applied', bill.links.applied, false],
                ['purchases.debitNote.openCredit', bill.amountDue, true],
              ] as const)
            : []),
        ]
      : [
          ['purchases.totals.grand', bill.grandTotal, false],
          ...(bill.links.debitApplied !== '0.00'
            ? ([['purchases.debitNote.lessNotes', bill.links.debitApplied, false, true]] as const)
            : []),
          ...(!draft && !voided
            ? ([
                ['purchases.detail.paid', bill.amountPaid, false],
                ['purchases.total.toPay', bill.amountDue, true],
              ] as const)
            : []),
        ];
  const fact = (label: string, value: string) => (
    <UbInfoRow label={label} value={<UbText className="ds-num">{value}</UbText>} />
  );
  const theirNumber = note ? bill.links.supplierInvoiceNumber : bill.supplierInvoiceNumber;

  return (
    <UbPageShell>
      {paymentContext && (
        <PaymentFormDrawerLazy context={paymentContext} onClose={() => setPaymentContext(null)} />
      )}
      <UbPageHeader
        title={bill.number ?? t('purchases.status.draft')}
        wrapTitle
        subtitle={supplierName(bill)}
        controls={
          <UbStack direction="row">
            <UbStatusBadge
              tone={PURCHASE_STATUS_TONE[bill.status]}
              label={t(`purchases.status.${bill.status}`)}
            />
          </UbStack>
        }
      />
      <UbStack className="gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_360px]">
        <UbStack className="min-w-0 gap-4 xl:col-start-2 xl:row-start-1">
          {voided && (
            <UbStatusBanner
              tone="error"
              title={t('purchases.detail.voidBanner')}
              description={t('purchases.detail.voidBy', {
                reason: bill.voidReason ?? '',
                name: bill.voidedBy?.name ?? '—',
                when: bill.voidedAt ? formatTimestamp(bill.voidedAt) : '',
              })}
            />
          )}
          {order && bill.status === 'cancelled' && (
            <UbStatusBanner
              tone="warning"
              title={t('purchases.order.cancelledBanner')}
              description={bill.links.cancelReason ?? undefined}
            />
          )}
          <UbPanel aria-label={t('purchases.detail.money')}>
            <UbStack as="dl" gap={3} className="p-4" data-testid="purchase-money">
              {money.map(([key, value, main, less]) => (
                <UbStack
                  key={key}
                  direction="row"
                  gap={3}
                  align="baseline"
                  justify="between"
                  className={main ? 'flex-col border-t border-border-hairline pt-3' : ''}
                >
                  <UbText as="dt" id={`summary-${key}`} variant="body-sm" tone="secondary">
                    {t(key)}
                  </UbText>
                  <UbStack as="dd" aria-labelledby={`summary-${key}`}>
                    {less ? (
                      /* A deduction keeps its minus: "Less debit notes −₹126.00", never a plus. */
                      <UbAmount
                        value={value}
                        size="md"
                        tone="neutral"
                        sign="minus"
                        label={t(key)}
                        labelHidden
                        inline
                      />
                    ) : (
                      <UbAmount value={value} size={main ? 'lg' : 'md'} inline />
                    )}
                  </UbStack>
                </UbStack>
              ))}
            </UbStack>
            <UbStack gap={2} className="border-t border-border-hairline p-4">
              {fact(
                t(
                  order
                    ? 'purchases.order.date'
                    : note
                      ? 'purchases.debitNote.date'
                      : 'purchases.detail.billDate'
                ),
                formatBusinessDate(bill.documentDate)
              )}
              {!order && fact(t('purchases.detail.supplierInvoice'), theirNumber ?? '—')}
              {bill.supplierInvoiceDate &&
                fact(
                  t('purchases.detail.supplierInvoiceDate'),
                  formatBusinessDate(bill.supplierInvoiceDate)
                )}
              {bill.dueOn &&
                fact(
                  t(order ? 'purchases.order.expectedBy' : 'purchases.detail.dueOn'),
                  formatBusinessDate(bill.dueOn)
                )}
            </UbStack>
          </UbPanel>
          {(anyAction || canEditDraft) && (
            <UbStack gap={2}>
              <UbStack className="grid grid-cols-2 gap-2" data-testid="purchase-actions">
                {canPay && bill.party && (
                  <UbButton
                    disabled={impaired}
                    icon={<Wallet className="h-4 w-4" aria-hidden />}
                    className={ROW_BUTTON}
                    data-testid="record-payment-action"
                    onClick={() =>
                      setPaymentContext({
                        direction: 'out',
                        partyId: bill.party?.id ?? '',
                        partyName: supplierName(bill),
                        documentId: bill.id,
                        documentNumber: bill.number ?? undefined,
                        documentDue: bill.amountDue,
                        entry: 'bill',
                      })
                    }
                  >
                    {t('payments.record.titleOut')}
                  </UbButton>
                )}
                {(canMistake || canGoodsBack) && (
                  <UbButton
                    variant="secondary"
                    disabled={impaired}
                    icon={<TriangleAlert className="h-4 w-4" aria-hidden />}
                    className={ROW_BUTTON}
                    data-testid="purchase-wrong"
                    onClick={() => setWrongOpen(true)}
                  >
                    {t('purchases.detail.wrong')}
                  </UbButton>
                )}
                {canCreateBill && (
                  <UbButton
                    disabled={impaired}
                    icon={<FileOutput className="h-4 w-4" aria-hidden />}
                    className={ROW_BUTTON}
                    onClick={() => void createBill()}
                    busy={billing}
                    busyLabel={t('purchases.order.createBill.working')}
                    data-testid="purchase-order-create-bill"
                  >
                    {t('purchases.order.createBill.action')}
                  </UbButton>
                )}
                {canCancelOrder && (
                  <UbButton
                    variant="secondary"
                    disabled={impaired}
                    icon={<XCircle className="h-4 w-4" aria-hidden />}
                    className={ROW_BUTTON}
                    onClick={() => setCancelling(true)}
                    data-testid="purchase-order-cancel"
                  >
                    {t('purchases.order.cancel.action')}
                  </UbButton>
                )}
                {canVoidNote && (
                  <UbButton
                    variant="secondary"
                    disabled={impaired}
                    icon={<Ban className="h-4 w-4" aria-hidden />}
                    className={ROW_BUTTON}
                    onClick={() => setCancelling(true)}
                    data-testid="debit-note-void"
                  >
                    {t('purchases.debitNote.void.action')}
                  </UbButton>
                )}
                {canEditDraft && (
                  <>
                    <UbActionLink
                      href={`${home}/${bill.id}/edit`}
                      variant="primary"
                      className={ROW_BUTTON}
                      icon={<Pencil className="h-4 w-4" aria-hidden />}
                    >
                      {t('purchases.detail.edit')}
                    </UbActionLink>
                    <UbButton
                      variant="ghost"
                      disabled={impaired}
                      icon={<Trash2 className="h-4 w-4" aria-hidden />}
                      className={ROW_BUTTON}
                      onClick={() => setDeleting(true)}
                      data-testid="purchase-delete-draft"
                    >
                      {t('purchases.detail.deleteDraft')}
                    </UbButton>
                  </>
                )}
              </UbStack>
              {impaired && (
                <UbText variant="caption" tone="secondary" data-testid="purchase-offline">
                  {t('purchases.detail.offline')}
                </UbText>
              )}
            </UbStack>
          )}
          <PurchaseLinks bill={bill} isBill={isBill} order={order} note={note} />
        </UbStack>
        <PurchaseLines bill={bill} isBill={isBill} order={order} note={note} />
      </UbStack>
      <UbActionSheet
        open={wrongOpen}
        onOpenChange={setWrongOpen}
        title={t('purchases.detail.wrongTitle', { number: bill.number ?? '' })}
        closeLabel={t('common.action.close')}
        rows={[
          ...(canMistake
            ? [
                {
                  key: 'mistake',
                  label: t('purchases.detail.mistake'),
                  caption: t('purchases.detail.mistakeHint', { name: supplierName(bill) }),
                  testId: 'purchase-void',
                  onSelect: () => {
                    setWrongOpen(false);
                    detail.clearVoidError();
                    setVoiding(true);
                  },
                },
              ]
            : []),
          ...(canGoodsBack
            ? [
                {
                  key: 'return',
                  label: t('purchases.detail.goodsBack'),
                  caption: t('purchases.detail.goodsBackHint'),
                  testId: 'purchase-return',
                  onSelect: () => {
                    setWrongOpen(false);
                    setReturning(true);
                  },
                },
              ]
            : []),
        ]}
      >
        {isBill && bill.amountPaid !== '0.00' && (
          <UbStack gap={2} className="border-t border-border-hairline px-4 py-3">
            <UbText variant="body-sm" className="font-medium">
              {t('purchases.detail.moneyBack')}
            </UbText>
            <UbText variant="body-sm" tone="secondary">
              {t('purchases.detail.moneyBackHint', {
                amount: formatInr(bill.amountPaid),
                name: supplierName(bill),
              })}
            </UbText>
          </UbStack>
        )}
      </UbActionSheet>
      {cancelling && (
        <OrderCancelDialogLazy
          order={bill}
          mode={note ? 'voidNote' : 'cancelOrder'}
          onClose={() => setCancelling(false)}
        />
      )}
      {returning && <DebitNoteDrawerLazy bill={bill} onClose={() => setReturning(false)} />}
      {voiding && (
        <VoidDialogLazy
          bill={bill}
          busy={detail.voiding}
          error={detail.voidError}
          onClose={() => setVoiding(false)}
          onConfirm={(reason) => {
            void detail.voidBill(reason).then((ok) => {
              if (ok) setVoiding(false);
            });
          }}
        />
      )}
      <UbConfirmDialog
        open={deleting}
        onOpenChange={(next) => !next && setDeleting(false)}
        title={t('purchases.detail.deleteTitle')}
        description={t('purchases.detail.deleteBody')}
        confirmLabel={t('purchases.detail.deleteDraft')}
        cancelLabel={t('common.action.cancel')}
        closeLabel={t('common.action.close')}
        destructive
        onConfirm={() => void deleteDraft()}
      />
    </UbPageShell>
  );
}

type Part = Readonly<{ bill: PurchaseBill; isBill: boolean; order: boolean; note: boolean }>;

/** What the paper is tied to — every reference a link (§6 "Links"). */
function PurchaseLinks({ bill, isBill, order, note }: Part): React.JSX.Element | null {
  const { t } = useTranslation();
  const billLink = order ? bill.links.bill : null;
  const against = note ? bill.links.against : null;
  const fromOrder = isBill ? bill.links.order : null;
  if (
    !billLink &&
    !against &&
    !fromOrder &&
    bill.links.debitNotes.length === 0 &&
    bill.payments.length === 0
  ) {
    return null;
  }
  return (
    <UbStack gap={4}>
      {billLink && (
        <UbStatusBanner
          tone={billLink.status === 'void' ? 'warning' : 'info'}
          title={t(
            billLink.status === 'void' ? 'purchases.order.billVoided' : 'purchases.order.billedAs',
            { number: billLink.number ?? t('purchases.status.draft') }
          )}
          action={
            <UbActionLink
              href={`${ROUTES.PURCHASE_BILLS}/${billLink.id}`}
              variant="secondary"
              size="sm"
            >
              {t('purchases.order.openBill')}
            </UbActionLink>
          }
        />
      )}
      {against && (
        <UbStatusBanner
          tone="info"
          title={t('purchases.debitNote.against', {
            number: against.number ?? '',
            reason: bill.links.reason ? t(`purchases.debitNote.reason.${bill.links.reason}`) : '',
          })}
          description={t(
            bill.links.restock
              ? 'purchases.debitNote.goodsLeft'
              : 'purchases.debitNote.noGoodsMoved'
          )}
          action={
            <UbActionLink
              href={`${ROUTES.PURCHASE_BILLS}/${against.id}`}
              variant="secondary"
              size="sm"
            >
              {t('purchases.order.openBill')}
            </UbActionLink>
          }
        />
      )}
      {(fromOrder || bill.links.debitNotes.length > 0 || bill.payments.length > 0) && (
        <UbPanel aria-label={t('purchases.detail.links')}>
          <UbStack gap={4} className="p-4">
            {fromOrder && (
              <UbText variant="body-sm">
                {t('purchases.order.fromOrder')}{' '}
                <UbLink href={`${ROUTES.PURCHASE_ORDERS}/${fromOrder.id}`}>
                  {fromOrder.number ?? ''}
                </UbLink>
              </UbText>
            )}
            {bill.links.debitNotes.length > 0 && (
              <UbStack gap={1} data-testid="purchase-debit-notes">
                <UbText variant="body-sm-medium">{t('purchases.debitNote.listTitle')}</UbText>
                {bill.links.debitNotes.map((dn) => (
                  <UbText key={dn.id} variant="caption" tone="secondary" className="ds-num">
                    <UbLink href={`${ROUTES.DEBIT_NOTES}/${dn.id}`}>{dn.number ?? ''}</UbLink>
                    {` · ${formatBusinessDate(dn.documentDate)} · ${formatInr(dn.grandTotal)}`}
                    {dn.status === 'void' ? ` · ${t('purchases.status.void')}` : ''}
                  </UbText>
                ))}
              </UbStack>
            )}
            {bill.payments.length > 0 && (
              <UbStack gap={1} data-testid="purchase-payments">
                <UbText variant="body-sm-medium">{t('purchases.detail.payments')}</UbText>
                {bill.payments.map((payment) => (
                  <UbText key={payment.id} variant="caption" tone="secondary" className="ds-num">
                    <UbLink href={`${ROUTES.PAYMENTS}/${payment.id}`}>{payment.number}</UbLink>
                    {` · ${formatBusinessDate(payment.paymentDate)} · ${formatInr(payment.amount)}`}
                  </UbText>
                ))}
              </UbStack>
            )}
          </UbStack>
        </UbPanel>
      )}
    </UbStack>
  );
}

/**
 * The lines with the cost each put into stock — cost belongs here, it is the shop's
 * own bill — then the tax breakdown the paper carries, then input tax credit and notes.
 */
function PurchaseLines({ bill, isBill, order, note }: Part): React.JSX.Element {
  const { t } = useTranslation();
  const title = t(
    order
      ? 'purchases.detail.itemsOrder'
      : note
        ? 'purchases.detail.itemsReturned'
        : 'purchases.detail.items'
  );
  const row = (label: string, value: string) => (
    <UbInfoRow label={label} value={<UbText className="ds-num">{value}</UbText>} />
  );
  return (
    <UbPanel className="min-w-0 xl:col-start-1 xl:row-start-1 xl:self-start" aria-label={title}>
      <UbText variant="body-sm" className="p-4 pb-0 font-semibold">
        {title}
      </UbText>
      <UbStack gap={0} className="px-4" data-testid="purchase-lines">
        {bill.lines.map((line, index) => (
          <UbStack
            key={line.id ?? line.lineNo}
            direction="row"
            justify="between"
            align="start"
            className={`gap-3 py-3 ${index > 0 ? 'border-t border-border-hairline' : ''}`}
          >
            <UbStack gap={0} className="min-w-0 flex-1">
              <UbText variant="body" className="break-words font-medium">
                {line.description}
              </UbText>
              <UbText variant="caption" tone="secondary" className="ds-num">
                {t('purchases.detail.lineCaption', {
                  qty: trimQty(line.qty),
                  unit: line.unitCode,
                  cost: formatInr(line.unitCost),
                  // QA retest P-D6: the zero-rate codes read as words in the
                  // reader's language; a rate reads "GST 5%", never "GST5".
                  code: taxRateLabel(
                    { code: line.taxCode, name: `GST ${Number(line.taxRate)}%` },
                    t
                  ),
                })}
              </UbText>
              {line.inboundUnitCost && line.trackStock && (
                <UbText variant="caption" tone="tertiary" className="ds-num">
                  {t('purchases.detail.stockCost', { cost: formatInr(line.inboundUnitCost) })}
                </UbText>
              )}
            </UbStack>
            <UbAmount value={line.lineTotal} size="sm" inline />
          </UbStack>
        ))}
      </UbStack>
      <UbStack gap={2} className="border-t border-border-hairline p-4">
        {row(t('purchases.totals.subtotal'), formatInr(bill.subtotal))}
        {bill.discountAmount !== '0.00' &&
          row(t('purchases.totals.discount'), `−${formatInr(bill.discountAmount)}`)}
        {row(t('purchases.totals.taxable'), formatInr(bill.taxableTotal))}
        {bill.igstTotal !== '0.00' ? (
          row(t('purchases.tax.igst'), formatInr(bill.igstTotal))
        ) : (
          <>
            {row(t('purchases.tax.cgst'), formatInr(bill.cgstTotal))}
            {row(t('purchases.tax.sgst'), formatInr(bill.sgstTotal))}
          </>
        )}
        {row(t('purchases.totals.roundOffShort'), formatInr(bill.roundOff))}
        <UbInfoRow
          label={t(
            order
              ? 'purchases.order.estimatedTotal'
              : note
                ? 'purchases.debitNote.total'
                : 'purchases.totals.grand'
          )}
          value={<UbAmount value={bill.grandTotal} size="md" />}
          variant="total"
        />
      </UbStack>
      {(isBill || bill.notes) && (
        <UbStack gap={2} className="border-t border-border-hairline p-4">
          {isBill &&
            row(
              t('purchases.detail.itc'),
              bill.itcEligible ? t('purchases.detail.itcYes') : t('purchases.detail.itcNo')
            )}
          {bill.notes && (
            <UbText variant="body-sm" className="whitespace-pre-wrap break-words">
              {bill.notes}
            </UbText>
          )}
        </UbStack>
      )}
    </UbPanel>
  );
}

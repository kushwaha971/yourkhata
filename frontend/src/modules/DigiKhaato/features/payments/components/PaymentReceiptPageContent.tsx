'use client';

import { useCallback, useRef, useState } from 'react';

import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';

import { Ban, Copy, MessageCircle, Printer, RotateCcw, Split } from 'lucide-react';

import {
  UbAmount,
  UbBottomBar,
  UbButton,
  UbEmptyState,
  UbInfoRow,
  UbLink,
  UbMoreActions,
  UbPageHeader,
  UbPageShell,
  UbPageSkeleton,
  UbPanel,
  UbShareSheet,
  UbStack,
  UbStatusBadge,
  UbStatusBanner,
  UbText,
  type UbMenuListRow,
} from 'src/design-system';
import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { usePermissions } from 'src/hooks/usePermissions';
import { useShareFeedback } from 'src/hooks/useShareFeedback';
import { useShareSheetLabels } from 'src/hooks/useShareSheetLabels';
import { useTranslation, type TranslateFn } from 'src/hooks/useTranslation';
import { selectLocale } from 'src/redux/slice/localeSlice';
import { selectNetworkImpaired } from 'src/redux/slice/networkSlice';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import { partyPath } from 'src/routes';
import { copyText } from 'src/utils/clipboard';
import { formatBusinessDate } from 'src/utils/dates';
import { formatAmount, formatInr, isZeroAmount } from 'src/utils/money';

import { usePaymentReceipt } from '../hooks/usePaymentReceipt';
import { allocationHref } from '../view-model/allocationLinks';
import { modeLabelIds } from '../view-model/paymentDisplay';

import type { Payment, PaymentContext } from '../types/payment.types';

/* The print sheet, the cancel dialog and the drawer load with the receipt or the tap. */
const ReceiptPrintLazy = dynamic(
  () => import('./print/PaymentReceiptPrint').then((m) => m.PaymentReceiptPrint),
  { ssr: false, loading: () => <UbPageSkeleton variant="card" /> }
);
const VoidDialogLazy = dynamic(
  () => import('./VoidPaymentDialog').then((m) => m.VoidPaymentDialog),
  { ssr: false }
);
const PaymentFormDrawerLazy = dynamic(
  () => import('./PaymentFormDrawer').then((m) => m.PaymentFormDrawer),
  { ssr: false }
);
/* A4a — Apply to bills loads with the tap, like the cancel dialog. */
const ApplyAdvanceDialogLazy = dynamic(
  () => import('./ApplyAdvanceDialog').then((m) => m.ApplyAdvanceDialog),
  { ssr: false }
);

/**
 * One settled bill as the panel says it: "INV-0412 · ₹200.00 · ₹245.00 still
 * due". The due is the bill's figure NOW, so a receipt opened a week later says
 * what is still owed rather than what was owed on the day.
 */
const settledLine = (t: TranslateFn, row: Payment['allocations'][number]): string => {
  const parts = [row.number ?? '—', formatInr(row.amount)];
  if (row.amountDue != null) {
    parts.push(
      isZeroAmount(row.amountDue)
        ? t('payments.receipt.paidInFull')
        : t('payments.receipt.stillDue', { amount: formatAmount(row.amountDue) })
    );
  }
  return parts.join(' · ');
};

/**
 * PAY-04 / PAY-05, 08 §10 — `/payments/{id}`: what came in or went out, in a
 * summary a counter can read at a glance (amount, how it was paid, which bills
 * it settled and what is still due on each), then the receipt as it will print
 * (A5).
 *
 * Share receipt is the primary act on a receipt: the customer standing at the
 * counter wants it on their phone. On a phone it is docked under the thumb with
 * Print and a ⋯ (Cancel receipt for an owner or admin, Ask owner to cancel for
 * staff), because three header buttons ran off a 390 px screen. On a desktop
 * the same three sit in the header, with the summary on the left and the print
 * on the right.
 *
 * A cancelled receipt stays here with its number, a grey "Cancelled on …"
 * banner and its reason, and offers Record again (FR-7), which opens the drawer
 * with the same contact, lines and amount. `?print=1` opens the print dialog on
 * arrival, the way the bill does.
 */
export function PaymentReceiptPageContent({ id }: Readonly<{ id: string }>): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const search = useSearchParams();
  const locale = useAppSelector(selectLocale);
  const impaired = useAppSelector(selectNetworkImpaired);
  const { can, hasModule } = usePermissions();
  const receipt = usePaymentReceipt(id, search?.get('print') === '1');
  const feedback = useShareFeedback();
  /* Two ⋯ triggers (the header's and the dock's), one visible at a time; the
     cancel dialog returns focus to the one that opened it. */
  const headerMore = useRef<HTMLButtonElement | null>(null);
  const dockMore = useRef<HTMLButtonElement | null>(null);
  const [voidFrom, setVoidFrom] = useState<'header' | 'dock'>('header');
  const applyButton = useRef<HTMLButtonElement | null>(null);
  const [voiding, setVoiding] = useState(false);
  const [applying, setApplying] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [again, setAgain] = useState<PaymentContext | null>(null);
  const payment = receipt.payment?.id === id ? receipt.payment : null;

  const labels = useShareSheetLabels();

  const { startShare, submitVoid, submitApply } = receipt;
  const confirmApply = useCallback(
    async (rows: Parameters<typeof submitApply>[0]) => {
      if (await submitApply(rows)) setApplying(false);
    },
    [submitApply]
  );
  const openShare = useCallback(async () => {
    if (await startShare()) setSharing(true);
  }, [startShare]);
  const confirmVoid = useCallback(
    async (reason: string) => {
      if (await submitVoid(reason)) setVoiding(false);
    },
    [submitVoid]
  );
  const askOwner = useCallback(async () => {
    if (!payment) return;
    const copied = await copyText(
      t('payments.void.askOwnerText', {
        number: payment.number,
        amount: formatAmount(payment.amount),
      })
    );
    dispatch(
      showSnackbar({
        severity: copied ? 'success' : 'error',
        id: copied ? 'share.copied' : 'share.copyFailed',
      })
    );
  }, [dispatch, payment, t]);

  const isVoid = payment?.status === 'void';
  const { canVoid, canShare } = receipt;
  /* The ⋯ holds the one act that undoes a receipt. An owner or admin cancels
     it (not offline: a cancel is not queued, §0.2); staff copy a message for
     the owner instead, which works without the internet. */
  const moreRows = useCallback(
    (docked: boolean): readonly UbMenuListRow[] => {
      if (!payment || isVoid) return [];
      if (canVoid) {
        return impaired
          ? []
          : [
              {
                key: 'cancel',
                label: t('payments.void.action'),
                caption: t('payments.void.actionHint'),
                icon: <Ban className="h-5 w-5" aria-hidden />,
                tone: 'danger',
                onSelect: () => {
                  setVoidFrom(docked ? 'dock' : 'header');
                  setVoiding(true);
                },
                testId: 'payment-void',
              },
            ];
      }
      /* Asking the owner is for a member who records payments; a read-only
         login has nothing to cancel. */
      if (!canShare) return [];
      return [
        {
          key: 'ask',
          label: t('payments.void.askOwner'),
          caption: t('payments.void.askOwnerHint'),
          icon: <Copy className="h-5 w-5" aria-hidden />,
          onSelect: () => void askOwner(),
          testId: 'payment-ask-owner',
        },
      ];
    },
    [payment, isVoid, canVoid, canShare, impaired, t, askOwner]
  );

  if (!(hasModule('payments') && can('payments.payment.read'))) {
    return (
      <UbPageShell>
        <UbEmptyState
          variant="firstUse"
          title={t('payments.noAccess.title')}
          description={t('payments.noAccess.body')}
        />
      </UbPageShell>
    );
  }
  if (receipt.status === 'failed') {
    return (
      <UbPageShell>
        <UbEmptyState
          variant="error"
          title={t('payments.receipt.error.title')}
          description={receipt.error?.message ?? t('payments.receipt.error.body')}
        />
      </UbPageShell>
    );
  }
  if (!payment) return <UbPageSkeleton variant="card" />;

  const canRecord = hasModule('payments') && can('payments.payment.write');
  const recordAgain =
    isVoid && canRecord && payment.party
      ? () =>
          setAgain({
            direction: payment.direction,
            partyId: payment.party?.id,
            partyName: payment.party?.name,
            presetLines: payment.modeBreakup,
            entry: 'again',
          })
      : null;
  const shareable = !isVoid && canShare;
  const modeIds = modeLabelIds(payment.modeBreakup);

  /* The same acts on a phone (docked, `size="lg"`) and a desktop (header). */
  const acts = (docked: boolean) => (
    <>
      {shareable && (
        <UbButton
          size={docked ? 'lg' : 'md'}
          icon={<MessageCircle className="h-4 w-4" aria-hidden />}
          busy={receipt.shareStatus === 'loading'}
          disabled={impaired}
          onClick={() => void openShare()}
          data-testid="payment-share"
        >
          {t('payments.receipt.share')}
        </UbButton>
      )}
      {recordAgain && (
        <UbButton
          size={docked ? 'lg' : 'md'}
          icon={<RotateCcw className="h-4 w-4" aria-hidden />}
          onClick={recordAgain}
          data-testid="payment-record-again"
        >
          {t('payments.void.recordAgain')}
        </UbButton>
      )}
      <UbButton
        variant={shareable || recordAgain ? 'secondary' : 'primary'}
        size={docked ? 'lg' : 'md'}
        icon={<Printer className="h-4 w-4" aria-hidden />}
        onClick={receipt.print}
        data-testid="payment-print"
      >
        {t('payments.receipt.print')}
      </UbButton>
      <UbMoreActions
        label={t('payments.receipt.more')}
        title={t('common.action.moreActions')}
        closeLabel={t('common.action.close')}
        rows={moreRows(docked)}
        triggerRef={docked ? dockMore : headerMore}
        size={docked ? 'lg' : 'md'}
        /* Docked beside two 44 px buttons, the ⋯ is their size too. */
        className={docked ? 'max-sm:h-11 max-sm:w-11' : undefined}
        testId="payment-more"
      />
    </>
  );

  return (
    <UbPageShell>
      <UbPageHeader
        className="ub-print-hide"
        title={payment.number}
        wrapTitle
        subtitle={payment.party?.name ?? t('payments.list.quickSale')}
        controls={
          <UbStack direction="row">
            {isVoid ? (
              <UbStatusBadge tone="neutral" label={t('payments.status.void')} />
            ) : (
              <UbStatusBadge
                tone={payment.direction === 'in' ? 'success' : 'info'}
                label={t(`payments.direction.${payment.direction}`)}
              />
            )}
          </UbStack>
        }
        actions={
          <UbStack direction="row" gap={2}>
            {acts(false)}
          </UbStack>
        }
        /* Below `lg` the header draws no actions: they are docked. */
        renderMobileActions={() => null}
      />
      <UbStack className="gap-4 xl:grid xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)] xl:items-start">
        <UbStack gap={4} className="ub-print-hide min-w-0">
          {isVoid && (
            <UbStatusBanner
              tone="neutral"
              title={
                payment.voidedBy?.name
                  ? t('payments.void.bannerBy', {
                      date: formatBusinessDate(payment.voidedAt),
                      name: payment.voidedBy.name,
                    })
                  : t('payments.void.banner', { date: formatBusinessDate(payment.voidedAt) })
              }
              description={
                payment.voidReason
                  ? t('payments.void.bannerReason', { reason: payment.voidReason })
                  : undefined
              }
            />
          )}
          {impaired && !isVoid && (
            <UbStatusBanner tone="offline" title={t('payments.receipt.offline')} />
          )}
          <UbPanel aria-label={t('payments.receipt.amount')}>
            <UbStack gap={3} className="p-4">
              <UbStack direction="row" justify="between" align="baseline" gap={3}>
                <UbText variant="body-sm" tone="secondary">
                  {t(`payments.direction.${payment.direction}`)}
                </UbText>
                {payment.direction === 'in' && !isVoid ? (
                  <UbAmount
                    value={payment.amount}
                    size="lg"
                    tone="receivable"
                    label={t('payments.direction.in')}
                    labelHidden
                  />
                ) : (
                  <UbAmount value={payment.amount} size="lg" />
                )}
              </UbStack>
              {/* How it was paid: one line per mode, so a split "₹150 cash +
                  ₹50 UPI" is read as two lines rather than worked out. */}
              <UbStack as="ul" gap={1} aria-label={t('payments.mode.label')}>
                {payment.modeBreakup.map((line, index) => (
                  <UbStack
                    as="li"
                    key={`${line.mode}-${index}`}
                    direction="row"
                    justify="between"
                    gap={3}
                  >
                    <UbText variant="body-sm" className="min-w-0 break-words">
                      {line.reference
                        ? `${t(modeIds[index] ?? `ledger.mode.${line.mode}`)} · ${line.reference}`
                        : t(modeIds[index] ?? `ledger.mode.${line.mode}`)}
                    </UbText>
                    <UbAmount value={line.amount} size="sm" inline />
                  </UbStack>
                ))}
              </UbStack>
            </UbStack>
            {/* 8 px between rows: the party and bill values are links, and
                stacked flush they were 14 px targets 16 px apart — under WCAG
                2.5.8's 24 px spacing floor (axe target-size, Sprint 12 sweep). */}
            <UbStack gap={2} className="border-t border-border-hairline p-4">
              <UbInfoRow
                label={t('payments.date')}
                value={formatBusinessDate(payment.paymentDate)}
              />
              {payment.party && (
                <UbInfoRow
                  label={t(
                    payment.direction === 'in' ? 'payments.party.from' : 'payments.party.to'
                  )}
                  value={<UbLink href={partyPath(payment.party.id)}>{payment.party.name}</UbLink>}
                />
              )}
              {payment.note && <UbInfoRow label={t('payments.note')} value={payment.note} />}
              {payment.createdBy?.name && (
                <UbInfoRow label={t('payments.recordedBy')} value={payment.createdBy.name} />
              )}
            </UbStack>
            {(payment.allocations.length > 0 || receipt.canApply) && (
              <UbStack gap={2} className="border-t border-border-hairline p-4">
                {payment.allocations.length > 0 && (
                  <UbText as="h2" variant="body-sm-medium">
                    {t('payments.receipt.settledHeading')}
                  </UbText>
                )}
                {payment.allocations.length > 0 && (
                  <UbStack as="ul" gap={2} aria-label={t('payments.receipt.settledHeading')}>
                    {payment.allocations.map((row) => (
                      <UbStack as="li" key={row.documentId} gap={0}>
                        <UbLink href={allocationHref(row)} className="break-words">
                          {settledLine(t, row)}
                        </UbLink>
                        {/* A4a — an allocation made after the receipt was
                            recorded says so, with the day it was applied. */}
                        {row.appliedLaterOn && (
                          <UbText variant="caption" tone="secondary">
                            {t('payments.receipt.appliedLater', {
                              date: formatBusinessDate(row.appliedLaterOn),
                            })}
                          </UbText>
                        )}
                      </UbStack>
                    ))}
                  </UbStack>
                )}
                {/* A4a (PLT-X03 §7) — money not yet used, and the way to use it.
                    Only where it can work (recorded, a contact's, not a refund
                    voucher) and for a member who may record payments. */}
                {receipt.canApply && (
                  <UbStack
                    direction="row"
                    justify="between"
                    align="center"
                    gap={3}
                    className="flex-wrap"
                  >
                    <UbText variant="body-sm">
                      {t('payments.apply.notYet', {
                        amount: formatAmount(payment.unallocatedAmount),
                      })}
                    </UbText>
                    <UbButton
                      ref={applyButton}
                      variant="secondary"
                      size="sm"
                      icon={<Split className="h-4 w-4" aria-hidden />}
                      disabled={impaired}
                      onClick={() => setApplying(true)}
                      data-testid="payment-apply"
                    >
                      {t('payments.apply.action')}
                    </UbButton>
                  </UbStack>
                )}
              </UbStack>
            )}
          </UbPanel>
        </UbStack>
        {/* A region that scrolls sideways on a phone must be reachable by
            keyboard, and named, or its right half is unreadable without a
            pointer (axe scrollable-region-focusable, Sprint 12 sweep). */}
        <UbStack
          role="region"
          aria-label={t('payments.receipt.preview')}
          tabIndex={0}
          className="min-w-0 overflow-x-auto rounded-card border border-border-hairline bg-white print:overflow-visible print:rounded-none print:border-0"
        >
          {/* The sheet at its A5 width: squeezed into a phone it split
              "INV/25-26/5877" over three lines in the Against column, which
              the paper never does. It scrolls sideways here instead (08 §10). */}
          <UbStack className="min-w-[148mm] print:min-w-0">
            <ReceiptPrintLazy
              payment={payment}
              branding={receipt.branding}
              staticQr={receipt.staticQr}
              locale={locale}
              t={t}
              perspective="merchant"
            />
          </UbStack>
        </UbStack>
      </UbStack>

      {/* The phone's dock: the primary act first and widest, then Print and ⋯.
          Sticky in the page column like the khata's, so it rides above the
          phone's bottom menu (`--ub-nav-offset`) instead of under it, and
          `clearToBottom` makes the snackbar clear the dock AND the menu under
          it: measuring the dock's own height let "… cancelled" sit on top of
          Record again (LOOK, 24 Oct). */}
      <UbBottomBar
        clearToBottom
        role="region"
        aria-label={t('payments.receipt.actions', { number: payment.number })}
        data-testid="payment-dock"
        className="ub-print-hide -mx-4 mt-4 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2 border-t border-border-hairline bg-surface-card px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-3 lg:hidden"
      >
        {acts(true)}
      </UbBottomBar>

      {voiding && (
        <VoidDialogLazy
          payment={payment}
          busy={receipt.voidStatus === 'loading'}
          errors={receipt.voidErrors}
          onClose={() => setVoiding(false)}
          onConfirm={(reason) => void confirmVoid(reason)}
          returnFocusRef={voidFrom === 'dock' ? dockMore : headerMore}
        />
      )}
      {applying && (
        <ApplyAdvanceDialogLazy
          payment={payment}
          documents={receipt.applyCandidates}
          status={receipt.applyCandidatesStatus}
          busy={receipt.applyStatus === 'loading'}
          errors={receipt.applyErrors}
          onLoad={receipt.loadApplyCandidates}
          onClose={() => setApplying(false)}
          onConfirm={(rows) => void confirmApply(rows)}
          returnFocusRef={applyButton}
        />
      )}
      {sharing && receipt.shareText && (
        <UbShareSheet
          open
          onOpenChange={(next) => !next && setSharing(false)}
          title={t('payments.receipt.share')}
          description={t(`payments.receipt.shareAbout.${payment.direction}`, {
            number: payment.number,
            amount: formatAmount(payment.amount),
            name: payment.party?.name ?? t('payments.list.quickSale'),
          })}
          /* 08 §10.2 — the honest line: we open their app, they press Send. */
          notice={
            <UbText variant="caption" tone="secondary">
              {t('payments.receipt.shareHonest')}
            </UbText>
          }
          message={receipt.shareText}
          phone={receipt.shareMobile}
          labels={labels}
          onShared={feedback.onShared}
          onFailed={feedback.onFailed}
        />
      )}
      {again && <PaymentFormDrawerLazy context={again} onClose={() => setAgain(null)} />}
    </UbPageShell>
  );
}

'use client';

import { useEffect, useId, useRef, useState, type RefObject } from 'react';

import { CompactDialog } from 'src/components/records/CompactOverlays';
import {
  UbBox,
  UbButton,
  UbMoneyInput,
  UbShareSheet,
  UbSkeleton,
  UbStack,
  UbStatusBanner,
  UbText,
} from 'src/design-system';
import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { useIdempotencyKey } from 'src/hooks/useIdempotencyKey';
import { useShareSheetLabels } from 'src/hooks/useShareSheetLabels';
import { useTranslation } from 'src/hooks/useTranslation';
import { selectLocale } from 'src/redux/slice/localeSlice';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import type { ApiErrorShape } from 'src/types/api.types';
import { formatInr } from 'src/utils/money';
import { formatPhoneForDisplay } from 'src/utils/share';

import {
  fetchSettlementFigures,
  fetchSettlementMessage,
  settleBalances,
} from '../api/shopSettlementService';
import {
  balancesAfter,
  canSettle,
  checkAmount,
  settledDocuments,
  type SettlementPick,
} from '../view-model/settlementFacts';

import type { SettlementFigures, ShopSettlement } from '../types/shopSettlement.types';

// Loaded with dynamic(), so its own words come with its own chunk.
import 'src/i18n/catalogues/shopSettlement';

type Load =
  | { readonly status: 'loading' }
  | { readonly status: 'failed' }
  | { readonly status: 'ready'; readonly figures: SettlementFigures };

type Message =
  | { readonly status: 'loading' }
  | { readonly status: 'failed' }
  | { readonly status: 'ready'; readonly text: string; readonly mobile: string | null };

const MONEY_BOX = 'grid gap-0.5 rounded-card border border-border-default px-3 py-2.5';
/** A side shows this many bills by number; the rest are counted. */
const SHOWN_PICKS = 3;

/**
 * BP-08 — "Settle {name}'s two balances · No cash changes hands" (Counter Mode
 * `#customers`). The one explicit step that may set what a customer owes against
 * what the shop owes the same person as a supplier (D-03).
 *
 * Both balances are read fresh when it opens, the amount is prefilled with the
 * smaller and capped at it, and "After this" shows both results before anything
 * is written. The server re-reads both under a lock and refuses when they moved
 * (another device billed or paid meanwhile); the dialog then shows the new
 * figures instead of settling numbers the merchant did not agree to. Keep
 * separate has the focus, so Enter never settles by accident. After a
 * settlement the merchant may send the message, editing it first.
 */
export function SettleBalancesDialog({
  partyId,
  onClose,
  onSettled,
  returnFocusRef,
}: Readonly<{
  partyId: string;
  onClose: () => void;
  onSettled?: (settlement: ShopSettlement) => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}>): React.JSX.Element {
  const { t } = useTranslation();
  /* The message's language is the app's, `en` or `hi` — what the receipt share sends. */
  const locale = useAppSelector(selectLocale);
  const dispatch = useAppDispatch();
  const baseId = useId();
  const labels = useShareSheetLabels(false);
  const { key, rotate } = useIdempotencyKey();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<ShopSettlement | null>(null);
  const [message, setMessage] = useState<Message>({ status: 'loading' });
  const inFlight = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchSettlementFigures(partyId, controller.signal)
      .then((figures) => {
        setLoad({ status: 'ready', figures });
        setAmount(canSettle(figures.maxAmount) ? figures.maxAmount : '');
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoad({ status: 'failed' });
      });
    return () => controller.abort();
  }, [partyId, attempt]);

  useEffect(() => {
    if (!done) return;
    let live = true;
    fetchSettlementMessage(done.id, locale)
      .then((reply) => live && setMessage({ status: 'ready', ...reply }))
      .catch(() => live && setMessage({ status: 'failed' }));
    return () => {
      live = false;
    };
  }, [done, locale]);

  const figures = load.status === 'ready' ? load.figures : null;
  const name = figures?.party.name ?? '';
  const dual = !!figures && figures.party.isCustomer && figures.party.isSupplier;
  const archived = figures?.party.status === 'archived';
  const settleable = !!figures && dual && !archived && canSettle(figures.maxAmount);
  const check = figures ? checkAmount(amount, figures.maxAmount) : 'empty';
  const after = figures ? balancesAfter(figures, amount, figures.maxAmount) : null;
  const invoicePicks = figures
    ? settledDocuments(figures.documents.invoices, amount, figures.maxAmount)
    : [];
  const billPicks = figures
    ? settledDocuments(figures.documents.bills, amount, figures.maxAmount)
    : [];
  /* One line per side: "Bills  INV/26-27/0001 ₹500.00 · INV/26-27/0002 ₹30.00". */
  const pickLine = (label: string, picks: readonly SettlementPick[], testId: string) =>
    picks.length > 0 && (
      <UbBox className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5" data-testid={testId}>
        <UbText variant="caption" tone="tertiary" className="basis-full">
          {label}
        </UbText>
        {picks.slice(0, SHOWN_PICKS).map((pick) => (
          <UbText key={pick.number} variant="body-sm" className="whitespace-nowrap tabular-nums">
            {pick.number} {formatInr(pick.amount)}
          </UbText>
        ))}
        {picks.length > SHOWN_PICKS && (
          <UbText variant="body-sm" tone="secondary">
            {t('shopSettlement.settlesMore', { count: picks.length - SHOWN_PICKS })}
          </UbText>
        )}
      </UbBox>
    );

  const refused = (error: ApiErrorShape) => {
    const details = (error.details ?? {}) as Record<string, unknown>;
    if (
      figures &&
      (error.code === 'settlement_balances_changed' || error.code === 'settlement_over_balance') &&
      typeof details.max_amount === 'string'
    ) {
      // Show what is true now; the merchant confirms again against these figures.
      const next: SettlementFigures = {
        ...figures,
        customerBalance: String(details.customer_balance ?? figures.customerBalance),
        supplierBalance: String(details.supplier_balance ?? figures.supplierBalance),
        maxAmount: details.max_amount,
      };
      setLoad({ status: 'ready', figures: next });
      setAmount(canSettle(next.maxAmount) ? next.maxAmount : '');
      rotate();
      dispatch(showSnackbar({ severity: 'warning', id: 'shopSettlement.changed' }));
      return;
    }
    const id =
      error.code === 'settlement_not_dual_role'
        ? 'shopSettlement.notDual'
        : error.code === 'party_archived'
          ? 'shopSettlement.archived'
          : null;
    if (id) {
      rotate();
      dispatch(showSnackbar({ severity: 'error', id }));
      setAttempt((n) => n + 1);
      return;
    }
    // A timeout or a server fault: the same key goes with the retry, so it settles once.
    dispatch(showSnackbar({ severity: 'error', message: error.message }));
  };

  const submit = async () => {
    if (!figures || check !== 'ok' || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const settlement = await settleBalances(
        {
          partyId,
          amount: amount.trim(),
          expected: {
            customerBalance: figures.customerBalance,
            supplierBalance: figures.supplierBalance,
          },
        },
        key
      );
      rotate();
      dispatch(
        showSnackbar({
          severity: 'success',
          id: 'shopSettlement.done',
          params: { amount: formatInr(settlement.amount), name },
        })
      );
      onSettled?.(settlement);
      setDone(settlement);
    } catch (thrown) {
      refused(thrown as ApiErrorShape);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  if (done) {
    return (
      <UbShareSheet
        open
        onOpenChange={(next) => !next && onClose()}
        title={t('shopSettlement.shareTitle', { name })}
        description={
          message.status === 'ready' && message.mobile
            ? `${name} · ${formatPhoneForDisplay(message.mobile)}`
            : name
        }
        message={message.status === 'ready' ? message.text : ''}
        phone={message.status === 'ready' ? message.mobile : null}
        labels={labels}
        returnFocusRef={returnFocusRef}
        pending={
          message.status === 'loading' ? (
            <UbSkeleton variant="card" />
          ) : message.status === 'failed' ? (
            <UbStatusBanner tone="error" title={t('shopSettlement.messageFailed')} />
          ) : undefined
        }
      />
    );
  }

  const amountHint =
    check === 'over' && figures
      ? t('shopSettlement.overMax', { amount: formatInr(figures.maxAmount) })
      : check === 'invalid' || check === 'zero'
        ? t('shopSettlement.badAmount')
        : figures
          ? t('shopSettlement.upTo', { amount: formatInr(figures.maxAmount) })
          : '';

  return (
    <CompactDialog
      open
      onOpenChange={(next) => !next && onClose()}
      title={t('shopSettlement.title')}
      description={name ? t('shopSettlement.subtitle', { name }) : t('shopSettlement.noCash')}
      closeLabel={t('common.action.close')}
      returnFocusRef={returnFocusRef}
      footer={
        <>
          <UbButton variant="secondary" onClick={onClose} disabled={busy} autoFocus>
            {t('shopSettlement.keep')}
          </UbButton>
          {settleable && (
            <UbButton
              busy={busy}
              busyLabel={t('shopSettlement.settling')}
              disabled={check !== 'ok'}
              onClick={() => void submit()}
              data-testid="settle-confirm"
            >
              {check === 'ok'
                ? t('shopSettlement.settle', { amount: formatInr(amount.trim()) })
                : t('shopSettlement.settlePlain')}
            </UbButton>
          )}
        </>
      }
    >
      {load.status === 'loading' && <UbSkeleton variant="card" />}
      {load.status === 'failed' && (
        <UbStack gap={2}>
          <UbStatusBanner tone="error" title={t('shopSettlement.loadFailed')} />
          <UbButton
            variant="secondary"
            size="sm"
            className="ub-hit self-start"
            onClick={() => {
              setLoad({ status: 'loading' });
              setAttempt((n) => n + 1);
            }}
          >
            {t('common.action.retry')}
          </UbButton>
        </UbStack>
      )}
      {figures && (
        <UbStack gap={3} data-testid="settle-body">
          <UbBox className="grid grid-cols-2 gap-2">
            <UbBox className={MONEY_BOX} data-testid="settle-customer">
              <UbText variant="caption" tone="tertiary">
                {t('shopSettlement.asCustomer')}
              </UbText>
              <UbText variant="metric-sm" tone="success" className="tabular-nums">
                {formatInr(figures.customerBalance)}
              </UbText>
            </UbBox>
            <UbBox className={MONEY_BOX} data-testid="settle-supplier">
              <UbText variant="caption" tone="tertiary">
                {t('shopSettlement.asSupplier')}
              </UbText>
              <UbText variant="metric-sm" tone="error" className="tabular-nums">
                {formatInr(figures.supplierBalance)}
              </UbText>
            </UbBox>
          </UbBox>

          {!dual && <UbStatusBanner tone="info" title={t('shopSettlement.notDual')} />}
          {dual && archived && <UbStatusBanner tone="info" title={t('shopSettlement.archived')} />}
          {dual && !archived && !canSettle(figures.maxAmount) && (
            <UbStatusBanner tone="info" title={t('shopSettlement.nothing')} />
          )}

          {settleable && after && (
            <>
              <UbStack gap={1}>
                <UbText as="label" htmlFor={`${baseId}-amount`} variant="label">
                  {t('shopSettlement.amount')}
                </UbText>
                <UbMoneyInput
                  id={`${baseId}-amount`}
                  value={amount}
                  onChange={setAmount}
                  inputMode="decimal"
                  invalid={check === 'over' || check === 'invalid' || check === 'zero'}
                  aria-describedby={`${baseId}-hint`}
                  data-testid="settle-amount"
                />
                <UbText
                  id={`${baseId}-hint`}
                  variant="caption"
                  tone={check === 'ok' || check === 'empty' ? 'tertiary' : 'formError'}
                >
                  {amountHint}
                </UbText>
              </UbStack>
              <UbBox
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-card bg-surface-sunken px-3 py-2"
                data-testid="settle-after"
              >
                {/* Its own line, so the two results line up under it on a phone. */}
                <UbText variant="caption" tone="tertiary" className="basis-full">
                  {t('shopSettlement.after')}
                </UbText>
                <UbText variant="body-sm">
                  {t('shopSettlement.afterCustomer', {
                    amount: formatInr(after.customerBalance),
                  })}
                </UbText>
                <UbText variant="body-sm">
                  {t('shopSettlement.afterSupplier', {
                    amount: formatInr(after.supplierBalance),
                  })}
                </UbText>
              </UbBox>
              {(invoicePicks.length > 0 || billPicks.length > 0) && (
                <UbStack
                  gap={2}
                  className="border-border-default rounded-card border px-3 py-2"
                  data-testid="settle-documents"
                >
                  <UbText variant="label">{t('shopSettlement.settles')}</UbText>
                  {pickLine(t('shopSettlement.settlesBills'), invoicePicks, 'settle-invoices')}
                  {pickLine(t('shopSettlement.settlesPurchases'), billPicks, 'settle-bills')}
                </UbStack>
              )}
              <UbText variant="body-sm" tone="secondary">
                {t('shopSettlement.honest', {
                  amount: formatInr(check === 'ok' ? amount.trim() : figures.maxAmount),
                  name,
                })}
              </UbText>
            </>
          )}
        </UbStack>
      )}
    </CompactDialog>
  );
}

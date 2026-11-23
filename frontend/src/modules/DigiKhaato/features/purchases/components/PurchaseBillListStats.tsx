'use client';
import { RecordTotals } from 'src/components/records/RecordTotals';
import { useTranslation } from 'src/hooks/useTranslation';

import type { PurchaseBillTotals, PurchaseKind } from '../types/purchase.types';
/** The server's filtered totals, never a page sum or customer balance. Orders owe no money. */
const NONE: PurchaseBillTotals = { count: 0, grandTotal: '0.00', amountDue: '0.00' };

export function PurchaseBillListStats({
  totals,
  order = false,
  kind = 'purchase_bill',
  loading = false,
}: Readonly<{
  totals: PurchaseBillTotals | null;
  order?: boolean;
  kind?: PurchaseKind;
  loading?: boolean;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const shown = totals ?? NONE;
  return (
    <RecordTotals
      compactShort
      countInMobileChips
      label={t('purchases.list.filteredTotals')}
      count={shown.count}
      countLabel={t(
        order
          ? 'purchases.order.count'
          : kind === 'debit_note'
            ? 'purchases.debitNote.count'
            : 'purchases.total.count'
      )}
      testId="purchase-register-summary"
      loading={loading && !totals}
      figures={
        order
          ? [{ key: 'ordered', label: t('purchases.order.onOrder'), amount: shown.grandTotal }]
          : [
              {
                key: 'bought',
                label: t(
                  kind === 'debit_note' ? 'purchases.debitNote.returned' : 'purchases.total.bought'
                ),
                amount: shown.grandTotal,
              },
              {
                key: 'due',
                label: t(
                  kind === 'debit_note' ? 'purchases.debitNote.openCredit' : 'purchases.total.toPay'
                ),
                amount: shown.amountDue,
                tone: kind === 'debit_note' ? 'neutral' : 'payable',
              },
            ]
      }
    />
  );
}

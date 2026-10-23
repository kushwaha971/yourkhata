'use client';
import { RecordTotals } from 'src/components/records/RecordTotals';
import { useTranslation } from 'src/hooks/useTranslation';

import type { PurchaseBillTotals, PurchaseKind } from '../types/purchase.types';
/** The server's filtered totals, never a page sum or customer balance. Orders owe no money. */
export function PurchaseBillListStats({
  totals,
  order = false,
  kind = 'purchase_bill',
}: Readonly<{
  totals: PurchaseBillTotals;
  order?: boolean;
  kind?: PurchaseKind;
}>): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <RecordTotals
      compactShort
      countInMobileChips
      label={t('purchases.list.filteredTotals')}
      count={totals.count}
      countLabel={t(
        order
          ? 'purchases.order.count'
          : kind === 'debit_note'
            ? 'purchases.debitNote.count'
            : 'purchases.total.count'
      )}
      testId="purchase-register-summary"
      figures={
        order
          ? [{ key: 'ordered', label: t('purchases.order.onOrder'), amount: totals.grandTotal }]
          : [
              {
                key: 'bought',
                label: t(
                  kind === 'debit_note' ? 'purchases.debitNote.returned' : 'purchases.total.bought'
                ),
                amount: totals.grandTotal,
              },
              {
                key: 'due',
                label: t(
                  kind === 'debit_note' ? 'purchases.debitNote.openCredit' : 'purchases.total.toPay'
                ),
                amount: totals.amountDue,
                tone: kind === 'debit_note' ? 'neutral' : 'payable',
              },
            ]
      }
    />
  );
}

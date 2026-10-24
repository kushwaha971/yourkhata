'use client';
import { RecordTotals } from 'src/components/records/RecordTotals';
import { useTranslation } from 'src/hooks/useTranslation';

import type { PaymentTotals } from '../types/payment.types';

/**
 * 08 §9 — Received and Paid out, each with how many, over the FILTERED set and
 * never netted: money in and money out are two different questions. Cancelled
 * payments are not counted; that money did not move. Money in is green, money
 * out plain ink, as in the rows.
 */
export function PaymentListStats({
  totals,
}: Readonly<{ totals: PaymentTotals }>): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <RecordTotals
      compactShort
      countInMobileChips
      label={t('payments.list.filteredTotals')}
      count={totals.countIn + totals.countOut}
      countLabel={t('payments.list.countWord')}
      testId="payment-register-summary"
      figures={[
        {
          key: 'in',
          label: t('payments.total.inCount', { count: totals.countIn }),
          amount: totals.amountIn,
          tone: 'receivable',
        },
        {
          key: 'out',
          label: t('payments.total.outCount', { count: totals.countOut }),
          amount: totals.amountOut,
        },
      ]}
    />
  );
}

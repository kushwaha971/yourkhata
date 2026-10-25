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
const NONE: PaymentTotals = {
  count: 0,
  countIn: 0,
  countOut: 0,
  amountIn: '0.00',
  amountOut: '0.00',
};

export function PaymentListStats({
  totals: given,
  loading = false,
}: Readonly<{ totals: PaymentTotals | null; loading?: boolean }>): React.JSX.Element {
  const { t } = useTranslation();
  const totals = given ?? NONE;
  return (
    <RecordTotals
      compactShort
      countInMobileChips
      label={t('payments.list.filteredTotals')}
      count={totals.countIn + totals.countOut}
      countLabel={t('payments.list.countWord')}
      testId="payment-register-summary"
      loading={loading && !given}
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

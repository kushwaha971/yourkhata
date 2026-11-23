'use client';
import { RecordTotals } from 'src/components/records/RecordTotals';
import { useTranslation } from 'src/hooks/useTranslation';

import type { InvoiceListTotals } from '../types/sales.types';
/** Totals are over the filtered set, never the visible page or a client sum. */
const NONE: InvoiceListTotals = { count: 0, grandTotal: '0.00', amountDue: '0.00' };

export function InvoiceListStats({
  totals,
  loading = false,
}: Readonly<{ totals: InvoiceListTotals | null; loading?: boolean }>): React.JSX.Element {
  const { t } = useTranslation();
  const shown = totals ?? NONE;
  return (
    <RecordTotals
      compactShort
      countInMobileChips
      label={t('sales.list.filteredTotals')}
      count={shown.count}
      countLabel={t('sales.total.count')}
      testId="invoice-register-summary"
      loading={loading && !totals}
      figures={[
        { key: 'billed', label: t('sales.total.billed'), amount: shown.grandTotal },
        { key: 'due', label: t('sales.total.due'), amount: shown.amountDue, tone: 'receivable' },
      ]}
    />
  );
}

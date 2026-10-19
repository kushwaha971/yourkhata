'use client';
import { RecordTotals } from 'src/components/records/RecordTotals';
import { useTranslation } from 'src/hooks/useTranslation';

import type { InvoiceListTotals } from '../types/sales.types';
/** Totals are over the filtered set, never the visible page or a client sum. */
export function InvoiceListStats({
  totals,
}: Readonly<{ totals: InvoiceListTotals }>): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <RecordTotals
      label={t('sales.list.filteredTotals')}
      count={totals.count}
      countLabel={t('sales.total.count')}
      testId="invoice-register-summary"
      figures={[
        { key: 'billed', label: t('sales.total.billed'), amount: totals.grandTotal },
        { key: 'due', label: t('sales.total.due'), amount: totals.amountDue, tone: 'receivable' },
      ]}
    />
  );
}

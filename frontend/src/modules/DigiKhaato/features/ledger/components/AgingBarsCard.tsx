'use client';

import { useMemo } from 'react';

import { UbAgingBars, UbChartCard } from 'src/design-system/charts';
import type { TranslateFn } from 'src/hooks/useTranslation';
import { formatBusinessDate } from 'src/utils/dates';
import { formatInr } from 'src/utils/money';

import { AGING_BUCKETS } from '../types/aging.types';
import { bucketLabelId } from '../view-model/agingDisplay';

import type { AgingAmounts } from '../types/aging.types';

/**
 * 09 §10.7 — the Shop's Old dues answered first: the four buckets as the design
 * system's aging bars (one hue, darker as the money ages), with the table view
 * the chart card carries for every chart. The totals are the server's, over the
 * filtered set (BR-5), so they add up to the list under them.
 */
export function AgingBarsCard({
  t,
  totals,
  asOf,
}: Readonly<{
  t: TranslateFn;
  totals: AgingAmounts;
  asOf: string;
}>): React.JSX.Element {
  const buckets = useMemo(
    () =>
      AGING_BUCKETS.map((bucket) => ({
        key: bucket,
        label: t(bucketLabelId(bucket)),
        amount: totals[bucket],
      })),
    [t, totals]
  );
  const title = t('ledger.aging.bars.title');
  return (
    <UbChartCard
      title={title}
      description={t('ledger.aging.bars.hint', { date: formatBusinessDate(asOf) })}
      viewLabels={{ chart: t('ledger.aging.view.chart'), table: t('ledger.aging.view.table') }}
      table={{
        caption: title,
        columns: [
          { key: 'age', label: t('ledger.aging.column.age') },
          { key: 'amount', label: t('ledger.aging.total'), numeric: true },
        ],
        rows: buckets.map((bucket) => ({
          key: bucket.key,
          cells: [bucket.label, formatInr(bucket.amount)],
        })),
      }}
    >
      {(a11y) => (
        <UbAgingBars
          buckets={buckets}
          labelledBy={a11y.labelledBy}
          describedBy={a11y.describedBy}
        />
      )}
    </UbChartCard>
  );
}

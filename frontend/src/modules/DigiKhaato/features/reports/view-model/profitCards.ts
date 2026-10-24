import type { TranslateFn } from 'src/hooks/useTranslation';
import { formatBusinessDate } from 'src/utils/dates';
import { absMoney } from 'src/utils/money';
import { formatInrUnbroken } from 'src/utils/moneyUnbroken';
import { formatQuantity } from 'src/utils/quantity';

import { isLoss } from './profitDisplay';

import type { ReportCard } from '../components/ReportCardRow';
import type { ProfitGroup, ProfitRow } from '../types/profitReport.types';

/**
 * 09 §10.6 on a phone — a profit row as a card: the name, what it covers and
 * "Sold ₹12,400", and on the right the profit in words ("Profit" or "Loss",
 * never colour alone) with the margin under it. A row whose cost is unknown
 * says so instead of a profit.
 */

/** "Loss ₹200.00" or "Profit ₹1,120.00": the word and the unsigned figure. */
export const profitWords = (
  t: TranslateFn,
  profit: string | null
): { word: string; value: string | null; loss: boolean } => {
  const loss = isLoss(profit);
  return {
    word: t(loss ? 'reports.profit.card.loss' : 'reports.profit.card.profit'),
    value: profit === null ? null : loss ? absMoney(profit) : profit,
    loss,
  };
};

const covers = (t: TranslateFn, group: ProfitGroup, row: ProfitRow): string[] => {
  const bills = t('reports.profit.bills', { count: row.bills });
  if (group === 'item' && row.qty) return [formatQuantity(row.qty, row.unit ?? undefined), bills];
  if (group === 'bill')
    return [
      ...(row.date ? [formatBusinessDate(row.date)] : []),
      row.party?.name ?? t('reports.profit.unnamed.party'),
    ];
  return [bills];
};

export const profitCard =
  (t: TranslateFn, group: ProfitGroup, name: (row: ProfitRow) => string) =>
  (row: ProfitRow): ReportCard => {
    const what = name(row);
    const sold = t('reports.profit.card.sold', { amount: formatInrUnbroken(row.saleValue) });
    const words = profitWords(t, row.profit);
    const margin =
      row.marginPct === null
        ? undefined
        : t('reports.profit.tile.margin', { value: row.marginPct });
    return {
      what,
      which: [
        ...covers(t, group, row).map((text) => ({ text })),
        { text: sold },
        ...(row.uncostedLines > 0
          ? [
              {
                text: t('reports.profit.uncostedRow', { count: row.uncostedLines }),
                tone: 'error' as const,
                wrap: true,
              },
            ]
          : []),
      ],
      amount: {
        word: words.word,
        value: words.value,
        ...(words.value === null ? { display: t('reports.profit.card.noCost') } : {}),
        tone: words.loss ? 'error' : 'success',
        ...(margin ? { note: margin } : {}),
      },
      struck: false,
      label: t('reports.profit.card.open', {
        name: [
          what,
          sold,
          words.value === null
            ? t('reports.profit.card.noCost')
            : `${words.word} ${formatInrUnbroken(words.value)}`,
        ].join(' · '),
      }),
    };
  };

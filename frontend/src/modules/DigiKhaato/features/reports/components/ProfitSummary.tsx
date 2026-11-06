'use client';

import { FigureBox, type Figure } from 'src/components/stats/FigureBox';
import { UbInfoRow, UbPanel, UbStack, UbStatusBanner, UbText } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';
import { absMoney, formatInr } from 'src/utils/money';

import { profitWords } from '../view-model/profitCards';
import { isLoss } from '../view-model/profitDisplay';

import type { ProfitTotals } from '../types/profitReport.types';

/**
 * The period's P&L, over EVERY bill in it — not the page, not the search:
 * sales, the cost of what was sold, profit and margin (09 §10.6), the basis
 * of the cost in one line, and — when the shop keeps expenses here — the
 * expenses and what is left, the "did we make money" line Vyapar, myBillBook
 * and Marg all put at the top.
 *
 * A loss is a word as well as a colour (R-A-2): "Gross loss ₹200.00", the
 * figure unsigned beside the word.
 */
export function ProfitSummary({ totals }: Readonly<{ totals: ProfitTotals }>): React.JSX.Element {
  const { t } = useTranslation();
  const gross = profitWords(t, totals.profit);
  const net = totals.netProfit !== null && isLoss(totals.netProfit);
  const dash = '—';
  // 09 §10.6: Sales · Cost · Profit · Margin, always in view.
  const figures: Figure[] = [
    {
      key: 'sales',
      label: t('reports.profit.tile.sales'),
      value: formatInr(totals.saleValue),
      caption: t('reports.profit.bills', { count: totals.bills }),
    },
    {
      key: 'cost',
      label: t('reports.profit.tile.cost'),
      value: totals.cost === null ? dash : formatInr(totals.cost),
      caption: t('reports.profit.figure.cost'),
    },
    {
      key: 'profit',
      label: t(gross.loss ? 'reports.profit.tile.grossLoss' : 'reports.profit.tile.gross'),
      value: gross.value === null ? dash : formatInr(gross.value),
      caption: t('reports.profit.figure.profit'),
      tone: gross.loss ? 'error' : 'success',
    },
    {
      key: 'margin',
      label: t('reports.profit.column.margin'),
      value:
        totals.marginPct === null ? dash : t('reports.profit.percent', { value: totals.marginPct }),
      caption: t('reports.profit.figure.margin'),
    },
  ];
  return (
    <>
      <FigureBox
        figures={figures}
        label={t('reports.profit.summary')}
        testId="profit-figures"
        figureTestId="profit-figure"
      />
      <UbText variant="caption" tone="tertiary" data-testid="profit-basis">
        {t('reports.profit.basis')}
      </UbText>
      {totals.expenses !== null && totals.netProfit !== null && (
        <UbPanel as="section" aria-label={t('reports.profit.afterExpenses')}>
          <UbStack gap={0} className="px-4 py-2" data-testid="profit-after-expenses">
            <UbInfoRow
              label={t('reports.profit.tile.expenses')}
              value={formatInr(totals.expenses)}
            />
            <UbInfoRow
              variant="total"
              label={t(net ? 'reports.profit.tile.netLoss' : 'reports.profit.tile.net')}
              value={formatInr(net ? absMoney(totals.netProfit) : totals.netProfit)}
            />
          </UbStack>
        </UbPanel>
      )}
      {totals.uncostedLines > 0 && (
        <UbStatusBanner
          tone="warning"
          title={t('reports.profit.uncosted.title', { count: totals.uncostedLines })}
          description={t('reports.profit.uncosted.body')}
        />
      )}
    </>
  );
}

'use client';

import { UbAmount, UbStack, UbTag, UbText, isUbTagColor } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';
import { formatInr } from 'src/utils/money';

import type { ExpenseTotals } from '../types/expense.types';

/** 08 §12 names three; the server sends up to five. */
const TOP = 3;

/**
 * 08 §12 — "Total ₹41,230 · 62 expenses" over the FILTERED set, and the top
 * three categories under it. One line each, so the cards keep the screen
 * (R-DEC-33). On the Cancelled chip the figure is money that did NOT go out,
 * so it says Cancelled rather than Total.
 */
export function ExpenseListStats({
  totals,
  cancelled,
}: Readonly<{ totals: ExpenseTotals; cancelled: boolean }>): React.JSX.Element {
  const { t } = useTranslation();
  const top = totals.byCategory.slice(0, TOP);
  return (
    <UbStack gap={1} className="py-1" role="status" data-testid="expense-register-summary">
      <UbStack direction="row" align="baseline" className="flex-wrap gap-x-2 gap-y-1">
        <UbAmount
          value={totals.amount}
          size="sm"
          inline
          label={t(cancelled ? 'expenses.total.cancelled' : 'expenses.total.label')}
          className="flex-row-reverse items-baseline gap-1.5"
        />
        <UbText as="span" variant="body-sm" tone="secondary">
          {`· ${t('expenses.total.count', { count: totals.count })}`}
        </UbText>
      </UbStack>
      {!cancelled && top.length > 0 && (
        /* One line on a phone, scrolling sideways: wrapped, the three
           categories took two lines at 390 px and three at 320 px, all of it
           out of the cards' room (R-DEC-33). */
        <UbStack
          direction="row"
          align="center"
          className="gap-x-3 gap-y-1 max-md:flex-nowrap max-md:overflow-x-auto max-md:[&>*]:shrink-0 md:flex-wrap"
          data-testid="expense-register-top"
        >
          <UbText as="span" variant="caption" tone="tertiary">
            {t('expenses.total.top')}
          </UbText>
          {/* The chip carries the NAME only and the figure sits beside it: a
              tag caps its width, and "Salaries ₹5,00…" cut the half of the
              chip that answers "how much". */}
          {top.map((row) => (
            <UbStack key={row.categoryId} direction="row" align="center" className="gap-1">
              <UbTag name={row.name} color={isUbTagColor(row.color) ? row.color : null} />
              <UbText as="span" variant="caption" className="ds-num">
                {formatInr(row.amount)}
              </UbText>
            </UbStack>
          ))}
        </UbStack>
      )}
    </UbStack>
  );
}

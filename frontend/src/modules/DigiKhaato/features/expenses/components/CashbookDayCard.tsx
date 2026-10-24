'use client';

import { ChevronRight } from 'lucide-react';

import {
  UbAmount,
  UbDisclosure,
  UbDivider,
  UbPressable,
  UbStack,
  UbText,
} from 'src/design-system';
import type { TranslateFn } from 'src/hooks/useTranslation';
import { formattingLocale } from 'src/i18n/formattingLocale';
import { formatBusinessDate } from 'src/utils/dates';

import { cashFigure } from '../view-model/cashFigure';
import { isNegative, modeLabelId } from '../view-model/expenseDisplay';

import type { CashDay, CashRow } from '../types/cashbook.types';

/**
 * EXP-03 FR-6, 08 §11 — one day of the cash book: "17/10/2026 · Sat — In
 * ₹12,400 · Out ₹3,180 · Closing ₹41,220", opening to its rows in entry order.
 *
 * In is green and carries a "+"; out is plain ink with a "−" — never red,
 * because an expense is not an error (§8) — and the words are there as well
 * as the colour. A negative closing IS shown in the error tone with its label,
 * because it almost always means an inflow was not entered (BR-9).
 *
 * A row the merchant can look up opens it (08 §11 Navigation): a payment its
 * receipt, an expense its detail sheet. A khata line with a mode has no page
 * of its own here, so it is not a button — a row that looks tappable and
 * opens nothing teaches the merchant the screen is broken.
 */
export interface CashbookDayCardProps {
  readonly day: CashDay;
  readonly defaultOpen: boolean;
  readonly t: TranslateFn;
  readonly locale: string;
  /** Opens a payment's receipt or an expense's sheet; absent rows stay plain. */
  readonly onOpenRow?: (row: CashRow) => void;
}

const weekday = (iso: string, locale: string): string =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(formattingLocale(locale), {
    weekday: 'short',
    timeZone: 'UTC',
  });

/** Which rows have something to open. */
export const isOpenableRow = (row: CashRow): boolean =>
  row.sourceType === 'payment' || row.sourceType === 'expense';

const rowLabel = (row: CashRow, t: TranslateFn): string => {
  if (row.sourceType === 'expense') {
    return row.note.trim()
      ? `${row.category?.name ?? ''} — ${row.note.trim()}`
      : (row.category?.name ?? t('cashbook.row.expense'));
  }
  if (row.sourceType === 'payment' && row.direction === 'out') {
    return row.party ? t('cashbook.row.paidTo', { name: row.party.name }) : t('cashbook.row.paid');
  }
  if (row.direction === 'in') {
    return row.party
      ? t('cashbook.row.receivedFrom', { name: row.party.name })
      : t('cashbook.row.received');
  }
  return row.party ? t('cashbook.row.givenTo', { name: row.party.name }) : t('cashbook.row.given');
};

export function CashbookDayCard({
  day,
  defaultOpen,
  t,
  locale,
  onOpenRow,
}: Readonly<CashbookDayCardProps>): React.JSX.Element {
  const header = t('cashbook.day.header', {
    date: formatBusinessDate(day.date),
    weekday: weekday(day.date, locale),
    in: cashFigure(day.in.total),
    out: cashFigure(day.out.total),
    closing: cashFigure(day.closing.total),
  });

  return (
    /* The disclosure draws its own hairline box; wrapped in a card it was a
       box inside a box on every day. */
    <UbDisclosure label={header} defaultOpen={defaultOpen}>
      <UbStack gap={0} data-testid="cashbook-day-rows">
        {day.rows.map((row, index) => {
          const modeId = modeLabelId(row.mode, row.upiApp);
          const label = rowLabel(row, t);
          const caption = [
            row.sourceType === 'expense' ? row.party?.name : null,
            modeId ? t(modeId) : null,
            row.number,
            row.reference || null,
          ].filter((piece): piece is string => Boolean(piece));
          const openable = Boolean(onOpenRow) && isOpenableRow(row);
          /* The amount alone holds the right edge. With the running figure
             beside it, a 390 px phone left the title a third of the row and
             split "PAYOUT/26-27/2034" over two lines; the running figure now
             sits with the caption, and each caption piece stays whole. */
          const body = (
            <UbStack direction="row" justify="between" align="start" className="gap-3 py-2">
              <UbStack gap={0} className="min-w-0 flex-1 text-left">
                <UbText as="span" variant="body-sm" className="line-clamp-2">
                  {label}
                </UbText>
                {caption.length > 0 && (
                  <UbText
                    as="span"
                    variant="caption"
                    tone="tertiary"
                    className="ds-num flex flex-wrap gap-x-1"
                  >
                    {caption.map((piece, at) => (
                      <UbText as="span" variant="inherit" key={`${at}-${piece}`} className="whitespace-nowrap">
                        {at > 0 ? `· ${piece}` : piece}
                      </UbText>
                    ))}
                  </UbText>
                )}
                <UbText as="span" variant="caption" tone="tertiary" className="ds-num">
                  {/* Which bucket the running figure is — in the Both view the
                      rows alternate between cash and bank, and a bare
                      "Balance" jumped between two different numbers. */}
                  {t(`cashbook.row.balance.${row.bucket}`, {
                    amount: cashFigure(row.runningAfter[row.bucket] ?? row.runningAfter.total),
                  })}
                </UbText>
              </UbStack>
              <UbAmount
                value={row.amount}
                tone={row.direction === 'in' ? 'payable' : 'neutral'}
                sign={row.direction === 'in' ? 'plus' : 'minus'}
                label={t(row.direction === 'in' ? 'cashbook.in' : 'cashbook.out')}
                labelHidden
                size="sm"
                className="shrink-0"
              />
              {openable && (
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" aria-hidden />
              )}
            </UbStack>
          );
          return (
            <UbStack key={row.id} gap={0}>
              {index > 0 && <UbDivider />}
              {openable ? (
                <UbPressable
                  onClick={() => onOpenRow?.(row)}
                  aria-label={t('cashbook.row.open', { label })}
                  className="-mx-2 min-h-11 rounded-md px-2 hover:bg-surface-hover"
                  data-testid="cashbook-row"
                >
                  {body}
                </UbPressable>
              ) : (
                <UbStack gap={0} data-testid="cashbook-row">
                  {body}
                </UbStack>
              )}
            </UbStack>
          );
        })}
        <UbDivider />
        <UbStack direction="row" justify="between" className="flex-wrap gap-x-3 pt-2">
          <UbText variant="caption" tone="tertiary" className="ds-num">
            {t('cashbook.opening')}: {cashFigure(day.opening.total)}
          </UbText>
          <UbText
            variant="caption"
            tone={isNegative(day.closing.total) ? 'error' : 'secondary'}
            className="ds-num"
          >
            {t('cashbook.closing')}: {cashFigure(day.closing.total)}
          </UbText>
        </UbStack>
        {day.voidedCount > 0 && (
          <UbText variant="caption" tone="tertiary">
            {t('cashbook.voidedNote', { count: day.voidedCount })}
          </UbText>
        )}
      </UbStack>
    </UbDisclosure>
  );
}

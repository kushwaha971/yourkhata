'use client';

import { UbAmount, UbPressable, UbStack, UbText } from 'src/design-system';
import type { TranslateFn } from 'src/hooks/useTranslation';
import { formatBusinessDate, formatShopTime } from 'src/utils/dates';
import { formatInrUnbroken } from 'src/utils/moneyUnbroken';
import { weekdayShort } from 'src/utils/weekday';

import { modeLabelId } from '../view-model/expenseDisplay';

import type { CashDay, CashRow } from '../types/cashbook.types';

/**
 * EXP-03 FR-6, 08 §11 — one day of the cash book: "17/10/2026 · Sat — In
 * ₹12,400 · Out ₹3,180 · Closing ₹41,220" over its rows, in the design's Time,
 * What, In and Out columns (F-cb-d); a phone joins the time to the caption.
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
  /** The day's rows the search left; the whole day when none is running. */
  readonly rows?: readonly CashRow[];
  readonly t: TranslateFn;
  readonly locale: string;
  /** Opens a payment's receipt or an expense's sheet; absent rows stay plain. */
  readonly onOpenRow?: (row: CashRow) => void;
}

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

/** Time, what, in and out: the design's four columns (F-cb-d). */
export const CASHBOOK_ROW_GRID =
  'lg:grid lg:grid-cols-[110px_minmax(0,1fr)_130px_130px] lg:items-center lg:gap-3';

export const cashRowLabel = rowLabel;

export function CashbookDayCard({
  day,
  rows = day.rows,
  t,
  locale,
  onOpenRow,
}: Readonly<CashbookDayCardProps>): React.JSX.Element {
  const header = t('cashbook.day.header', {
    date: formatBusinessDate(day.date),
    weekday: weekdayShort(day.date, locale),
    in: formatInrUnbroken(day.in.total),
    out: formatInrUnbroken(day.out.total),
    closing: formatInrUnbroken(day.closing.total),
  });

  return (
    <UbStack gap={0} data-testid="cashbook-day-rows">
      <UbStack gap={0} className="border-b border-border-hairline bg-surface-sunken px-4 py-2">
        <UbText as="span" variant="caption" tone="secondary" className="ds-num">
          {header}
        </UbText>
        {day.voidedCount > 0 && (
          <UbText as="span" variant="caption" tone="tertiary">
            {t('cashbook.voidedNote', { count: day.voidedCount })}
          </UbText>
        )}
      </UbStack>
      {rows.map((row) => {
        const modeId = modeLabelId(row.mode, row.upiApp);
        const label = rowLabel(row, t);
        const time = formatShopTime(row.at);
        const caption = [
          row.sourceType === 'expense' ? row.party?.name : null,
          modeId ? t(modeId) : null,
          row.number,
          row.reference || null,
        ]
          .filter((piece): piece is string => Boolean(piece))
          .join(' · ');
        const openable = Boolean(onOpenRow) && isOpenableRow(row);
        const amount = (
          <UbAmount
            value={row.amount}
            tone={row.direction === 'in' ? 'receivable' : 'neutral'}
            size="sm"
            label={t(row.direction === 'in' ? 'cashbook.in' : 'cashbook.out')}
            labelHidden
            className="shrink-0"
          />
        );
        const body = (
          <UbStack
            direction="row"
            justify="between"
            align="center"
            className={`min-h-[62px] gap-3 px-4 py-3 text-left lg:min-h-[41px] lg:py-2 ${CASHBOOK_ROW_GRID}`}
          >
            <UbStack gap={0} className="min-w-0 flex-1 lg:contents">
              <UbText as="span" variant="body-sm" className="ds-num whitespace-nowrap max-lg:hidden">
                {time}
              </UbText>
              <UbStack gap={0} className="min-w-0">
                <UbText as="span" variant="body-sm" className="line-clamp-2 break-words">
                  {label}
                </UbText>
                <UbText as="span" variant="caption" tone="tertiary" className="ds-num break-words">
                  <UbText as="span" variant="inherit" className="lg:hidden">
                    {caption ? `${time} · ` : time}
                  </UbText>
                  {caption}
                </UbText>
              </UbStack>
            </UbStack>
            <UbStack className="shrink-0 lg:items-end">
              {row.direction === 'in' ? amount : <UbText as="span" variant="body-sm" tone="tertiary" className="max-lg:hidden">—</UbText>}
            </UbStack>
            <UbStack className="shrink-0 lg:items-end">
              {row.direction === 'out' ? amount : <UbText as="span" variant="body-sm" tone="tertiary" className="max-lg:hidden">—</UbText>}
            </UbStack>
          </UbStack>
        );
        return openable ? (
          <UbPressable
            key={row.id}
            onClick={() => onOpenRow?.(row)}
            aria-label={t('cashbook.row.open', { label })}
            className="block w-full border-b border-border-hairline hover:bg-surface-hover"
            data-testid="cashbook-row"
          >
            {body}
          </UbPressable>
        ) : (
          <UbStack key={row.id} gap={0} className="border-b border-border-hairline" data-testid="cashbook-row">
            {body}
          </UbStack>
        );
      })}
    </UbStack>
  );
}

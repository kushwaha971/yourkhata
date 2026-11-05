'use client';

import { UbPressable, UbStack, UbText } from 'src/design-system';
import type { TranslateFn } from 'src/hooks/useTranslation';
import { formatBusinessDate, formatShopTime } from 'src/utils/dates';
import { formatInrUnbroken } from 'src/utils/moneyUnbroken';

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
/** Which rows have something to open. */
export const isOpenableRow = (row: CashRow): boolean =>
  row.sourceType === 'payment' || row.sourceType === 'expense';

const rowLabel = (row: CashRow, t: TranslateFn): string => {
  if (row.sourceType === 'expense') {
    return t('cashbook.row.expenseOf', { name: row.note.trim() || row.category?.name || t('cashbook.row.expense') });
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
  'lg:grid lg:grid-cols-[24fr_40fr_18fr_18fr] lg:items-center lg:gap-3';

export const cashRowLabel = rowLabel;

/**
 * The design's rows (F-cb-d, F-cb-p): one flat list, Time, What, In, Out. A
 * phone reads the same cells as drawn: time, then what · in, with out at the
 * right. Today's rows show the time alone; older ones carry their date.
 */
export function CashbookRows({
  days,
  today,
  t,
  onOpenRow,
}: Readonly<{
  days: readonly { readonly day: CashDay; readonly rows: readonly CashRow[] }[];
  today: string;
  t: TranslateFn;
  onOpenRow?: (row: CashRow) => void;
}>): React.JSX.Element {
  return (
    <UbStack gap={0} data-testid="cashbook-day-rows">
      {days.flatMap(({ day, rows }) =>
        rows.map((row) => {
          const label = rowLabel(row, t);
          const time =
            day.date === today
              ? formatShopTime(row.at)
              : `${formatBusinessDate(day.date)}, ${formatShopTime(row.at)}`;
          const moneyIn = row.direction === 'in' ? formatInrUnbroken(row.amount) : '—';
          const moneyOut = row.direction === 'out' ? formatInrUnbroken(row.amount) : '—';
          const body = (
            <UbStack
              direction="row"
              justify="between"
              align="center"
              className={`min-h-[62px] gap-3 px-4 py-3 text-left lg:min-h-[41px] lg:py-2 ${CASHBOOK_ROW_GRID}`}
            >
              <UbStack gap={0} className="min-w-0 flex-1 lg:contents">
                <UbText as="span" variant="body-sm" className="ds-num">
                  {time}
                </UbText>
                <UbText as="span" variant="caption" tone="tertiary" className="break-words lg:hidden">
                  {`${label} · ${moneyIn}`}
                </UbText>
                <UbText as="span" variant="body-sm" className="min-w-0 break-words max-lg:hidden">
                  {label}
                </UbText>
                <UbText as="span" variant="body-sm" className="ds-num max-lg:hidden">
                  {moneyIn}
                </UbText>
              </UbStack>
              <UbText as="span" variant="body-sm" className="ds-num shrink-0">
                {moneyOut}
              </UbText>
            </UbStack>
          );
          return onOpenRow && isOpenableRow(row) ? (
            <UbPressable
              key={row.id}
              onClick={() => onOpenRow(row)}
              aria-label={t('cashbook.row.open', { label })}
              className="block w-full border-b border-border-hairline last:border-b-0 hover:bg-surface-hover"
              data-testid="cashbook-row"
            >
              {body}
            </UbPressable>
          ) : (
            <UbStack key={row.id} gap={0} className="border-b border-border-hairline last:border-b-0" data-testid="cashbook-row">
              {body}
            </UbStack>
          );
        })
      )}
    </UbStack>
  );
}

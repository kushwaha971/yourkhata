import { UbLink, UbStack, UbStatusBadge, UbText } from 'src/design-system';
import type { UbDataGridColumn } from 'src/design-system/UbDataGrid';
import type { TranslateFn } from 'src/hooks/useTranslation';
import { partyPath } from 'src/routes';
import { formatBusinessDate } from 'src/utils/dates';
import { formatAmount, formatInr, subtractMoney } from 'src/utils/money';

import {
  baseType,
  isWalkInRow,
  rowAmountWord,
  rowPartyName,
  typeLabelId,
  typeTone,
} from '../view-model/dayBookDisplay';
import { sourceHref } from '../view-model/drillThrough';

import type { DayBookRow } from '../types/reports.types';

/**
 * 09 §10.2's desktop table — When · Type and number · Contact · Amount · Cash
 * after · Bank after — for the question the owner asks at closing time: "does
 * the drawer match, and if not, which line is wrong?"
 *
 * It had twelve columns (Date, Time, Type, Number, Contact, Description, In,
 * Out, Mode, Cash, Bank, By) in a fixed-layout table, and measured on the live
 * stack every date read "01/1…", every time "15:…" and every running figure
 * "-12,7…" at 1280 px, worse at 1024: a running cash figure needs about 118 px
 * and was given 56–75. So the table keeps what tallies the drawer and finds the
 * line, and the rest moved to the row sheet the first cell opens, the same
 * sheet a phone card opens:
 *
 *  * Date and time are one cell (the date only when the range spans days);
 *  * the type word and the number are one cell;
 *  * In and Out are one Amount cell said in words, as on the phone card —
 *    In, Out, or for a bill that moved no cash, Paid or On credit, which is
 *    what the Description column existed to say;
 *  * Description, Mode and By are in the sheet.
 *
 * The balance columns exist only when the server sent them
 * (`balancesVisible`) — absent, never blank.
 */
export interface DayBookColumnDeps {
  readonly t: TranslateFn;
  readonly balances: boolean;
  readonly multiDay: boolean;
}

/** The row's words: what a sale, a receipt or a khata line WAS. */
export const describeRow = (row: DayBookRow, t: TranslateFn): string => {
  const base = baseType(row);
  const parts: string[] = [];
  if (base === 'sale') {
    // UAT D4 — a sale row's `amountDue` is the due AT ISSUE (the server's day
    // book subtracts the take-payment), so a credit bill paid off later still
    // reads "on credit" on the day it was issued, and a part-paid one says both.
    const due = Number(row.amountDue ?? 0);
    const total = Number(row.amount ?? 0);
    if (due <= 0) {
      parts.push(t('reports.daybook.describe.salePaid', { amount: formatInr(row.amount) }));
    } else if (due >= total) {
      parts.push(t('reports.daybook.describe.saleCredit', { amount: formatInr(row.amount) }));
    } else {
      parts.push(
        t('reports.daybook.describe.salePart', {
          paid: formatInr(subtractMoney(row.amount ?? '0.00', row.amountDue ?? '0.00')),
          due: formatInr(row.amountDue ?? '0.00'),
        })
      );
    }
  } else if (['credit_note', 'purchase', 'opening', 'write_off', 'reversal'].includes(base)) {
    parts.push(formatInr(row.amount));
  } else if (base === 'expense') {
    if (row.detail) parts.push(row.detail);
    if (row.paid === false) {
      parts.push(t('reports.daybook.describe.payable', { amount: formatInr(row.amount) }));
    }
  } else if ((base === 'manual_gave' || base === 'manual_got') && row.modes.length === 0) {
    parts.push(t('reports.daybook.describe.onKhata', { amount: formatInr(row.amount) }));
  } else if (base === 'stock_adjustment') {
    if (row.detail) parts.push(t(`reports.daybook.adjustment.${row.detail}`));
    if (row.lines) parts.push(t('reports.daybook.describe.items', { count: row.lines }));
  }
  if (row.note) parts.push(row.note);
  if (row.detail && ['reversal', 'write_off', 'opening'].includes(base)) parts.push(row.detail);
  if (row.recordedOn) {
    parts.push(t('reports.daybook.recordedOn', { date: formatBusinessDate(row.recordedOn) }));
  }
  return parts.join(' · ');
};

/** EC-1 — "UPI ₹700.00 + Cash ₹300.00". */
export const describeModes = (row: DayBookRow, t: TranslateFn): string =>
  row.modes
    .map((part) => `${t(`reports.daybook.mode.${part.mode}`)} ${formatInr(part.amount)}`)
    .join(' + ');

const figure = (value: string | null | undefined, muted: boolean) => (
  <UbText
    as="span"
    variant="body-sm"
    tone={muted ? 'tertiary' : 'primary'}
    className="ds-num whitespace-nowrap"
  >
    {formatAmount(value)}
  </UbText>
);

export const createDayBookColumns = ({
  t,
  balances,
  multiDay,
}: DayBookColumnDeps): readonly UbDataGridColumn<DayBookRow>[] => {
  // Shares of the table; the money columns need about 118 px each at 1024.
  const share = balances
    ? { when: 14, entry: 19, party: 19, amount: 16, balance: 16 }
    : { when: 16, entry: 27, party: 31, amount: 26, balance: 0 };
  const columns: UbDataGridColumn<DayBookRow>[] = [
    {
      id: 'when',
      header: t(multiDay ? 'reports.daybook.column.date' : 'reports.daybook.column.time'),
      priority: 1,
      cardSlot: 'meta',
      widthShare: share.when,
      cell: (row) =>
        multiDay ? (
          <UbStack gap={0}>
            <UbText as="span" variant="body-sm" className="ds-num whitespace-nowrap">
              {formatBusinessDate(row.date)}
            </UbText>
            <UbText as="span" variant="caption" tone="tertiary" className="ds-num">
              {row.time}
            </UbText>
          </UbStack>
        ) : (
          <UbText as="span" variant="body-sm" className="ds-num whitespace-nowrap">
            {row.time}
          </UbText>
        ),
    },
    {
      id: 'type',
      header: t('reports.daybook.column.type'),
      priority: 1,
      cardSlot: 'title',
      widthShare: share.entry,
      cell: (row) => {
        const href = sourceHref(row.source, row.number, row.type);
        return (
          <UbStack gap={0.5} align="start">
            <UbStack direction="row" align="center" className="flex-wrap gap-1">
              <UbStatusBadge tone={typeTone(row)} label={t(typeLabelId(row))} />
              {row.void && <UbStatusBadge tone="neutral" label={t('reports.daybook.void')} />}
            </UbStack>
            {row.number &&
              (href ? (
                // "PAYOUT/26-27/0004" wraps at its slashes rather than ending in "…".
                <UbLink
                  href={href}
                  variant="body-sm-medium"
                  className="whitespace-normal [overflow-wrap:anywhere]"
                >
                  {row.number}
                </UbLink>
              ) : (
                <UbText as="span" variant="body-sm" className="[overflow-wrap:anywhere]">
                  {row.number}
                </UbText>
              ))}
          </UbStack>
        );
      },
    },
    {
      id: 'party',
      header: t('reports.daybook.column.party'),
      priority: 1,
      cardSlot: 'meta',
      widthShare: share.party,
      cell: (row) => {
        const name = rowPartyName(row);
        if (!name) return isWalkInRow(row) ? t('reports.daybook.walkIn') : '—';
        return row.party ? (
          <UbLink
            href={partyPath(row.party.id)}
            variant="body-sm"
            className="line-clamp-2 whitespace-normal"
          >
            {name}
          </UbLink>
        ) : (
          <UbText as="span" variant="body-sm" className="line-clamp-2 whitespace-normal break-words">
            {name}
          </UbText>
        );
      },
    },
    {
      id: 'amount',
      header: t('reports.daybook.column.amount'),
      priority: 1,
      align: 'end',
      cardSlot: 'trailing',
      widthShare: share.amount,
      cell: (row) => {
        const amount = rowAmountWord(row);
        if (!amount.value) return '—';
        return (
          <UbStack gap={0} align="end">
            <UbText as="span" variant="caption" tone="secondary">
              {t(amount.id)}
            </UbText>
            <UbText
              as="span"
              variant="body-sm-medium"
              tone={row.void ? 'tertiary' : amount.direction === 'in' ? 'success' : 'primary'}
              className={
                row.void ? 'ds-num whitespace-nowrap line-through' : 'ds-num whitespace-nowrap'
              }
            >
              {formatAmount(amount.value)}
            </UbText>
          </UbStack>
        );
      },
    },
  ];
  if (balances) {
    columns.push(
      {
        id: 'cash',
        header: t('reports.daybook.column.cash'),
        priority: 2,
        align: 'end',
        cardSlot: 'none',
        widthShare: share.balance,
        cell: (row) => figure(row.cashAfter, row.void),
      },
      {
        id: 'bank',
        header: t('reports.daybook.column.bank'),
        priority: 2,
        align: 'end',
        cardSlot: 'none',
        widthShare: share.balance,
        cell: (row) => figure(row.bankAfter, row.void),
      }
    );
  }
  return columns;
};

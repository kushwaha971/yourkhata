import type { TranslateFn } from 'src/hooks/useTranslation';
import { sumMoney, toDecimal, type MoneyString } from 'src/utils/money';

import { DAY_BOOK_TYPE_FILTERS } from '../types/reports.types';

import { periodFromQuery, periodToQuery, REPORT_PRESETS } from './reportPeriod';

import type {
  DayBookFilters,
  DayBookRow,
  DayBookType,
  DayBookTypeFilter,
  ReportPreset,
} from '../types/reports.types';

/**
 * RPT-02 — pure helpers for the day-book screen: the filters in the address
 * bar, the chips' type groups, and each row's words.
 */

/** FR-5 — Today, Yesterday, This week, This month, Custom (plus last month). */
export const DAY_BOOK_PRESETS: readonly ReportPreset[] = REPORT_PRESETS.filter((preset) =>
  ['today', 'yesterday', 'thisWeek', 'thisMonth', 'lastMonth', 'custom'].includes(preset)
);
export const DEFAULT_DAY_BOOK_PRESET: ReportPreset = 'today';
export const DAY_BOOK_PAGE_SIZE = 100;

/** Each chip and the FR-2 codes it stands for. */
export const TYPE_GROUPS: Readonly<Record<DayBookTypeFilter, readonly DayBookType[]>> = {
  sales: ['sale', 'credit_note'],
  purchases: ['purchase'],
  payments: ['payment_in', 'payment_out'],
  expenses: ['expense'],
  khata: ['manual_gave', 'manual_got', 'opening', 'write_off', 'reversal'],
  stock: ['stock_adjustment'],
};

export const typesForFilters = (filters: readonly DayBookTypeFilter[]): readonly DayBookType[] =>
  filters.flatMap((group) => TYPE_GROUPS[group]);

export const dayBookFiltersFromQuery = (query: URLSearchParams, today: string): DayBookFilters => {
  const period = periodFromQuery(query, today, DAY_BOOK_PRESETS, DEFAULT_DAY_BOOK_PRESET);
  const types = (query.get('type') ?? '')
    .split(',')
    .filter((value): value is DayBookTypeFilter =>
      (DAY_BOOK_TYPE_FILTERS as readonly string[]).includes(value)
    );
  const page = Number(query.get('page') ?? '1');
  return {
    ...period,
    types: DAY_BOOK_TYPE_FILTERS.filter((group) => types.includes(group)),
    includeVoid: query.get('void') === '1',
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
};

/** The inverse — only what differs from the defaults, so the plain URL stays plain. */
export const dayBookQueryFromFilters = (filters: DayBookFilters): string => {
  const query = new URLSearchParams();
  periodToQuery(filters, DEFAULT_DAY_BOOK_PRESET, query);
  if (filters.types.length) query.set('type', filters.types.join(','));
  if (filters.includeVoid) query.set('void', '1');
  if (filters.page > 1) query.set('page', String(filters.page));
  return query.toString();
};

/** The FR-2 code without FR-7's `_void` suffix. */
export const baseType = (row: Pick<DayBookRow, 'type'>): string => row.type.replace(/_void$/, '');

const KNOWN = new Set<string>([
  'sale',
  'credit_note',
  'purchase',
  'payment_in',
  'payment_out',
  'expense',
  'manual_gave',
  'manual_got',
  'opening',
  'write_off',
  'reversal',
  'correction',
  'stock_adjustment',
]);

/** The type badge's message id. */
export const typeLabelId = (row: Pick<DayBookRow, 'type'>): string => {
  const base = baseType(row);
  return `reports.daybook.type.${KNOWN.has(base) ? base : 'other'}`;
};

/** UX §8 — In success, Out error, a non-money row muted, a void row neutral. */
export const typeTone = (
  row: Pick<DayBookRow, 'type' | 'void' | 'moneyIn' | 'moneyOut'>
): 'neutral' | 'success' | 'error' | 'info' | 'warning' => {
  if (row.void) return 'neutral';
  if (row.moneyIn) return 'success';
  if (row.moneyOut) return 'error';
  return baseType(row) === 'sale' || baseType(row) === 'purchase' ? 'info' : 'neutral';
};

/** Who the row is about: the party, the walk-in's name, or nothing. */
export const rowPartyName = (row: Pick<DayBookRow, 'party' | 'walkInName'>): string | null =>
  row.party?.name || row.walkInName || null;

const COUNTER_TYPES = ['sale', 'credit_note', 'payment_in', 'payment_out'];

/**
 * QA R-D4 — a counter sale or receipt with no party and no name typed is a
 * walk-in, and says so ("Walk-in") rather than "—": the receipt of a walk-in
 * sale read "—" one row below the sale it paid for. An expense or a stock
 * adjustment with no party keeps "—", because it has no customer at all.
 */
export const isWalkInRow = (row: Pick<DayBookRow, 'party' | 'walkInName' | 'type'>): boolean =>
  !rowPartyName(row) && COUNTER_TYPES.includes(baseType(row));

/** The rows grouped by business date, in the order they came (FR: mobile timeline). */
export const groupByDate = (
  rows: readonly DayBookRow[]
): readonly { readonly date: string; readonly rows: readonly DayBookRow[] }[] => {
  const groups: { date: string; rows: DayBookRow[] }[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.date === row.date) last.rows.push(row);
    else groups.push({ date: row.date, rows: [row] });
  }
  return groups;
};

/**
 * 09 §10.2 — the phone card's three things. WHAT: who the line is about (the
 * contact, "Quick sale" for a counter line with nobody named, or the type for
 * a line that has no customer at all).
 */
export const rowWhat = (
  row: Pick<DayBookRow, 'party' | 'walkInName' | 'type'>,
  t: TranslateFn
): string =>
  rowPartyName(row) ?? t(isWalkInRow(row) ? 'reports.daybook.walkIn' : typeLabelId(row));

/**
 * WHICH: the type word with its number ("Bill INV/26-27/0418"), an expense's
 * category ("Expense: Tea"), or a stock adjustment's reason — the words that
 * find the line on paper. The time is joined by the caller.
 */
export const rowWhich = (
  row: Pick<DayBookRow, 'type' | 'number' | 'detail'>,
  t: TranslateFn
): string => {
  const base = baseType(row);
  const type = t(typeLabelId(row));
  if (base === 'expense' && row.detail) {
    return t('reports.daybook.which.detail', { type, detail: row.detail });
  }
  if (base === 'stock_adjustment' && row.detail) {
    return t('reports.daybook.which.detail', {
      type,
      detail: t(`reports.daybook.adjustment.${row.detail}`),
    });
  }
  return row.number ? `${type} ${row.number}` : type;
};

/**
 * The card's one amount, in words: "In" or "Out" when the line moved money,
 * and for a bill that moved none, whether it was paid or is on credit — the
 * reason a ₹2,260 sale did not change the drawer. Anything else is its total.
 */
export const rowAmountWord = (
  row: Pick<DayBookRow, 'type' | 'moneyIn' | 'moneyOut' | 'amount' | 'amountDue'>
): {
  readonly id: string;
  readonly value: MoneyString | null;
  readonly direction: 'in' | 'out' | null;
} => {
  if (row.moneyIn) return { id: 'reports.daybook.amount.in', value: row.moneyIn, direction: 'in' };
  if (row.moneyOut)
    return { id: 'reports.daybook.amount.out', value: row.moneyOut, direction: 'out' };
  const base = baseType(row);
  if ((base === 'sale' || base === 'purchase') && row.amount && row.amountDue !== null) {
    const due = toDecimal(row.amountDue);
    const id =
      due.lte(0)
        ? 'reports.daybook.amount.paid'
        : due.gte(toDecimal(row.amount))
          ? 'reports.daybook.amount.credit'
          : 'reports.daybook.amount.part';
    return { id, value: row.amount, direction: null };
  }
  return { id: 'reports.daybook.amount.total', value: row.amount, direction: null };
};

/** A date band's money in and out, from the lines a cancelled one does not count. */
export const bandMoney = (
  rows: readonly Pick<DayBookRow, 'void' | 'moneyIn' | 'moneyOut'>[]
): { readonly moneyIn: MoneyString; readonly moneyOut: MoneyString } => ({
  moneyIn: sumMoney(rows.filter((row) => !row.void && row.moneyIn).map((row) => row.moneyIn ?? '0')),
  moneyOut: sumMoney(
    rows.filter((row) => !row.void && row.moneyOut).map((row) => row.moneyOut ?? '0')
  ),
});

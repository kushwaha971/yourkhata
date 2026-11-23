import type { TranslateFn } from 'src/hooks/useTranslation';
import { daysBetweenIso } from 'src/utils/calendarDays';
import { absMoney, formatInr } from 'src/utils/money';

import type { Entry, Person } from '../types/moneybook.types';

/**
 * How the Money Book says money and days, one place for every screen (I1–I3).
 * No React; ids and strings only, so two screens can never word one figure two ways.
 */

/** ₹4,500 — the design's figures carry no paise when there are none. */
export const rupees = (value: string | null | undefined): string => {
  const text = formatInr(value ? absMoney(value) : '0.00');
  return text.endsWith('.00') ? text.slice(0, -3) : text;
};

export type Side = 'get' | 'give' | 'settled';

/** + they owe you (to get), − you owe them (to give). */
export const sideOf = (balance: string): Side => {
  const n = Number(balance);
  if (n > 0) return 'get';
  if (n < 0) return 'give';
  return 'settled';
};

export const SIDE_WORD: Readonly<Record<Side, string>> = {
  get: 'moneybook.side.get',
  give: 'moneybook.side.give',
  settled: 'moneybook.side.settled',
};

/** Text colour class for a side: green to get, red to give, grey settled. */
export const SIDE_TONE: Readonly<Record<Side, 'success' | 'error' | 'tertiary'>> = {
  get: 'success',
  give: 'error',
  settled: 'tertiary',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "12 Oct" (or "12 Oct 2025" from another year). Month names stay Latin in Hindi, as dates do elsewhere. */
export const shortDate = (iso: string, today: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  const label = `${d} ${MONTHS[(m ?? 1) - 1]}`;
  return iso.slice(0, 4) === today.slice(0, 4) ? label : `${label} ${y}`;
};

/** "Today", "Yesterday", "3 days ago" within a week, then "12 Oct". */
export const dayLabel = (iso: string, today: string, t: TranslateFn): string => {
  const days = daysBetweenIso(iso, today);
  if (days === 0) return t('moneybook.day.today');
  if (days === 1) return t('moneybook.day.yesterday');
  if (days > 1 && days < 7) return t('moneybook.day.daysAgo', { count: days });
  return shortDate(iso, today);
};

/** The list row's second line: "Today · Rent share", or the day alone. */
export const lastEntryLine = (person: Person, today: string, t: TranslateFn): string => {
  if (!person.lastEntryDate) return t('moneybook.people.noEntries');
  const day = dayLabel(person.lastEntryDate, today, t);
  return person.lastEntryNote ? `${day} · ${person.lastEntryNote}` : day;
};

export const KIND_WORD: Readonly<Record<Entry['kind'], string>> = {
  gave: 'moneybook.entry.gave',
  got: 'moneybook.entry.got',
};

/** "₹4,500 to get" / "₹1,500 to give" / "Settled" — the balance in words. */
export const balanceWords = (balance: string, t: TranslateFn): string => {
  const side = sideOf(balance);
  if (side === 'settled') return t(SIDE_WORD.settled);
  return t(side === 'get' ? 'moneybook.balance.toGet' : 'moneybook.balance.toGive', {
    amount: rupees(balance),
  });
};

/** The entry the sheet will make, signed the way the server signs it. */
export const signedAmount = (kind: Entry['kind'], amount: string): number =>
  (kind === 'gave' ? 1 : -1) * Number(amount || 0);

/** An entry's day as the design writes it: "Today, 9:10 am", "Yesterday", "22 Oct". */
export const entryWhen = (entry: Entry, today: string, t: TranslateFn): string => {
  const day = dayLabel(entry.entryDate, today, t);
  if (entry.entryDate !== today || !entry.createdAt) return day;
  const time = new Date(entry.createdAt).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
  return `${day}, ${time}`;
};

import { compareMoney, formatInr } from 'src/utils/money';

import type { ShopPromise } from '../types/shopPromise.types';

/**
 * BP-16 — the facts both the person page and Home say about a promise, with
 * no message ids, so Home can use them without loading the parties catalogue.
 */

/**
 * "Fri, 30 Oct": the day matters more than the year for a promise a week out.
 * UTC, because the value is a calendar date and `new Date('2026-10-30')` is
 * midnight UTC — formatted in a browser west of Greenwich it would be the 29th.
 */
export const PROMISE_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
};

/** Earlier promises can be months old, so they carry the year: "20/07/2026". */
export const PROMISE_HISTORY_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
};

export type Variant = 'amountToday' | 'today' | 'amountOn' | 'on';

export const variant = (promise: ShopPromise, today: string): Variant => {
  const isToday = promise.promisedOn === today;
  if (promise.amount) return isToday ? 'amountToday' : 'amountOn';
  return isToday ? 'today' : 'on';
};

export const promiseValues = (
  promise: ShopPromise,
  formatDate: (iso: string) => string
): { amount: string; date: string } => ({
  amount: promise.amount ? formatInr(promise.amount) : '',
  date: formatDate(promise.promisedOn),
});

/** Whether there is still money due in the promise's role, by the server's figure NOW. */
export const promiseStillDue = (promise: ShopPromise): boolean =>
  promise.balance !== undefined && compareMoney(promise.balance, '0') > 0;

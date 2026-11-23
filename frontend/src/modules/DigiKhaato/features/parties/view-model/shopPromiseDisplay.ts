import type { TranslateFn } from 'src/hooks/useTranslation';

import { promiseValues, variant } from './shopPromiseFacts';

import type { ShopPromise } from '../types/shopPromise.types';

/**
 * BP-16 — the words a Shop promise is said in, once, for the person page and
 * for Home. Every sentence names the day the promise is FOR ("today", or the
 * date), and "late" is said separately, from `daysLate`, which the server
 * computes on the business's clock: the browser's clock never decides whether
 * a promise is broken.
 */

/** Person page: "Will pay ₹1,500 today" / "You will pay ₹4,200 on 30/10/2026". */
export const promiseLine = (
  t: TranslateFn,
  promise: ShopPromise,
  today: string,
  formatDate: (iso: string) => string
): string =>
  t(
    `parties.shopPromise.line.${promise.role}.${variant(promise, today)}`,
    promiseValues(promise, formatDate)
  );

/** "3 days late", or null on the day and before it. */
export const promiseLate = (t: TranslateFn, promise: ShopPromise): string | null =>
  promise.daysLate ? t('parties.shopPromise.late', { count: promise.daysLate }) : null;

/** Earlier promises: "₹1,500 for 20/10/2026" or "For 20/10/2026". */
export const promiseHistoryLine = (
  t: TranslateFn,
  promise: ShopPromise,
  formatDate: (iso: string) => string
): string =>
  promise.amount
    ? t('parties.shopPromise.history.amountFor', promiseValues(promise, formatDate))
    : t('parties.shopPromise.history.for', promiseValues(promise, formatDate));

import type { TranslateFn } from 'src/hooks/useTranslation';
import { formatInr } from 'src/utils/money';

import {
  promiseStillDue,
  promiseValues,
  variant,
} from '../../parties/view-model/shopPromiseFacts';

import type { ShopPromise } from '../../parties/types/shopPromise.types';

/** BP-16 — Home's words for a Shop promise (the person page's are in parties). */

/** Home's row title: "Sharma General Store promised ₹1,500 today". */
export const homePromiseTitle = (
  t: TranslateFn,
  promise: ShopPromise,
  today: string,
  formatDate: (iso: string) => string
): string =>
  t(`reports.home.promise.${promise.role}.${variant(promise, today)}`, {
    ...promiseValues(promise, formatDate),
    name: promise.party.name,
  });

/** The lane's caption part: "promised ₹1,500 today". */
export const lanePromiseCaption = (
  t: TranslateFn,
  promise: ShopPromise,
  today: string,
  formatDate: (iso: string) => string
): string => t(`reports.home.promise.lane.${variant(promise, today)}`, promiseValues(promise, formatDate));

/**
 * Home's caption: "Owes ₹3,100 · 42 days late · Promise 2 days late".
 * The first part is the current balance in the role; when it has reached zero
 * since the promise was taken it says so, instead of a reminder for nothing.
 */
export const homePromiseCaption = (t: TranslateFn, promise: ShopPromise): string => {
  const parts: string[] = [];
  if (promise.balance !== undefined) {
    parts.push(
      promiseStillDue(promise)
        ? t(
            promise.role === 'customer' ? 'reports.home.promise.owes' : 'reports.home.promise.youOwe',
            { amount: formatInr(promise.balance) }
          )
        : t('reports.home.promise.nothingDue')
    );
  }
  if (promiseStillDue(promise) && promise.daysOverdue)
    parts.push(t('reports.home.daysLate', { count: promise.daysOverdue }));
  if (promise.daysLate) parts.push(t('reports.home.promise.late', { count: promise.daysLate }));
  return parts.join(' · ');
};

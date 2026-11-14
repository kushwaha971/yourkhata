import type { TranslateFn } from 'src/hooks/useTranslation';
import { absMoney, compareMoney, subtractMoney, toDecimal, toMoneyString } from 'src/utils/money';
import { formatInrUnbroken } from 'src/utils/moneyUnbroken';
import { formatTimestampInTz } from 'src/utils/zonedTime';

import type { CashCount } from '../types/reports.types';

/** Short is money missing; extra is a sale or payment probably not recorded. */
export const VARIANCE_TONE = { matches: 'success', short: 'error', extra: 'warning' } as const;

/**
 * BP-17 — a count's difference in words: Matches, Short by ₹50, Extra ₹20.
 * Short means less in the drawer than the records say; extra means more.
 */
export const varianceWords = (
  t: TranslateFn,
  variance: string
): { readonly kind: 'matches' | 'short' | 'extra'; readonly text: string } => {
  const order = compareMoney(variance, '0.00');
  if (order === 0) return { kind: 'matches', text: t('reports.cashCount.matches') };
  const kind = order < 0 ? 'short' : 'extra';
  return {
    kind,
    text: t(`reports.cashCount.${kind}`, { amount: formatInrUnbroken(absMoney(variance)) }),
  };
};

/** What a typed count would be against the records' figure, before saving. */
export const typedVariance = (counted: string, expected: string): string | null => {
  const value = counted.trim();
  if (!value || Number.isNaN(Number(value))) return null;
  return subtractMoney(toMoneyString(toDecimal(value)), expected);
};

/** "Counted at 16:12" today, "Counted on 23/10/2026" another day — on the tenant's clock. */
export const countedWhen = (
  t: TranslateFn,
  count: Pick<CashCount, 'countedAt' | 'businessDate'>,
  today: string,
  timeZone: string
): string => {
  const [date, time] = formatTimestampInTz(count.countedAt, timeZone).split(', ');
  return count.businessDate === today
    ? t('reports.cashCount.at', { time: time ?? '' })
    : t('reports.cashCount.on', { date: date ?? '' });
};

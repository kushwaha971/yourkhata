import { formatInr, type MoneyString } from 'src/utils/money';

/*
 * Its own module rather than `money.ts`, which the app shell carries to every
 * route; only the cash book and the day book print figures inside sentences.
 */
/**
 * `formatInr` with a non-breaking minus, for a figure inside a sentence that
 * wraps: at 320 px "Expected cash in drawer: -" ended one line with the sign
 * and began the next with "₹15,72,421.24" (the cash book, then the day book).
 */
export const formatInrUnbroken = (value: MoneyString | null | undefined): string =>
  formatInr(value).replace('-', '\u2011');

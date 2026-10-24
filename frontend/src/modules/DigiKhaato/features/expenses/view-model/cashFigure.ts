import { formatInr } from 'src/utils/money';

/**
 * `formatInr` with a non-breaking minus: the cash book's figures sit inside
 * sentences that wrap, and at 320 px "Expected cash in drawer: -" ended one
 * line with the sign and began the next with "₹15,72,421.24".
 *
 * Its own module, not `expenseDisplay.ts`, which the payments view-model
 * imports: only the cash book needs this.
 */
export const cashFigure = (value: string): string => formatInr(value).replace('-', '\u2011');

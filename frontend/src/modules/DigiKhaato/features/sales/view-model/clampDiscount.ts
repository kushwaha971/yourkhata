import { compareMoney, toMoneyString } from 'src/utils/money';

/**
 * A discount the box will not let past its limit (owner, 27 Oct 2026,
 * R-DEC-59): typed past it, it goes back to the limit at once, so a bill can
 * never be discounted below ₹0. A percent stops at 100; rupees stop at what
 * they are taken from — the bill's subtotal (or a line's qty × rate).
 * The server's own limits stay behind this as the backstop.
 *
 * `value` is the box's text as typed ("150", "12.", ""); anything that is not
 * a number yet is returned as it is, so typing is never interrupted.
 */
export const clampDiscount = (
  value: string,
  type: 'percent' | 'amount' | '',
  base?: string
): string => {
  const n = Number(value);
  if (!value.trim() || Number.isNaN(n)) return value;
  if (type === 'percent') return n > 100 ? '100' : value;
  if (
    type === 'amount' &&
    base !== undefined &&
    compareMoney(toMoneyString(n), toMoneyString(base)) > 0
  )
    return toMoneyString(base);
  return value;
};

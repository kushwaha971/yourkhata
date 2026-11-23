import { toDecimal } from 'src/utils/money';

/**
 * G11 (design pLoose) — "₹50 of sugar" at ₹44 a kg is 1.136 kg: the amount over
 * the rate, to the gram, because that is what the scale is set to and what stock
 * goes down by. Rounded DOWN, so the line never comes to more than the customer
 * asked for (₹100 at ₹44 is 2.272 kg = ₹99.97, not 2.273 kg = ₹100.01); the
 * bill's round-off takes the paise. Null when either is not a positive number.
 */
export const looseWeight = (amount: string, rate: string): string | null => {
  if (!/^\d+(\.\d+)?$/.test(amount.trim()) || !/^\d+(\.\d+)?$/.test(rate.trim())) return null;
  const a = toDecimal(amount.trim());
  const r = toDecimal(rate.trim());
  if (a.lte(0) || r.lte(0)) return null;
  return a.dividedBy(r).toDecimalPlaces(3, 1).toString();
};

/** What the weighed line comes to at its own rate: 1.136 × ₹44 = ₹49.98, shown as it is. */
export const looseLineAmount = (weight: string, rate: string): string =>
  toDecimal(weight).times(toDecimal(rate)).toDecimalPlaces(2, 4).toFixed(2);

/** Design pLoose's quick amounts. */
export const LOOSE_AMOUNTS = ['20', '50', '100', '200'] as const;

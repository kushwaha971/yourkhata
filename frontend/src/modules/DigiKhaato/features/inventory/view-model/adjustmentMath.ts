import Decimal from 'decimal.js-light';

import type { AdjustmentFormLine, AdjustmentMode, AdjustmentReason } from '../types/item.types';

/**
 * INV-06 FR-4/FR-5 — the numbers the drawer shows BEFORE posting. The server
 * recomputes everything; these exist so the merchant sees "5 → 2 NOS, −₹132.00"
 * while they type. decimal.js-light only: canon rule 3 allows no float maths
 * on money or quantities.
 */

const parse = (value: string): Decimal | null => {
  const text = value.trim();
  if (!text || text === '-' || text === '.' || text === '-.') return null;
  try {
    return new Decimal(text);
  } catch {
    return null;
  }
};

/**
 * The signed quantity the server receives: "Add" as typed, "Remove" negated,
 * "Set to" as the difference from on hand. The merchant never types a sign.
 */
export const signedQty = (
  line: Pick<AdjustmentFormLine, 'mode' | 'qty' | 'onHand'>
): Decimal | null => {
  const typed = parse(line.qty);
  if (typed === null) return null;
  if (line.mode === 'to') return typed.minus(new Decimal(line.onHand || '0'));
  return line.mode === 'remove' ? typed.negated() : typed;
};

/** A signed quantity (a posted line, undone) as the drawer's mode and unsigned box. */
export const lineModeFor = (signed: string): { mode: AdjustmentMode; qty: string } =>
  signed.trim().startsWith('-')
    ? { mode: 'remove', qty: signed.trim().slice(1) }
    : { mode: 'add', qty: signed.trim() };

/**
 * 09 §8.4 "Fewer taps" — the reason says how most of its lines are read: a
 * shelf count is "Set to" the number found; damage, loss and own use take stock
 * out. "Other" could be either, so it keeps whatever the line had.
 */
export const defaultModeFor = (
  reason: AdjustmentReason | '',
  current: AdjustmentMode
): AdjustmentMode => {
  if (reason === 'count') return 'to';
  if (reason === 'damage' || reason === 'theft' || reason === 'personal_use') return 'remove';
  return current;
};

/**
 * The consequence line for a member who may not see costs: the quantity change
 * per unit ("−4 BAG", "+3 NOS · −2 KGS"), because different units cannot be
 * added together and a value would be the cost they are not shown.
 */
export const quantityChanges = (
  lines: readonly AdjustmentFormLine[]
): readonly { readonly unitCode: string; readonly qty: string }[] => {
  const byUnit = new Map<string, Decimal>();
  for (const line of lines) {
    if (!line.itemId) continue;
    const qty = signedQty(line);
    if (qty === null || qty.isZero()) continue;
    byUnit.set(line.unitCode, (byUnit.get(line.unitCode) ?? new Decimal(0)).plus(qty));
  }
  return [...byUnit.entries()]
    .filter(([, qty]) => !qty.isZero())
    .map(([unitCode, qty]) => ({ unitCode, qty: qty.toFixed(3) }));
};

export const signedQtyString = (line: AdjustmentFormLine): string => {
  const qty = signedQty(line);
  return qty === null ? '' : qty.toFixed(3);
};

export const onHandAfter = (line: AdjustmentFormLine): string | null => {
  const qty = signedQty(line);
  return qty === null ? null : new Decimal(line.onHand || '0').plus(qty).toFixed(3);
};

/** BR-3 — inbound at the entered cost, outbound at the current average; 2 dp half-up. */
export const valueImpact = (line: AdjustmentFormLine): string | null => {
  const qty = signedQty(line);
  if (qty === null || qty.isZero()) return null;
  const cost = qty.isNegative() ? parse(line.avgCost) : parse(line.unitCost);
  if (cost === null) return null;
  return qty.times(cost).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
};

export const totalValueImpact = (lines: readonly AdjustmentFormLine[]): string =>
  lines
    .reduce((sum, line) => {
      const impact = valueImpact(line);
      return impact === null ? sum : sum.plus(new Decimal(impact));
    }, new Decimal(0))
    .toFixed(2);

export const isInboundLine = (line: AdjustmentFormLine): boolean => {
  const qty = signedQty(line);
  return qty !== null && qty.isPositive() && !qty.isZero();
};

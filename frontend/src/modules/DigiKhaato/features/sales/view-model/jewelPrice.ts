import type { OldGoldForm } from './invoiceForm';
import type { JewelLine } from '../../inventory/api/tagService';

/**
 * G2b — the client's copy of `apps.inventory.services.tags.price_piece`, so the
 * line sheet and the totals move while the counter types; the server prices
 * the line again on save and its figure is the one kept.
 *
 * The arithmetic is done in whole hundred-thousandths with BigInt and rounded
 * to the paisa half-to-even, which is what Python's `Decimal.quantize` does
 * under its default context. Floating point would disagree with the server
 * by a paisa often enough to show on a bill.
 */
const SCALE = 5;

const toUnits = (raw: string | null | undefined): bigint | null => {
  const text = (raw ?? '').replace(/,/g, '').trim();
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const [whole = '0', frac = ''] = text.split('.');
  if (frac.length > SCALE) return null;
  return BigInt(whole + frac.padEnd(SCALE, '0'));
};

/** num / den, rounded half to even (both non-negative). */
const halfEven = (num: bigint, den: bigint): bigint => {
  const q = num / den;
  const twice = (num % den) * 2n;
  return twice > den || (twice === den && q % 2n === 1n) ? q + 1n : q;
};

/** Units of 10^-SCALE → paise. */
const toPaise = (units: bigint): bigint => halfEven(units, 10n ** BigInt(SCALE - 2));
/** Two SCALE-decimal numbers multiplied, in paise. */
const mul = (a: bigint, b: bigint): bigint => halfEven(a * b, 10n ** BigInt(2 * SCALE - 2));

/** base (paise) × percent% — percent carries SCALE decimals — rounded once. */
const pct = (base: bigint, percent: bigint): bigint =>
  halfEven(base * percent, 100n * 10n ** BigInt(SCALE));

const rupees = (paise: bigint): string => {
  const sign = paise < 0n ? '-' : '';
  const abs = paise < 0n ? -paise : paise;
  return `${sign}${abs / 100n}.${(abs % 100n).toString().padStart(2, '0')}`;
};

export interface JewelParts {
  readonly metal: string;
  readonly making: string;
  readonly wastage: string;
  readonly stone: string;
  readonly total: string;
}

/** Null until the net weight and the rate are both numbers. */
export const priceJewel = (j: JewelLine): JewelParts | null => {
  const net = toUnits(j.net_g);
  const rate = toUnits(j.rate);
  const making = toUnits(j.making_value) ?? 0n;
  const wastage = toUnits(j.wastage_pct) ?? 0n;
  const stone = toUnits(j.stone_charge) ?? 0n;
  if (net === null || rate === null) return null;
  const metal = mul(net, rate);
  const makingPaise = j.making_type === 'pct' ? pct(metal, making) : mul(net, making);
  const wastagePaise = pct(metal, wastage);
  const stonePaise = toPaise(stone);
  return {
    metal: rupees(metal),
    making: rupees(makingPaise),
    wastage: rupees(wastagePaise),
    stone: rupees(stonePaise),
    total: rupees(metal + makingPaise + wastagePaise + stonePaise),
  };
};

export interface OldGoldParts {
  readonly gross: string;
  readonly less: string;
  readonly value: string;
}

/** G2c — `apps.inventory.services.old_gold.price`: weight × rate, less the melting %. */
export const priceOldGold = (g: OldGoldForm | null | undefined): OldGoldParts | null => {
  if (!g) return null;
  const weight = toUnits(g.weightG);
  const rate = toUnits(g.rate);
  const lessPct = toUnits(g.lessPct) ?? 0n;
  if (weight === null || rate === null) return null;
  const gross = mul(weight, rate);
  const less = pct(gross, lessPct);
  return { gross: rupees(gross), less: rupees(less), value: rupees(gross - less) };
};

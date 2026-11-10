import { toDecimal } from 'src/utils/money';

/**
 * G9 — a company scheme on a bill, the twin of the server's
 * `apps/sales/services/schemes.apply`. Both are held to `schemeCases.json`.
 * The bill screen runs it for its preview only: the form keeps the
 * merchant's own lines, and the server applies the scheme again on save.
 */
export interface SchemeRule {
  readonly code: string;
  readonly rule: 'free' | 'per_unit' | 'percent';
  readonly item_id: string | null;
  readonly buy_qty?: string | null;
  readonly free_qty?: string | null;
  readonly amount?: string | null;
  readonly min_bill?: string | null;
}

export interface SchemeLineInput {
  readonly item_id: string | null;
  readonly qty: string;
  readonly unit_price: string;
  readonly unit_code: string;
  readonly discount_type?: string | null;
}

export interface SchemeDiscount {
  readonly type: 'amount' | 'percent';
  readonly value: string;
  readonly scheme: string;
}

export interface SchemeFreeLine {
  readonly item_id: string;
  readonly qty: string;
  readonly unit_code: string;
  readonly scheme: string;
}

/** decimal.js-light's ROUND_DOWN: whole cases only, never a part of one. */
const ROUND_DOWN = 1;

const num = (raw: string | null | undefined) => toDecimal(raw && /^-?\d+(\.\d+)?$/.test(raw.trim()) ? raw.trim() : '0');

export const applySchemes = (
  lines: readonly SchemeLineInput[],
  schemes: readonly SchemeRule[]
): { discounts: (SchemeDiscount | null)[]; free: SchemeFreeLine[] } => {
  const discounts: (SchemeDiscount | null)[] = lines.map(() => null);
  const free: SchemeFreeLine[] = [];
  const ordered = [...schemes].sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
  for (const scheme of ordered) {
    const item = scheme.item_id;
    const mine = lines.flatMap((line, i) => (item === null || line.item_id === item ? [i] : []));
    const at = (i: number): SchemeLineInput => lines[i] as SchemeLineInput;
    if (scheme.rule === 'free') {
      const buy = num(scheme.buy_qty);
      const give = num(scheme.free_qty);
      if (!item || buy.lte(0) || give.lte(0) || mine.length === 0) continue;
      const total = mine.reduce((sum, i) => sum.plus(num(at(i).qty)), toDecimal('0'));
      const qty = total.div(buy).toDecimalPlaces(0, ROUND_DOWN).mul(give);
      if (qty.gt(0))
        free.push({ item_id: item, qty: qty.toString(), unit_code: at(mine[0] as number).unit_code, scheme: scheme.code });
      continue;
    }
    const open = mine.filter((i) => discounts[i] === null && !at(i).discount_type);
    if (scheme.rule === 'per_unit') {
      const off = num(scheme.amount);
      for (const i of open) {
        const qty = num(at(i).qty);
        const value = toDecimal(off.mul(qty).toFixed(2));
        const cap = toDecimal(qty.mul(num(at(i).unit_price)).toFixed(2));
        const taken = value.gt(cap) ? cap : value;
        if (taken.gt(0)) discounts[i] = { type: 'amount', value: taken.toFixed(2), scheme: scheme.code };
      }
    } else if (scheme.rule === 'percent') {
      const pct = num(scheme.amount);
      const base = open.reduce((sum, i) => sum.plus(num(at(i).qty).mul(num(at(i).unit_price))), toDecimal('0'));
      if (pct.gt(0) && open.length > 0 && base.gte(num(scheme.min_bill)))
        for (const i of open) discounts[i] = { type: 'percent', value: pct.toFixed(2), scheme: scheme.code };
    }
  }
  return { discounts, free };
};

/** Design pScheme's offer: the nearest percent scheme not yet reached, and what is short. */
export const nearestOffer = (
  lines: readonly SchemeLineInput[],
  schemes: readonly SchemeRule[]
): { scheme: SchemeRule; short: string } | null => {
  let best: { scheme: SchemeRule; short: string } | null = null;
  for (const scheme of schemes) {
    if (scheme.rule !== 'percent') continue;
    const mine = lines.filter((line) => scheme.item_id === null || line.item_id === scheme.item_id);
    if (scheme.item_id && mine.length === 0) continue;
    const base = mine.reduce((sum, line) => sum.plus(num(line.qty).mul(num(line.unit_price))), toDecimal('0'));
    const short = num(scheme.min_bill).minus(base);
    if (short.lte(0) || base.lte(0)) continue;
    if (!best || short.lt(num(best.short))) best = { scheme, short: short.toFixed(2) };
  }
  return best;
};

import {
  defaultModeFor,
  isInboundLine,
  lineModeFor,
  onHandAfter,
  quantityChanges,
  signedQty,
  totalValueImpact,
  valueImpact,
} from './adjustmentMath';
import { formatSignedQuantity, looksLikeBarcode, skuPrefix, stockBadge } from './itemDisplay';

import type { AdjustmentFormLine } from '../types/item.types';

const line = (over: Partial<AdjustmentFormLine>): AdjustmentFormLine => ({
  itemId: 'i1',
  itemName: 'Rice',
  unitCode: 'KGS',
  allowDecimal: true,
  onHand: '5.000',
  avgCost: '44.0000',
  mode: 'add',
  qty: '',
  unitCost: '',
  ...over,
});

/**
 * INV-06 FR-4/FR-5 — the figures the adjustment drawer shows while typing.
 * The server recomputes all of it; these protect the PREVIEW from float maths
 * and from getting "Set to" backwards, which would post the opposite change.
 */
describe('adjustment preview maths', () => {
  it('"Set to" sends the difference from on hand, not the typed count', () => {
    // Counting 2 on a shelf the book says holds 5 is a loss of 3.
    expect(signedQty(line({ mode: 'to', qty: '2' }))?.toFixed(3)).toBe('-3.000');
    expect(signedQty(line({ mode: 'remove', qty: '3' }))?.toFixed(3)).toBe('-3.000');
  });

  it('treats a half-typed number as nothing rather than NaN', () => {
    expect(signedQty(line({ qty: '-' }))).toBeNull();
    expect(onHandAfter(line({ qty: '.' }))).toBeNull();
  });

  it('values stock out at the average and stock in at the entered cost (BR-3)', () => {
    expect(valueImpact(line({ mode: 'remove', qty: '3' }))).toBe('-132.00');
    expect(valueImpact(line({ qty: '2', unitCost: '50' }))).toBe('100.00');
    // Inbound with no cost yet has no value to preview.
    expect(valueImpact(line({ qty: '2' }))).toBeNull();
  });

  it('adds line values exactly — 0.1 + 0.2 is 0.30 here', () => {
    const lines = [
      line({ qty: '1', unitCost: '0.1' }),
      line({ qty: '1', unitCost: '0.2' }),
      line({ mode: 'remove', qty: '1', avgCost: '44.0000' }),
    ];
    expect(totalValueImpact(lines)).toBe('-43.70');
  });

  it('knows which lines need a unit cost', () => {
    expect(isInboundLine(line({ qty: '2' }))).toBe(true);
    expect(isInboundLine(line({ mode: 'remove', qty: '2' }))).toBe(false);
    expect(isInboundLine(line({ mode: 'to', qty: '5' }))).toBe(false);
  });

  it('never needs a typed minus: Remove is the sign (09 §8.4)', () => {
    // A remove typed with a sign would otherwise add stock back.
    expect(signedQty(line({ mode: 'remove', qty: '4' }))?.toFixed(3)).toBe('-4.000');
    expect(onHandAfter(line({ mode: 'remove', qty: '4' }))).toBe('1.000');
    expect(onHandAfter(line({ mode: 'add', qty: '4' }))).toBe('9.000');
  });

  it('undoing a posted line picks the mode from its sign', () => {
    expect(lineModeFor('-2.000')).toEqual({ mode: 'remove', qty: '2.000' });
    expect(lineModeFor('3.000')).toEqual({ mode: 'add', qty: '3.000' });
  });

  it('a reason re-reads the mode: Counted is Set to, a loss is Remove, Other keeps it', () => {
    expect(defaultModeFor('count', 'remove')).toBe('to');
    expect(defaultModeFor('damage', 'add')).toBe('remove');
    expect(defaultModeFor('theft', 'to')).toBe('remove');
    expect(defaultModeFor('other', 'add')).toBe('add');
  });

  it('says the quantity change per unit for a member who may not see costs', () => {
    const lines = [
      line({ mode: 'remove', qty: '2', unitCode: 'BAG' }),
      line({ itemId: 'i2', mode: 'remove', qty: '2', unitCode: 'BAG' }),
      line({ itemId: 'i3', mode: 'add', qty: '3', unitCode: 'NOS' }),
      line({ itemId: '', mode: 'add', qty: '9', unitCode: 'NOS' }),
    ];
    expect(quantityChanges(lines)).toEqual([
      { unitCode: 'BAG', qty: '-4.000' },
      { unitCode: 'NOS', qty: '3.000' },
    ]);
  });
});

describe('item display', () => {
  it('says a negative on-hand with a true minus sign and the unit', () => {
    // "Out of stock · −3 NOS": a hyphen reads as a dash in running text.
    expect(formatSignedQuantity('-3.000', 'NOS')).toBe('−3 NOS');
    expect(formatSignedQuantity('12.500', 'KGS')).toBe('+12.5 KGS');
  });

  it('gives untracked items no stock badge at all', () => {
    // A service showing "Out of stock" is a claim about stock it cannot have.
    expect(stockBadge(null, null, 'NOS')).toBeNull();
    expect(stockBadge('low', '2.000', 'NOS')).toEqual({
      tone: 'warning',
      labelId: 'items.stock.low',
      params: {},
    });
    expect(stockBadge('out', '-3.000', 'NOS')?.labelId).toBe('items.stock.outNegative');
    expect(stockBadge('out', '0.000', 'NOS')?.labelId).toBe('items.stock.out');
  });

  it('previews the SKU prefix the server will use (BR-2)', () => {
    expect(skuPrefix('Basmati Rice 5kg')).toBe('BASMATI-RICE');
    expect(skuPrefix('चावल')).toBe('ITEM');
  });

  it('spots a barcode scanned into the name field (EC-3)', () => {
    expect(looksLikeBarcode('8901234567890')).toBe(true);
    expect(looksLikeBarcode('Rice 5kg')).toBe(false);
  });
});

import { emptyInvoiceForm, emptyLine } from '../view-model/invoiceForm';

import { discountsInRange } from './useDraftAutosave';

/**
 * The owner asked whether a discount is held to 100 % and to the price; it is,
 * on the server — but checked live, the autosave still SENT a bill with 150 %
 * off or more rupees off than the subtotal, every 3 s, and every one was
 * refused. The autosave waits while the bill's own discount is out of range,
 * as it already did for a line's percentage.
 */
describe('discountsInRange', () => {
  const bill = () => emptyInvoiceForm('2026-10-26', 'party', '27');

  it('holds the bill percent to 100', () => {
    expect(
      discountsInRange({ ...bill(), discountType: 'percent', discountValue: '150' }, '500.00')
    ).toBe(false);
    expect(
      discountsInRange({ ...bill(), discountType: 'percent', discountValue: '100' }, '500.00')
    ).toBe(true);
  });

  it('holds a rupee bill discount to the subtotal', () => {
    expect(
      discountsInRange({ ...bill(), discountType: 'amount', discountValue: '500.01' }, '500.00')
    ).toBe(false);
    expect(
      discountsInRange({ ...bill(), discountType: 'amount', discountValue: '500' }, '500.00')
    ).toBe(true);
  });

  it('holds a rupee line discount to qty × rate', () => {
    const line = {
      ...emptyLine(),
      qty: '2',
      unitPrice: '10',
      discountType: 'amount' as const,
      discountValue: '25',
    };
    expect(discountsInRange({ ...bill(), lines: [line] }, '20.00')).toBe(false);
  });

  it('lets an empty discount through (no number is no discount)', () => {
    expect(discountsInRange({ ...bill(), discountType: 'amount', discountValue: '' }, '0.00')).toBe(
      true
    );
  });
});

/**
 * FB-020 — a quantity and rate of 99999999 were autosaved and the server kept
 * a ₹880-quadrillion draft; now the server refuses such a line, so the
 * autosave must wait instead of sending a refused save every 3 s.
 */
describe('line limits in the autosave guard', () => {
  const bill = () => emptyInvoiceForm('2026-10-26', 'walkIn', '27');
  const withLine = (qty: string, unitPrice: string) => ({
    ...bill(),
    lines: [{ ...emptyLine(), itemId: 'i1', description: 'Atta', qty, unitPrice }],
  });

  it('waits on a quantity, rate or line amount over the limit', () => {
    expect(discountsInRange(withLine('1000000', '1'), '0')).toBe(false);
    expect(discountsInRange(withLine('1', '100000000'), '0')).toBe(false);
    expect(discountsInRange(withLine('500000', '1000'), '0')).toBe(false);
  });

  it('lets an ordinary large line through', () => {
    expect(discountsInRange(withLine('999999', '99'), '98999901')).toBe(true);
  });
});

/**
 * A4 monkey run (seed 4401, 1280) — "3.141" on a NOS line was autosaved and
 * refused (400) every 3 s, and the dock printed "Couldn't save" under the
 * field's own "whole numbers only". The autosave waits until it is a whole number.
 */
describe('whole-number units in the autosave guard', () => {
  const withQty = (qty: string, allowDecimal: boolean) => ({
    ...emptyInvoiceForm('2026-10-27', 'walkIn', '27'),
    lines: [
      { ...emptyLine(), itemId: 'i1', description: 'Atta', qty, unitPrice: '10', allowDecimal },
    ],
  });

  it('holds a fraction of a whole-number unit', () => {
    expect(discountsInRange(withQty('3.141', false), '31.41')).toBe(false);
    expect(discountsInRange(withQty('3', false), '30.00')).toBe(true);
  });

  it('lets a fraction through where the unit allows one', () => {
    expect(discountsInRange(withQty('3.141', true), '31.41')).toBe(true);
  });
});

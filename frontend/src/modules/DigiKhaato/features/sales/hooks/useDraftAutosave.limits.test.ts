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

import { emptyInvoiceForm, emptyLine, toWireBody } from './invoiceForm';

/**
 * Found by seeded monkey testing (A3, seeds 3033 and 202, phone and desktop):
 * a discount typed and then deleted — or anything that is not a number — left
 * the form's discount TYPE set and sent `discount_value: null`. The server
 * refuses that pair, so every save of the bill failed with "Please check the
 * highlighted fields" while the field showed "No discount" and nothing was
 * highlighted (the FB-014 complaint), and the draft stopped saving. No number
 * is no discount: the type goes out empty too, for the bill and for a line.
 */
describe('toWireBody discounts', () => {
  const form = () => emptyInvoiceForm('2026-10-26', 'party', '27');

  it('sends no discount type when the bill discount is empty or not a number', () => {
    for (const value of ['', '   ', 'abc', '😀']) {
      const body = toWireBody({ ...form(), discountType: 'amount', discountValue: value });
      expect(body.discount_type).toBeNull();
      expect(body.discount_value).toBeNull();
    }
  });

  it('keeps a real bill discount', () => {
    const body = toWireBody({ ...form(), discountType: 'percent', discountValue: '5' });
    expect(body).toMatchObject({ discount_type: 'percent', discount_value: '5' });
  });

  it('sends no line discount type when the line discount is empty', () => {
    const line = {
      ...emptyLine(),
      itemId: 'i1',
      description: 'Atta',
      qty: '1',
      unitPrice: '10',
      discountType: 'amount' as const,
      discountValue: '',
    };
    const body = toWireBody({ ...form(), lines: [line] });
    const [wire] = body.lines as Record<string, unknown>[];
    expect(wire).toMatchObject({ discount_type: null, discount_value: null });
  });
});

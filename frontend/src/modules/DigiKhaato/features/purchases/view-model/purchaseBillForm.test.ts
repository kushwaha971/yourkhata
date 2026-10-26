import { emptyPurchaseForm, toPurchaseWireBody } from './purchaseBillForm';

/**
 * Found by seeded monkey testing on the sales editor (A3): a discount TYPE with
 * no value is refused by the server and failed every save. The purchase editor
 * mapped discounts the same way; both now go through `utils/discountWire`.
 */
it('sends no purchase discount type when the discount is empty', () => {
  const body = toPurchaseWireBody({
    ...emptyPurchaseForm('2026-10-26', true),
    discountType: 'amount',
    discountValue: '',
  });
  expect(body).toMatchObject({ discount_type: null, discount_value: null });
});

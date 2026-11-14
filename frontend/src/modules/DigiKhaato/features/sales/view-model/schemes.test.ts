import cases from './schemeCases.json';
import { applySchemes, nearestOffer, type SchemeLineInput, type SchemeRule } from './schemes';

/** The server runs the same file (test_scheme_cases.py): a scheme cannot preview one way and bill another. */
describe('applySchemes — schemeCases.json', () => {
  it.each(cases.cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const result = applySchemes(c.lines as SchemeLineInput[], c.schemes as SchemeRule[]);
    expect(result.discounts).toEqual(c.discounts);
    expect(result.free).toEqual(c.free);
  });
});

describe('nearestOffer', () => {
  it('says how much more reaches a percent scheme', () => {
    const offer = nearestOffer(
      [{ item_id: 's', qty: '8', unit_price: '1000', unit_code: 'BOX' }],
      [{ code: 'SURF', rule: 'percent', item_id: 's', amount: '2', min_bill: '10000' }]
    );
    expect(offer?.short).toBe('2000.00');
  });
  it('is quiet once reached or when the item is not on the bill', () => {
    const rule: SchemeRule = { code: 'SURF', rule: 'percent', item_id: 's', amount: '2', min_bill: '10000' };
    expect(nearestOffer([{ item_id: 's', qty: '10', unit_price: '1000', unit_code: 'BOX' }], [rule])).toBeNull();
    expect(nearestOffer([{ item_id: 'x', qty: '1', unit_price: '1', unit_code: 'NOS' }], [rule])).toBeNull();
  });
});

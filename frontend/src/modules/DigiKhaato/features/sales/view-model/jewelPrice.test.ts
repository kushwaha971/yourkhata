import { priceJewel, priceOldGold } from './jewelPrice';

import type { JewelLine } from '../../inventory/api/tagService';

const CHAIN: JewelLine = {
  tag_no: 'GC-1042',
  purity: 'gold_22k',
  gross_g: '12.900',
  stone_g: '0.560',
  net_g: '12.340',
  rate: '11650.00',
  making_type: 'pct',
  making_value: '12.00',
  wastage_pct: '0.00',
  stone_charge: '0.00',
  huid: '7K2P9X',
};

/** The same figures the server's `test_the_design_example_prices_to_the_paisa` asserts. */
it('prices the design example to the paisa, as the server does', () => {
  expect(priceJewel(CHAIN)).toEqual({
    metal: '143761.00',
    making: '17251.32',
    wastage: '0.00',
    stone: '0.00',
    total: '161012.32',
  });
  expect(
    priceJewel({
      ...CHAIN,
      net_g: '3.850',
      making_type: 'per_g',
      making_value: '850',
      stone_charge: '4500',
    })?.total
  ).toBe('52625.00');
});

/** Half to even, as Python's Decimal: 0.125 → 0.12, 0.135 → 0.14 (a float gets these wrong). */
it('rounds a half paisa to even, like the server', () => {
  expect(priceJewel({ ...CHAIN, net_g: '0.125', rate: '1', making_value: '0' })?.metal).toBe(
    '0.12'
  );
  expect(priceJewel({ ...CHAIN, net_g: '0.135', rate: '1', making_value: '0' })?.metal).toBe(
    '0.14'
  );
});

it('waits for a net weight and a rate', () => {
  expect(priceJewel({ ...CHAIN, rate: null })).toBeNull();
  expect(priceJewel({ ...CHAIN, net_g: '' })).toBeNull();
});

/** pOldGold, and the server's `test_old_gold_is_priced_as_the_design_shows`. */
it('prices old gold as the design shows', () => {
  expect(
    priceOldGold({ weightG: '8.200', purity: 'gold_22k', rate: '11650', lessPct: '2' })
  ).toEqual({
    gross: '95530.00',
    less: '1910.60',
    value: '93619.40',
  });
  expect(priceOldGold({ weightG: '', purity: 'gold_22k', rate: '11650', lessPct: '2' })).toBeNull();
});

import { lineUnitCaption, lineUnitChoices } from './lineUnits';

/** D P1a — prevents a box priced as a piece, and a caption that says the wrong unit. */
const ROW = {
  unit: { id: 'u', code: 'PCS', allowDecimal: false },
  sellingPrice: '28.00',
  units: [{ code: 'BOX', factor: '20.000', barcode: null, sellingPrice: null, allowDecimal: false }],
};
const words = {
  sold: (base: string, box: string, n: string) => `Sold in ${base} · ${box} of ${n}`,
  one: (box: string, n: string, base: string) => `1 ${box} = ${n} ${base}`,
};

it('a box without its own price is the piece price × 20', () => {
  expect(lineUnitChoices(ROW).map((c) => [c.code, c.price])).toEqual([
    ['PCS', '28.00'],
    ['BOX', '560.00'],
  ]);
});

it('an item with one unit has no choices and no caption', () => {
  expect(lineUnitChoices({ ...ROW, units: [] })).toEqual([]);
  expect(lineUnitCaption([], 'PCS', words)).toBeNull();
});

it('the caption follows the unit on the line', () => {
  const choices = lineUnitChoices(ROW);
  expect(lineUnitCaption(choices, 'PCS', words)).toBe('Sold in PCS · BOX of 20');
  expect(lineUnitCaption(choices, 'BOX', words)).toBe('1 BOX = 20 PCS');
});

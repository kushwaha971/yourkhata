import { looseLineAmount, looseWeight } from './looseAmount';

it('works out the weight to the gram (design: ₹50 of sugar at ₹44 is 1.136 kg)', () => {
  expect(looseWeight('50', '44')).toBe('1.136');
  expect(looseWeight('100', '52')).toBe('1.923');
  expect(looseWeight('20', '40')).toBe('0.5');
});

it('never weighs out more than the amount asked (₹100 at ₹44 is 2.272 kg, not 2.273)', () => {
  /** 2.273 × ₹44 = ₹100.01: a paisa more than the customer said, on every such sale. */
  expect(looseWeight('100', '44')).toBe('2.272');
  expect(Number(looseLineAmount('2.272', '44'))).toBeLessThanOrEqual(100);
});

it('says what the weighed line comes to at its own rate, not the amount asked', () => {
  /** A bill that printed ₹50 for 1.136 kg at ₹44 would be ₹0.02 off its own arithmetic. */
  expect(looseLineAmount('1.136', '44')).toBe('49.98');
});

it('has no weight for an empty, zero or unreadable amount or rate', () => {
  const cases: [string, string][] = [['', '44'], ['0', '44'], ['50', '0'], ['5o', '44'], ['50', '']];
  for (const [a, r] of cases) expect(looseWeight(a, r)).toBeNull();
});

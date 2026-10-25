import { balancesAfter, canSettle, checkAmount } from './settlementFacts';

/** BP-08 — the preview must never show an after-figure the server would not produce. */
describe('settlementFacts', () => {
  const both = { customerBalance: '1000.00', supplierBalance: '600.00' };

  it('accepts a positive amount up to the cap and refuses everything else', () => {
    expect(checkAmount('600', '600.00')).toBe('ok');
    expect(checkAmount('600.00', '600.00')).toBe('ok');
    expect(checkAmount('600.01', '600.00')).toBe('over');
    expect(checkAmount('0', '600.00')).toBe('zero');
    expect(checkAmount('-5', '600.00')).toBe('invalid');
    expect(checkAmount('1.005', '600.00')).toBe('invalid');
    expect(checkAmount('  ', '600.00')).toBe('empty');
  });

  it('moves both balances down by the amount, and nothing for an unusable amount', () => {
    expect(balancesAfter(both, '600', '600.00')).toEqual({
      customerBalance: '400.00',
      supplierBalance: '0.00',
    });
    expect(balancesAfter(both, '250.50', '600.00')).toEqual({
      customerBalance: '749.50',
      supplierBalance: '349.50',
    });
    expect(balancesAfter(both, '700', '600.00')).toBe(both);
  });

  it('offers to settle only when both sides owe something', () => {
    expect(canSettle('600.00')).toBe(true);
    expect(canSettle('0.00')).toBe(false);
  });
});

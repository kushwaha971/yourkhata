import { clampDiscount } from './clampDiscount';

describe('clampDiscount (R-DEC-59: the box goes back to its limit)', () => {
  it('stops a percent at 100', () => {
    expect(clampDiscount('150', 'percent')).toBe('100');
    expect(clampDiscount('100', 'percent')).toBe('100');
    expect(clampDiscount('12.5', 'percent')).toBe('12.5');
  });

  it('stops rupees at what they come off, so the total cannot go below ₹0', () => {
    expect(clampDiscount('900', 'amount', '845.50')).toBe('845.50');
    expect(clampDiscount('845.50', 'amount', '845.50')).toBe('845.50');
    expect(clampDiscount('20', 'amount', '845.50')).toBe('20');
  });

  it('leaves half-typed text alone', () => {
    expect(clampDiscount('', 'percent')).toBe('');
    expect(clampDiscount('12.', 'percent')).toBe('12.');
  });
});

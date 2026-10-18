import { supplierBalanceOrdering } from './partyListSort';

it('sorts supplier liabilities by magnitude while preserving other server orders', () => {
  /** Largest amount to pay is the most negative API balance, not a customer advance. */
  expect(supplierBalanceOrdering('-balance')).toBe('balance');
  expect(supplierBalanceOrdering('balance')).toBe('-balance');
  expect(supplierBalanceOrdering('oldest_due_on')).toBe('oldest_due_on');
});

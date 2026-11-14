import { screen } from '@testing-library/react';

import { renderWithProviders } from 'src/tests/renderWithProviders';

import { HomeSettlementNote } from './HomeSettlementNote';

/**
 * BP-08 — Home's note under the two lanes. What it protects: the same person in
 * both lanes is said in words with BOTH figures (never one netted figure), the
 * rest are counted rather than listed, and only a member who may record
 * payments is offered Settle.
 */
const CANDIDATES = {
  count: 3,
  results: [
    {
      partyId: 'p1',
      name: 'Ramesh Traders',
      customerBalance: '1000.00',
      supplierBalance: '600.00',
      maxAmount: '600.00',
    },
  ],
};

it('names the person with both figures, counts the others and offers Settle', () => {
  renderWithProviders(
    <HomeSettlementNote candidates={CANDIDATES} canSettle onSettled={jest.fn()} />
  );
  expect(screen.getByTestId('home-settlement-note')).toHaveTextContent(
    'Ramesh Traders is in both lists. As a customer you will get ₹1,000.00 from them, and as a supplier you will give them ₹600.00. These stay separate until you settle them. 2 more people are in both lists.'
  );
  expect(
    screen.getByRole('button', { name: 'Settle two balances for Ramesh Traders' })
  ).toBeVisible();
  expect(screen.queryByText('₹400.00', { exact: false })).toBeNull();
});

it('a member who may not record payments reads the note without a button', () => {
  renderWithProviders(
    <HomeSettlementNote
      candidates={{ ...CANDIDATES, count: 1 }}
      canSettle={false}
      onSettled={jest.fn()}
    />
  );
  expect(screen.getByTestId('home-settlement-note')).not.toHaveTextContent('more people');
  expect(screen.queryByRole('button')).toBeNull();
});

import { screen } from '@testing-library/react';

import { renderWithProviders } from 'src/tests/renderWithProviders';

import { HomeBalanceLane } from './HomeBalanceLane';
/** A cached dashboard headline must not contradict the fresh lane's bands/counts. */
it('uses the same role snapshot for headline and balance bands', () => {
  renderWithProviders(
    <HomeBalanceLane
      supplier={false}
      amount="1000.00"
      href="/customers"
      details={{
        total: '600.00',
        count: 1,
        bands: [{ key: 'not_due', amount: '600.00' }],
        people: [],
      }}
      people={[]}
      canAct={false}
      onAct={jest.fn()}
    />
  );
  expect(screen.getByRole('link', { name: 'To collect ₹600.00' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'To collect ₹1,000.00' })).not.toBeInTheDocument();
});

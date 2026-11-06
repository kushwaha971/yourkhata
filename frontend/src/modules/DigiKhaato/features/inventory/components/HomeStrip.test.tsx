import { screen } from '@testing-library/react';

import { renderWithProviders } from 'src/tests/renderWithProviders';

import { HomeStrip } from './HomeStrip';

jest.mock('../api/homeStripService', () => ({ getHomeStrip: jest.fn() }));
const service = jest.requireMock('../api/homeStripService');

/** A kirana keeps none of these: Home must not gain an empty box. */
test('draws nothing when the business keeps no batches, IMEIs or sizes', async () => {
  service.getHomeStrip.mockResolvedValue([]);
  renderWithProviders(<HomeStrip />);
  await Promise.resolve();
  expect(screen.queryByTestId('home-strip')).toBeNull();
});

/** The tile says the server's count, and "Worth" only when a value came. */
test("shows each tile with the server's figures", async () => {
  service.getHomeStrip.mockResolvedValue([
    { key: 'expiring', count: 6, value: '4818.00' },
    { key: 'phones', count: 10, value: null },
  ]);
  renderWithProviders(<HomeStrip />);
  expect(await screen.findByText('6 batches')).toBeInTheDocument();
  expect(screen.getByText('Worth ₹4,818.00')).toBeInTheDocument();
  expect(screen.getByTestId('home-strip-phones')).toHaveTextContent('Phones in stock10');
});

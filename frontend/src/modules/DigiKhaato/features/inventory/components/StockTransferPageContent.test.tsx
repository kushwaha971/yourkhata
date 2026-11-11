import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { sessionLoaded } from 'src/redux/slice/sessionSlice';
import { store } from 'src/redux/store';
import { renderWithProviders } from 'src/tests/renderWithProviders';

import { StockTransferPageContent } from './StockTransferPageContent';

jest.mock('../api/transferService', () => ({
  listPlaces: jest.fn(),
  addPlace: jest.fn(),
  placeStock: jest.fn(),
  postTransfer: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/stock/transfer',
}));

const service = jest.requireMock('../api/transferService') as { listPlaces: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  store.dispatch(
    sessionLoaded({
      user: {
        id: 'u1',
        name: 'Owner',
        email: 'owner@shop.test',
        mobile: null,
        locale: 'en',
        mustChangePassword: false,
        passwordExpiresAt: null,
      },
      activeTenant: { id: 't1', name: 'Kumar Stores', timezone: 'Asia/Kolkata' },
      tenants: [{ id: 't1', name: 'Kumar Stores', timezone: 'Asia/Kolkata' }],
      permissions: ['inventory.stock.adjust'],
      enabledModules: ['inventory'],
      version: 1,
    } as never)
  );
});

/**
 * Shop round (11 Nov 2026): when the places failed to load, the screen said
 * "Your stock is in one place now" and offered to add a godown — to a shop
 * that may already have one. A failed load says so and offers to try again.
 */
it('says it could not load, never "one place", when the places fail', async () => {
  service.listPlaces.mockRejectedValueOnce(new Error('500'));
  service.listPlaces.mockResolvedValueOnce([
    { id: 'p1', name: 'Shop', isDefault: true },
    { id: 'p2', name: 'Godown', isDefault: false },
  ]);
  renderWithProviders(<StockTransferPageContent />);

  expect(await screen.findByText('We could not load this')).toBeInTheDocument();
  expect(screen.queryByText('Add your godown')).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText(/Godown/)).toBeInTheDocument();
  expect(screen.queryByText('We could not load this')).not.toBeInTheDocument();
});

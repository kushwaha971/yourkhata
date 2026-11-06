import { waitFor } from '@testing-library/react';

import { sessionLoaded } from 'src/redux/slice/sessionSlice';
import { store } from 'src/redux/store';
import { renderWithProviders } from 'src/tests/renderWithProviders';

import { useReminderChoices } from './useReminderChoices';

/**
 * D15 `pRemind`. Prevents: a customer being told an order is ready when theirs
 * is not (another customer's ready order, found by a name search), a rate
 * message with no rate typed today, and another kind of shop seeing or
 * requesting any of it.
 */
jest.mock('modules/DigiKhaato/features/sales/api/customOrderService', () => ({
  listCustomOrders: jest.fn(),
}));
jest.mock('modules/DigiKhaato/features/inventory/api/metalRateService', () => ({
  PURITIES: ['gold_24k', 'gold_22k', 'gold_18k', 'silver'],
  getTodayRates: jest.fn(),
}));
const orders = jest.requireMock('modules/DigiKhaato/features/sales/api/customOrderService') as {
  listCustomOrders: jest.Mock;
};
const rates = jest.requireMock('modules/DigiKhaato/features/inventory/api/metalRateService') as {
  getTodayRates: jest.Mock;
};

const signIn = (features: string[]) =>
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
      activeTenant: {
        id: 't1',
        name: 'Shree Jewellers',
        timezone: 'Asia/Kolkata',
        role: 'owner',
        features,
      },
      tenants: [],
      permissions: [],
      enabledModules: [],
    } as never)
  );

const run = () => {
  const result: { current: ReturnType<typeof useReminderChoices> } = { current: [] };
  function Probe(): null {
    result.current = useReminderChoices(true, { id: 'p1', name: 'Ramesh' });
    return null;
  }
  renderWithProviders(<Probe />);
  return { result };
};

beforeEach(() => jest.clearAllMocks());

test('another customer ready order and a day with no rate offer only the payment reminder', async () => {
  signIn(['jewellery']);
  orders.listCustomOrders.mockResolvedValue({
    rows: [{ party: { id: 'p2' }, status: 'ready', what: 'ring', number: 'ORD-1' }],
  });
  rates.getTodayRates.mockResolvedValue({ today: null });
  const { result } = run();
  await waitFor(() => expect(rates.getTodayRates).toHaveBeenCalled());
  await waitFor(() => expect(orders.listCustomOrders).toHaveBeenCalled());
  expect(result.current.map((c) => c.key)).toEqual(['payment']);
});

test('their ready order and todays rate become choices with real figures', async () => {
  signIn(['jewellery']);
  orders.listCustomOrders.mockResolvedValue({
    rows: [
      { party: { id: 'p1' }, status: 'ready', what: 'ring', number: 'ORD-7', fixedRate: null },
    ],
  });
  rates.getTodayRates.mockResolvedValue({ today: { rates: { gold_22k: '11650.00' } } });
  const { result } = run();
  await waitFor(() => expect(result.current).toHaveLength(3));
  expect(result.current[1]?.text).toContain('ORD-7');
  expect(result.current[2]?.text).toContain('11,650');
});

test('another kind of shop makes no request and gets no choices', () => {
  signIn(['serials']);
  const { result } = run();
  expect(result.current).toEqual([]);
  expect(orders.listCustomOrders).not.toHaveBeenCalled();
});

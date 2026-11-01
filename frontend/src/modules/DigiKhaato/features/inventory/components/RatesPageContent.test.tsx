import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { sessionLoaded } from 'src/redux/slice/sessionSlice';
import { store } from 'src/redux/store';
import { renderWithProviders } from 'src/tests/renderWithProviders';
import type { PermissionCode } from 'src/types/domain.types';

import { RatesPageContent } from './RatesPageContent';

import type { TodayRates } from '../api/metalRateService';

/**
 * G1 — Today's rate (design §G1). These pin that the boxes show today's saved
 * figures, that Same as yesterday fills the boxes and sends NOTHING (the owner
 * still checks and taps Save), that Save sends exactly what was typed with a
 * blank purity as null, that a zero rate is refused by name before any
 * request, and that staff can read the rate but not change it.
 */
jest.mock('../api/metalRateService', () => ({
  ...jest.requireActual('../api/metalRateService'),
  getTodayRates: jest.fn(),
  saveTodayRates: jest.fn(),
  getRateHistory: jest.fn(),
}));
const service = jest.requireMock('../api/metalRateService') as {
  getTodayRates: jest.Mock;
  saveTodayRates: jest.Mock;
  getRateHistory: jest.Mock;
};

const rates: TodayRates = {
  day: '2026-10-30',
  today: null,
  yesterday: {
    day: '2026-10-29',
    rates: { gold_24k: '12650.00', gold_22k: '11595.00', gold_18k: null, silver: '151.00' },
    setBy: 'Owner',
    setAt: '2026-10-29T10:12:00+05:30',
  },
};

const signIn = (permissions: readonly PermissionCode[]) =>
  store.dispatch(
    sessionLoaded({
      user: {
        id: 'u1',
        name: 'Owner',
        email: 'o@shop.test',
        mobile: null,
        locale: 'en',
        mustChangePassword: false,
        passwordExpiresAt: null,
      },
      activeTenant: { id: 't1', name: 'Soni Jewellers', timezone: 'Asia/Kolkata' },
      tenants: [{ id: 't1', name: 'Soni Jewellers', timezone: 'Asia/Kolkata' }],
      permissions: [...permissions],
      enabledModules: ['inventory'],
      version: 1,
    })
  );

beforeEach(() => {
  jest.clearAllMocks();
  service.getTodayRates.mockResolvedValue(rates);
  service.getRateHistory.mockResolvedValue({ month: '2026-10', rows: [] });
  service.saveTodayRates.mockImplementation(async (body) => ({
    ...rates,
    today: { day: '2026-10-30', rates: body, setBy: 'Owner', setAt: '2026-10-30T10:05:00+05:30' },
  }));
});

it('Same as yesterday fills the boxes and saves nothing until Save rates', async () => {
  signIn(['inventory.item.read', 'inventory.item.write']);
  renderWithProviders(<RatesPageContent />);
  await userEvent.click(await screen.findByRole('button', { name: 'Same as yesterday' }));
  expect(screen.getByLabelText('Gold 22K (916)')).toHaveValue('11,595');
  expect(service.saveTodayRates).not.toHaveBeenCalled();

  await userEvent.click(screen.getByRole('button', { name: 'Save rates' }));
  await waitFor(() =>
    expect(service.saveTodayRates).toHaveBeenCalledWith({
      gold_24k: '12650',
      gold_22k: '11595',
      gold_18k: null,
      silver: '151',
    })
  );
});

it('refuses a zero rate by name and sends nothing', async () => {
  signIn(['inventory.item.read', 'inventory.item.write']);
  renderWithProviders(<RatesPageContent />);
  await waitFor(() => expect(screen.getByLabelText('Silver (999)')).toBeEnabled());
  await userEvent.type(screen.getByLabelText('Silver (999)'), '0');
  await userEvent.click(screen.getByRole('button', { name: 'Save rates' }));
  expect(await screen.findByText('Enter a rate above zero.')).toHaveAttribute('role', 'alert');
  expect(service.saveTodayRates).not.toHaveBeenCalled();
});

it('staff read the rate but cannot change it', async () => {
  signIn(['inventory.item.read']);
  renderWithProviders(<RatesPageContent />);
  await screen.findByRole('button', { name: 'Same as yesterday' });
  expect(screen.getByLabelText('Gold 22K (916)')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Save rates' })).toBeDisabled();
});

it('a whole rupee rate still reads whole after leaving the box (not 12,710.00)', async () => {
  signIn(['inventory.item.read', 'inventory.item.write']);
  renderWithProviders(<RatesPageContent />);
  await waitFor(() => expect(screen.getByLabelText('Gold 24K (999)')).toBeEnabled());
  await userEvent.type(screen.getByLabelText('Gold 24K (999)'), '12710');
  await userEvent.tab();
  expect(screen.getByLabelText('Gold 24K (999)')).toHaveValue('12,710');
});

it('paise read as two digits: Yesterday ₹150.50, not ₹150.5', async () => {
  signIn(['inventory.item.read']);
  const yesterday = rates.yesterday as NonNullable<TodayRates['yesterday']>;
  service.getTodayRates.mockResolvedValue({
    ...rates,
    yesterday: { ...yesterday, rates: { ...yesterday.rates, silver: '150.50' } },
  });
  renderWithProviders(<RatesPageContent />);
  expect(await screen.findByText('Yesterday ₹150.50')).toBeInTheDocument();
});

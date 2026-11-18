import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { sessionLoaded } from 'src/redux/slice/sessionSlice';
import { store } from 'src/redux/store';
import { renderWithProviders } from 'src/tests/renderWithProviders';

import { ShopFeaturesPageContent } from './ShopFeaturesPageContent';

/**
 * B3 — Settings › Shop features. Prevents: the wholesale switch saving
 * without orders (a wholesaler with no challans), a switch that saves the
 * wrong key, and switches shown for features that have no screen yet.
 */
jest.mock('../api/settingsService');
const service = jest.requireMock('../api/settingsService') as {
  fetchSettings: jest.Mock;
  saveSettings: jest.Mock;
};

const settings = (values: Record<string, unknown>) => ({
  values,
  numbering: {},
  fyLabel: '2026-27',
  modules: { enabled: ['sales'], available: ['sales'], locked: [], core: [] },
  calendarReaders: [],
  etag: '"x"',
});

beforeEach(() => {
  service.fetchSettings.mockReset();
  service.saveSettings.mockReset();
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
        name: 'Shree Ganesh Kirana',
        timezone: 'Asia/Kolkata',
        role: 'owner',
        words: { en: { 'business.kind': 'Kirana' } },
      },
      tenants: [{ id: 't1', name: 'Shree Ganesh Kirana', timezone: 'Asia/Kolkata', role: 'owner' }],
      permissions: ['platform.tenant.manage'],
      enabledModules: ['sales'],
      version: 1,
    })
  );
});

it('turns on wholesale together with orders and challans, and shows only built switches', async () => {
  const start = { 'shop.wholesale': { value: false }, 'shop.features.orders': { value: false } };
  service.fetchSettings.mockResolvedValue(settings(start));
  service.saveSettings.mockImplementation(async (values: Record<string, unknown>) => settings(values));
  const user = userEvent.setup();
  renderWithProviders(<ShopFeaturesPageContent />);

  expect(await screen.findByText('Kirana')).toBeInTheDocument();
  // Only the switches whose screens exist: wholesale and orders.
  expect(screen.getAllByRole('switch')).toHaveLength(2);
  expect(screen.queryByRole('switch', { name: /Batch and expiry/ })).toBeNull();

  await user.click(screen.getByRole('switch', { name: /I also sell wholesale/ }));
  await waitFor(() => expect(service.saveSettings).toHaveBeenCalledTimes(1));
  expect(service.saveSettings.mock.calls[0][0]).toMatchObject({
    'shop.wholesale': { value: true },
    'shop.features.orders': { value: true },
  });
});

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { sessionLoaded } from 'src/redux/slice/sessionSlice';
import { store } from 'src/redux/store';
import { renderWithProviders } from 'src/tests/renderWithProviders';

import { BillDefaultsPanel } from './BillDefaultsPanel';

/**
 * Design S4 — "On every bill". Prevents: the terms line and the UPI QR switch,
 * which the bills read, having no screen to set them; and an accountant being
 * able to change them.
 */
jest.mock('modules/DigiKhaato/features/settings/api/settingsService');
const service = jest.requireMock('modules/DigiKhaato/features/settings/api/settingsService') as {
  fetchSettings: jest.Mock;
  saveSettings: jest.Mock;
};

const data = {
  values: { 'documents.terms': { text: 'No return once sold.' }, 'documents.show_upi_qr': { value: true } },
  numbering: {},
  fyLabel: '2026-27',
  modules: { enabled: ['platform'], available: ['platform'], locked: [], core: ['platform'] },
  calendarReaders: [],
  etag: '"x"',
};

const signIn = (role: string, permissions: string[]) =>
  store.dispatch(
    sessionLoaded({
      user: { id: 'u1', name: 'A', email: 'a@x.test', mobile: null, locale: 'en', mustChangePassword: false, passwordExpiresAt: null },
      activeTenant: { id: 't1', name: 'Shop', timezone: 'Asia/Kolkata', role },
      tenants: [{ id: 't1', name: 'Shop', timezone: 'Asia/Kolkata', role }],
      permissions: permissions as never,
      enabledModules: [],
      version: 1,
    })
  );

beforeEach(() => {
  service.fetchSettings.mockResolvedValue(data);
  service.saveSettings.mockResolvedValue(data);
});

it('the owner turns the UPI QR off with one tap and saves the terms line', async () => {
  signIn('owner', ['platform.tenant.manage']);
  const user = userEvent.setup();
  renderWithProviders(<BillDefaultsPanel />);
  const qr = await screen.findByRole('switch', { name: /Show the UPI QR/ });
  expect(qr).toBeChecked();
  await user.click(qr);
  await waitFor(() => expect(service.saveSettings).toHaveBeenCalled());
  expect(JSON.stringify(service.saveSettings.mock.calls[0])).toContain('"documents.show_upi_qr":{"value":false}');

  const terms = screen.getByLabelText('Terms line');
  expect(terms).toHaveValue('No return once sold.');
  await user.clear(terms);
  await user.type(terms, 'Goods checked at the counter.');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(JSON.stringify(service.saveSettings.mock.calls.at(-1))).toContain('Goods checked at the counter.')
  );
});

it('the accountant reads both and can change neither', async () => {
  signIn('accountant', ['platform.audit.read']);
  renderWithProviders(<BillDefaultsPanel />);
  expect(await screen.findByRole('switch', { name: /Show the UPI QR/ })).toBeDisabled();
  expect(screen.getByLabelText('Terms line')).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
});

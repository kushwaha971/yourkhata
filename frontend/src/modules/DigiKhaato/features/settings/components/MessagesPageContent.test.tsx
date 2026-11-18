import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { sessionLoaded } from 'src/redux/slice/sessionSlice';
import { store } from 'src/redux/store';
import { renderWithProviders } from 'src/tests/renderWithProviders';

import { fillMessage } from '../hooks/useKindMessage';

import { MessagesPageContent } from './MessagesPageContent';

/**
 * D15 — Settings › Messages. Prevents: a kind seeing another kind's messages,
 * a save dropping the other language's words, and the payment reminder gaining
 * a second copy of its words that the reminder renderer never reads.
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
      tenants: [{ id: 't1', name: 'Shree Jewellers', timezone: 'Asia/Kolkata', role: 'owner' }],
      permissions: ['platform.tenant.manage'],
      enabledModules: ['sales'],
      version: 1,
    } as never)
  );

const start = {
  'shop.messages': { order_ready: { en: '', hi: 'हिंदी शब्द' } },
  'ledger.reminder_templates': { en: 'Pay {amount}', hi: 'दें {amount}' },
};

beforeEach(() => {
  service.fetchSettings.mockReset().mockResolvedValue(settings(start));
  service.saveSettings
    .mockReset()
    .mockImplementation(async (values: Record<string, unknown>) =>
      settings({ ...start, ...values })
    );
});

it('saves a message in the language on screen and keeps the other', async () => {
  signIn(['jewellery']);
  const user = userEvent.setup();
  renderWithProviders(<MessagesPageContent />);

  await user.click(await screen.findByRole('button', { name: 'Edit Custom order ready' }));
  const box = screen.getByRole('textbox', { name: 'Message' });
  await user.clear(box);
  await user.type(box, 'Ready at shop');
  await user.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => expect(service.saveSettings).toHaveBeenCalledTimes(1));
  expect(service.saveSettings.mock.calls[0][0]).toMatchObject({
    'shop.messages': { order_ready: { en: 'Ready at shop', hi: 'हिंदी शब्द' } },
  });
});

it('edits the payment reminder in the template the renderer reads', async () => {
  signIn(['jewellery']);
  const user = userEvent.setup();
  renderWithProviders(<MessagesPageContent />);

  await user.click(await screen.findByRole('button', { name: 'Edit Payment reminder' }));
  await user.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => expect(service.saveSettings).toHaveBeenCalledTimes(1));
  expect(service.saveSettings.mock.calls[0][0]).toMatchObject({
    'ledger.reminder_templates': { en: 'Pay {amount}', hi: 'दें {amount}' },
  });
});

it('lists no jeweller messages for another kind', async () => {
  signIn(['orders']);
  renderWithProviders(<MessagesPageContent />);

  expect(await screen.findByText('No messages of its own')).toBeInTheDocument();
  expect(screen.queryByText('Custom order ready')).toBeNull();
});

it('leaves a word it does not know visible rather than blank', () => {
  expect(fillMessage('{name} {other}', { name: 'Ramesh' })).toBe('Ramesh {other}');
});

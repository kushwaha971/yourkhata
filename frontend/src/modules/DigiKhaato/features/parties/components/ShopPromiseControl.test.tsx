import { useEffect } from 'react';

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetAllFeatureState } from 'src/redux/actions';
import { browserCameOnline } from 'src/redux/slice/networkSlice';
import { sessionLoaded } from 'src/redux/slice/sessionSlice';
import { store } from 'src/redux/store';
import { renderWithProviders } from 'src/tests/renderWithProviders';
import { todayInTenantTz } from 'src/utils/dates';

import { ShopPromiseControl } from './ShopPromiseControl';

import type { ShopPromise } from '../types/shopPromise.types';

/**
 * BP-16 — a Shop promise on the person page. What these protect: the line
 * says who pays and when in the role being looked at (a supplier's page says
 * "You will pay"); "Promise kept" closes the promise ONCE, records no money and
 * tells the shopkeeper to record the payment; a screen that was out of date is
 * reloaded instead of overwriting another phone's change; and a role that may
 * not write sees the promise without a single button.
 */
jest.mock('../api/shopPromiseService', () => ({
  ...jest.requireActual('../api/shopPromiseService'),
  listPartyPromises: jest.fn(),
  createPromise: jest.fn(),
  changePromise: jest.fn(),
  closePromise: jest.fn(),
}));
const service = jest.requireMock('../api/shopPromiseService') as Record<
  'listPartyPromises' | 'createPromise' | 'changePromise' | 'closePromise',
  jest.Mock
>;

const TODAY = todayInTenantTz('Asia/Kolkata');

const PROMISE = (over: Partial<ShopPromise> = {}): ShopPromise => ({
  id: 'p1',
  party: { id: 'party-1', name: 'Sharma General Store' },
  role: 'customer',
  promisedOn: TODAY,
  amount: '1500.00',
  note: 'After the market',
  state: 'open',
  daysLate: 0,
  version: 1,
  createdAt: '2026-10-20T10:00:00Z',
  createdBy: 'Owner',
  closedAt: null,
  closedBy: null,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  store.dispatch(resetAllFeatureState());
  store.dispatch(browserCameOnline());
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
      permissions: ['parties.party.read', 'parties.party.write'],
      enabledModules: ['parties'],
      version: 1,
    })
  );
  service.listPartyPromises.mockResolvedValue([PROMISE()]);
});

const show = (role: 'customer' | 'supplier' = 'customer', canWrite = true) =>
  renderWithProviders(<ShopPromiseControl partyId="party-1" role={role} canWrite={canWrite} />);

it('says the open promise in words, with the note, and how late it is', async () => {
  service.listPartyPromises.mockResolvedValue([PROMISE({ promisedOn: '2026-10-21', daysLate: 3 })]);
  show();
  expect(await screen.findByTestId('shop-promise-line')).toHaveTextContent(
    /^Will pay ₹1,500\.00 on .*21 Oct$/
  );
  expect(screen.getByText('3 days late')).toBeInTheDocument();
  expect(screen.getByText('After the market')).toBeInTheDocument();
  expect(service.listPartyPromises).toHaveBeenCalledWith('party-1', 'customer', expect.anything());
});

it("a supplier's page reads the shop's own promise", async () => {
  service.listPartyPromises.mockResolvedValue([
    PROMISE({ role: 'supplier', amount: null, note: '' }),
  ]);
  show('supplier');
  expect(await screen.findByTestId('shop-promise-line')).toHaveTextContent('You will pay today');
  expect(screen.getByRole('heading', { name: 'Your promise to pay' })).toBeInTheDocument();
  expect(service.listPartyPromises).toHaveBeenCalledWith('party-1', 'supplier', expect.anything());
});

it('a role that may not write sees the promise and no buttons', async () => {
  show('customer', false);
  await screen.findByTestId('shop-promise-line');
  expect(within(screen.getByTestId('shop-promise')).queryByRole('button')).toBeNull();
});

it('"Promise kept" closes it once, moves it to history and asks for the payment', async () => {
  let finish: (value: ShopPromise) => void = () => undefined;
  service.closePromise.mockReturnValue(
    new Promise<ShopPromise>((resolve) => {
      finish = resolve;
    })
  );
  show();
  const kept = await screen.findByTestId('shop-promise-kept');
  await userEvent.click(kept);
  await userEvent.click(kept); // a second tap while the first is in flight
  finish(PROMISE({ state: 'kept', version: 2, closedBy: 'Owner', daysLate: null }));
  await waitFor(() =>
    expect(store.getState().snackbar.id).toBe('parties.shopPromise.keptDone')
  );
  expect(service.closePromise).toHaveBeenCalledTimes(1);
  expect(service.closePromise.mock.calls[0]?.[1]).toBe('kept');
  expect(screen.getByTestId('shop-promise-none')).toHaveTextContent('No promise');
  await userEvent.click(screen.getByRole('button', { name: 'Earlier promises' }));
  expect(screen.getByTestId('shop-promise-history')).toHaveTextContent('Kept');
});

it('a screen that was out of date reloads instead of overwriting', async () => {
  service.closePromise.mockRejectedValue({ code: 'stale_version', status: 409 });
  show();
  await userEvent.click(await screen.findByTestId('shop-promise-cancel'));
  await waitFor(() => expect(service.listPartyPromises).toHaveBeenCalledTimes(2));
});

it('a retry after a dropped connection sends the same key', async () => {
  service.closePromise
    .mockRejectedValueOnce({ code: 'network_error', status: null })
    .mockResolvedValueOnce(PROMISE({ state: 'kept', version: 2 }));
  show();
  await userEvent.click(await screen.findByTestId('shop-promise-kept'));
  await waitFor(() => expect(service.closePromise).toHaveBeenCalledTimes(1));
  await userEvent.click(screen.getByTestId('shop-promise-kept'));
  await waitFor(() => expect(service.closePromise).toHaveBeenCalledTimes(2));
  const keys = service.closePromise.mock.calls.map((call: unknown[]) => call[2]);
  expect(keys[0]).toBe(keys[1]);
});

it('adds a promise from a quick date, saving the amount and no note', async () => {
  service.listPartyPromises.mockResolvedValue([]);
  service.createPromise.mockImplementation((_id: string, _role: string, values: { promisedOn: string }) =>
    Promise.resolve(PROMISE({ promisedOn: values.promisedOn, note: '' }))
  );
  show();
  await userEvent.click(await screen.findByTestId('shop-promise-add'));
  const drawer = await screen.findByTestId('shop-promise-drawer');
  expect(drawer).toHaveTextContent('It does not change any bill or what they have to pay.');
  await userEvent.click(within(drawer).getByRole('button', { name: /Tomorrow/ }));
  await userEvent.type(within(drawer).getByLabelText(/How much/), '1500');
  await userEvent.click(screen.getByTestId('shop-promise-save'));
  await waitFor(() => expect(service.createPromise).toHaveBeenCalledTimes(1));
  const [partyId, role, values] = service.createPromise.mock.calls[0] as [
    string,
    string,
    { promisedOn: string; amount: string | null; note: string },
  ];
  expect([partyId, role]).toEqual(['party-1', 'customer']);
  expect(values.promisedOn > TODAY).toBe(true);
  expect(values.amount).toBe('1500.00');
  expect(await screen.findByTestId('shop-promise-line')).toHaveTextContent(/^Will pay ₹1,500\.00 on /);
});

it('the form refuses a day already past and a zero amount, and allows no amount', async () => {
  const { useShopPromiseSchema } = await import('../validation/shopPromiseSchema');
  const built: { schema?: ReturnType<typeof useShopPromiseSchema> } = {};
  function Capture(): null {
    const schema = useShopPromiseSchema('2026-10-24');
    useEffect(() => {
      built.schema = schema;
    });
    return null;
  }
  renderWithProviders(<Capture />);
  const schema = built.schema;
  if (!schema) throw new Error('schema not built');
  await expect(
    schema.validate({ promisedOn: '2026-10-23', amount: '', note: '' })
  ).rejects.toThrow('Choose today or a later date.');
  await expect(
    schema.validate({ promisedOn: '2026-10-24', amount: '0', note: '' })
  ).rejects.toThrow('The amount must be more than zero.');
  await expect(
    schema.validate({ promisedOn: '2026-10-24', amount: '', note: '' })
  ).resolves.toMatchObject({ promisedOn: '2026-10-24' });
});

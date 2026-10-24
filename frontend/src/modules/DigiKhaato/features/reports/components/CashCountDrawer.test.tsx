import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetAllFeatureState } from 'src/redux/actions';
import { browserCameOnline, browserWentOffline } from 'src/redux/slice/networkSlice';
import { sessionLoaded } from 'src/redux/slice/sessionSlice';
import { store } from 'src/redux/store';
import { renderWithProviders } from 'src/tests/renderWithProviders';

import { CashCountDrawer } from './CashCountDrawer';

import type { CashCount } from '../types/reports.types';

/**
 * BP-17 — counting the Shop's drawer from Home. What these protect: the
 * comparison the owner reads after saving is the SERVER's (its figure at the
 * save, not the one loaded when the drawer opened); a retry after a dropped
 * connection reuses the key so one count is recorded; a refused amount is said
 * on the field; and a count is never saved offline against a stale figure.
 */
jest.mock('../api/cashCountService', () => ({
  ...jest.requireActual('../api/cashCountService'),
  listCashCounts: jest.fn(),
  recordCashCount: jest.fn(),
}));
const service = jest.requireMock('../api/cashCountService') as {
  listCashCounts: jest.Mock;
  recordCashCount: jest.Mock;
};

const COUNT = (over: Partial<CashCount> = {}): CashCount => ({
  id: 'c1',
  businessDate: '2026-10-23',
  countedAt: '2026-10-23T12:30:00Z',
  countedAmount: '1450.00',
  expectedAmount: '1500.00',
  variance: '-50.00',
  note: 'Two notes torn',
  countedBy: { id: 'u1', name: 'Asha' },
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
      permissions: ['reports.financial.read'],
      enabledModules: ['reports', 'payments', 'expenses'],
      version: 1,
    })
  );
  service.listCashCounts.mockResolvedValue({
    counts: [COUNT({ movedSince: '200.00' })],
    expectedNow: '1700.00',
  });
});

const open = (onSaved = jest.fn()) => {
  renderWithProviders(<CashCountDrawer open onClose={jest.fn()} onSaved={onSaved} />);
  return onSaved;
};

it("shows the records' figure and says the difference while the owner types", async () => {
  open();
  expect(await screen.findByText('₹1,700.00')).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText(/Cash you counted/), '1650');
  expect(screen.getByTestId('cash-count-preview')).toHaveTextContent('Short by ₹50.00');
  await userEvent.clear(screen.getByLabelText(/Cash you counted/));
  await userEvent.type(screen.getByLabelText(/Cash you counted/), '1700');
  expect(screen.getByTestId('cash-count-preview')).toHaveTextContent('Matches');
  expect(
    screen.getByText(/does not change your cash, bills or payments/)
  ).toBeInTheDocument();
});

it("reports the server's comparison at the save, not the figure loaded at opening", async () => {
  // A ₹100 sale was rung up while counting: the server compared with ₹1,800.
  service.recordCashCount.mockResolvedValue(
    COUNT({ id: 'c2', countedAmount: '1700.00', expectedAmount: '1800.00', variance: '-100.00', note: '' })
  );
  const onSaved = open();
  await screen.findByText('₹1,700.00');
  await userEvent.type(screen.getByLabelText(/Cash you counted/), '1700');
  await userEvent.type(screen.getByLabelText(/Note/), ' kept aside ');
  await userEvent.click(screen.getByTestId('cash-count-save'));
  const result = await screen.findByTestId('cash-count-result');
  expect(result).toHaveTextContent('Short by ₹100.00');
  expect(result).toHaveTextContent('Your records said ₹1,800.00 then');
  expect(service.recordCashCount).toHaveBeenCalledWith(
    { countedAmount: '1700.00', note: ' kept aside ' },
    expect.any(String)
  );
  expect(onSaved).toHaveBeenCalledTimes(1);
});

it('retries with the same key after a dropped connection, so one count is kept', async () => {
  service.recordCashCount
    .mockRejectedValueOnce({ code: 'network_error', message: 'x', details: {} })
    .mockResolvedValueOnce(COUNT({ id: 'c3', variance: '0.00' }));
  open();
  await screen.findByText('₹1,700.00');
  await userEvent.type(screen.getByLabelText(/Cash you counted/), '1500');
  await userEvent.click(screen.getByTestId('cash-count-save'));
  await waitFor(() => expect(service.recordCashCount).toHaveBeenCalledTimes(1));
  await userEvent.click(screen.getByTestId('cash-count-save'));
  await screen.findByTestId('cash-count-result');
  const keys = (service.recordCashCount.mock.calls as [unknown, string][]).map((call) => call[1]);
  expect(keys).toHaveLength(2);
  expect(keys[1]).toBe(keys[0]);
});

it('says a refused amount on the field', async () => {
  service.recordCashCount.mockRejectedValue({
    code: 'validation_error',
    message: 'Check the form.',
    details: { counted_amount: ['Ensure that there are no more than 2 decimal places.'] },
  });
  open();
  await screen.findByText('₹1,700.00');
  await userEvent.type(screen.getByLabelText(/Cash you counted/), '15');
  await userEvent.click(screen.getByTestId('cash-count-save'));
  expect(await screen.findByText(/no more than 2 decimal places/)).toBeInTheDocument();
  expect(screen.queryByTestId('cash-count-result')).not.toBeInTheDocument();
});

it('lists earlier counts with who counted, the note, and what moved since', async () => {
  open();
  const rows = await screen.findAllByTestId('cash-count-row');
  expect(rows).toHaveLength(1);
  expect(rows[0]).toHaveTextContent('Counted on 23/10/2026');
  expect(rows[0]).toHaveTextContent('₹1,450.00');
  expect(rows[0]).toHaveTextContent('Short by ₹50.00');
  expect(rows[0]).toHaveTextContent('by Asha · Two notes torn');
  expect(rows[0]).toHaveTextContent('changed by ₹200.00 since');
});

it('will not save a count offline, and says why', async () => {
  open();
  await screen.findByText('₹1,700.00');
  act(() => {
    store.dispatch(browserWentOffline());
  });
  expect(await screen.findByText(/needs a connection/)).toBeInTheDocument();
  expect(screen.getByTestId('cash-count-save')).toBeDisabled();
});

it('offers a retry when the figure could not be read, and cannot save without it', async () => {
  service.listCashCounts.mockRejectedValueOnce(new Error('x'));
  open();
  expect(await screen.findByText(/Could not load the cash figure/)).toBeInTheDocument();
  expect(screen.getByTestId('cash-count-save')).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('₹1,700.00')).toBeInTheDocument();
});

it("says the records' figure leaves out opening cash, as Home does", async () => {
  renderWithProviders(
    <CashCountDrawer open since="2025-10-18" onClose={jest.fn()} onSaved={jest.fn()} />
  );
  expect(await screen.findByTestId('cash-count-since')).toHaveTextContent(
    'Since 18/10/2025 · opening cash excluded'
  );
});

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetAllFeatureState } from 'src/redux/actions';
import { browserCameOnline } from 'src/redux/slice/networkSlice';
import { sessionLoaded } from 'src/redux/slice/sessionSlice';
import { store } from 'src/redux/store';
import { renderWithProviders } from 'src/tests/renderWithProviders';

import { SettleBalancesDialog } from './SettleBalancesDialog';

import type { SettlementFigures, ShopSettlement } from '../types/shopSettlement.types';

/**
 * BP-08 — settling a person who is both a customer and a supplier. What these
 * protect: both balances are shown side by side and never as one netted figure;
 * the amount is prefilled with the smaller and capped at it; "After this" shows
 * both results before anything is written; Keep separate has the focus; one tap
 * settles ONCE and sends the figures the merchant saw; and when the server says
 * those figures moved, the new ones replace them instead of settling the old.
 */
jest.mock('../api/shopSettlementService', () => ({
  fetchSettlementFigures: jest.fn(),
  settleBalances: jest.fn(),
  fetchSettlementMessage: jest.fn(),
  listSettlementCandidates: jest.fn(),
}));
const service = jest.requireMock('../api/shopSettlementService') as Record<
  'fetchSettlementFigures' | 'settleBalances' | 'fetchSettlementMessage',
  jest.Mock
>;

const FIGURES = (over: Partial<SettlementFigures> = {}): SettlementFigures => ({
  party: {
    id: 'p1',
    name: 'Ramesh Traders',
    isCustomer: true,
    isSupplier: true,
    status: 'active',
  },
  customerBalance: '1000.00',
  supplierBalance: '600.00',
  maxAmount: '600.00',
  documents: {
    invoices: [
      { documentId: 'i1', number: 'INV-1', documentDate: '2026-09-15', amountDue: '700.00' },
      { documentId: 'i2', number: 'INV-2', documentDate: '2026-10-15', amountDue: '300.00' },
    ],
    bills: [{ documentId: 'b1', number: 'PB-1', documentDate: '2026-10-05', amountDue: '600.00' }],
  },
  settlements: [],
  ...over,
});

const SETTLED: ShopSettlement = {
  id: 's1',
  partyId: 'p1',
  amount: '600.00',
  settledOn: '2026-10-25',
  note: '',
  inPayment: { id: 'a', number: 'RCT/26-27/0010', status: 'recorded' },
  outPayment: { id: 'b', number: 'PAYOUT/26-27/0004', status: 'recorded' },
  before: { customerBalance: '1000.00', supplierBalance: '600.00' },
  after: { customerBalance: '400.00', supplierBalance: '0.00' },
  createdAt: '2026-10-25T10:00:00Z',
  createdBy: 'Owner',
  voidedAt: null,
  voidReason: null,
};

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
      permissions: ['payments.payment.write', 'parties.party.read'],
      enabledModules: ['payments', 'sales', 'purchases'],
      version: 1,
    })
  );
  service.fetchSettlementFigures.mockResolvedValue(FIGURES());
  service.fetchSettlementMessage.mockResolvedValue({ text: 'Namaste', mobile: null });
});

const show = (onSettled = jest.fn(), onClose = jest.fn()) => {
  renderWithProviders(
    <SettleBalancesDialog partyId="p1" onSettled={onSettled} onClose={onClose} />
  );
  return { onSettled, onClose };
};

it('shows both balances apart, prefills the smaller and previews both results', async () => {
  show();
  expect(await screen.findByTestId('settle-customer')).toHaveTextContent(
    'As a customer, they owe you₹1,000.00'
  );
  expect(screen.getByTestId('settle-supplier')).toHaveTextContent(
    'As a supplier, you owe them₹600.00'
  );
  expect(screen.getByText('Settle two balances')).toBeInTheDocument();
  expect(screen.getByText('Ramesh Traders · No cash changes hands')).toBeInTheDocument();
  expect(screen.getByTestId('settle-amount')).toHaveValue('600.00');
  expect(screen.getByTestId('settle-after')).toHaveTextContent(
    'After thisThey owe you ₹400.00You owe them ₹0.00'
  );
  expect(screen.getByTestId('settle-confirm')).toHaveTextContent('Settle ₹600.00');
  expect(screen.getByRole('button', { name: 'Keep separate' })).toHaveFocus();
});

it('refuses an amount above the smaller balance before anything is sent', async () => {
  show();
  const field = await screen.findByTestId('settle-amount');
  await userEvent.clear(field);
  await userEvent.type(field, '700');
  expect(screen.getByText('You can settle up to ₹600.00, the smaller of the two.')).toBeVisible();
  expect(screen.getByTestId('settle-confirm')).toBeDisabled();
  expect(screen.getByTestId('settle-after')).toHaveTextContent('They owe you ₹1,000.00');
});

it('one tap settles once, with the figures the merchant saw, then offers the message', async () => {
  let finish: (value: ShopSettlement) => void = () => undefined;
  service.settleBalances.mockReturnValue(
    new Promise<ShopSettlement>((resolve) => {
      finish = resolve;
    })
  );
  const { onSettled } = show();
  const confirm = await screen.findByTestId('settle-confirm');
  await userEvent.click(confirm);
  await userEvent.click(confirm);
  finish(SETTLED);
  await waitFor(() => expect(store.getState().snackbar.id).toBe('shopSettlement.done'));
  expect(service.settleBalances).toHaveBeenCalledTimes(1);
  expect(service.settleBalances.mock.calls[0]?.[0]).toEqual({
    partyId: 'p1',
    amount: '600.00',
    expected: { customerBalance: '1000.00', supplierBalance: '600.00' },
  });
  expect(onSettled).toHaveBeenCalledWith(SETTLED);
  expect(await screen.findByText('Tell Ramesh Traders about the settlement')).toBeInTheDocument();
  await waitFor(() => expect(service.fetchSettlementMessage).toHaveBeenCalledWith('s1', 'en'));
});

it('when the balances moved meanwhile, it shows the new figures instead of settling', async () => {
  service.settleBalances.mockRejectedValue({
    code: 'settlement_balances_changed',
    status: 409,
    message: 'These balances changed.',
    details: { customer_balance: '1050.00', supplier_balance: '200.00', max_amount: '200.00' },
  });
  show();
  await userEvent.click(await screen.findByTestId('settle-confirm'));
  await waitFor(() => expect(screen.getByTestId('settle-supplier')).toHaveTextContent('₹200.00'));
  expect(screen.getByTestId('settle-customer')).toHaveTextContent('₹1,050.00');
  expect(screen.getByTestId('settle-amount')).toHaveValue('200.00');
  expect(store.getState().snackbar.id).toBe('shopSettlement.changed');
});

it('says there is nothing to settle when one side is zero, and offers no Settle', async () => {
  service.fetchSettlementFigures.mockResolvedValue(
    FIGURES({ supplierBalance: '0.00', maxAmount: '0.00' })
  );
  show();
  expect(
    await screen.findByText('Nothing to settle now: one of the two balances is zero.')
  ).toBeInTheDocument();
  expect(screen.queryByTestId('settle-confirm')).toBeNull();
});

it('names the bills the amount settles, oldest first, and follows the amount', async () => {
  service.fetchSettlementFigures.mockResolvedValue(FIGURES());
  renderWithProviders(<SettleBalancesDialog partyId="p1" onClose={jest.fn()} />);
  await screen.findByTestId('settle-body');
  expect(screen.getByTestId('settle-invoices')).toHaveTextContent('INV-1 ₹600.00');
  expect(screen.getByTestId('settle-invoices')).not.toHaveTextContent('INV-2');
  expect(screen.getByTestId('settle-bills')).toHaveTextContent('PB-1 ₹600.00');

  const amount = screen.getByTestId('settle-amount');
  await userEvent.clear(amount);
  await userEvent.type(amount, '50');
  await waitFor(() =>
    expect(screen.getByTestId('settle-invoices')).toHaveTextContent('INV-1 ₹50.00')
  );
  expect(screen.getByTestId('settle-bills')).toHaveTextContent('PB-1 ₹50.00');
});

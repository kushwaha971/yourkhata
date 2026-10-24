import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetAllFeatureState } from 'src/redux/actions';
import { browserWentOffline } from 'src/redux/slice/networkSlice';
import { sessionLoaded } from 'src/redux/slice/sessionSlice';
import { store } from 'src/redux/store';
import { renderWithProviders } from 'src/tests/renderWithProviders';
import type { PermissionCode } from 'src/types/domain.types';

import { PaymentReceiptPageContent } from './PaymentReceiptPageContent';

import type { UsePaymentReceiptResult } from '../hooks/usePaymentReceipt';
import type { Payment } from '../types/payment.types';

/**
 * 08 §10 on screen. The receipt's data hook is stubbed, so what is asserted is
 * what a counter reads and taps: the amount with how it was paid, each settled
 * bill with what is STILL due on it, Share receipt docked as the main act on a
 * phone, and a cancel that is called Cancel (not "Void") and says what it will
 * change. The print sheet is a dynamic() chunk and is not under test here.
 */
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/payments/p1',
}));
jest.mock('./print/PaymentReceiptPrint', () => ({ PaymentReceiptPrint: () => null }));
jest.mock('../hooks/usePaymentReceipt');

const hook = jest.requireMock('../hooks/usePaymentReceipt') as { usePaymentReceipt: jest.Mock };

const RECEIPT: Payment = {
  id: 'p1',
  number: 'RCT/26-27/0233',
  direction: 'in',
  party: { id: 'c1', name: 'Anita Verma', mobile: '9876543210' },
  paymentDate: '2026-10-17',
  amount: '200.00',
  modeBreakup: [
    { mode: 'cash', amount: '150.00', reference: '', upiApp: null },
    { mode: 'upi', amount: '50.00', reference: '4417', upiApp: null },
  ],
  primaryMode: 'cash',
  reference: '',
  note: '',
  status: 'recorded',
  unallocatedAmount: '0.00',
  bucket: 'shop',
  allocations: [
    {
      documentType: 'sales_invoice',
      documentId: 'd1',
      number: 'INV-0412',
      status: 'partially_paid',
      amountDue: '245.00',
      amount: '200.00',
    } as Payment['allocations'][number],
  ],
  partyBalanceAfter: '245.00',
  context: null,
  business: { name: 'Shree Ganesh Kirana', upiVpa: null } as Payment['business'],
  voidReason: null,
  voidedAt: null,
  voidedBy: null,
  createdBy: { id: 'u1', name: 'Owner' } as Payment['createdBy'],
  createdAt: '2026-10-17T10:00:00Z',
};

const receiptState = (payment: Payment, extra: Partial<UsePaymentReceiptResult> = {}) => ({
  payment,
  status: 'succeeded',
  error: null,
  stale: false,
  staticQr: null,
  shareStatus: 'idle',
  voidStatus: 'idle',
  applyStatus: 'idle',
  applyCandidates: [],
  applyCandidatesStatus: 'idle',
  branding: null,
  canVoid: true,
  canShare: true,
  canApply: false,
  shareText: null,
  shareMobile: null,
  voidErrors: [],
  applyErrors: [],
  print: jest.fn(),
  startShare: jest.fn(async () => false),
  submitVoid: jest.fn(async () => true),
  loadApplyCandidates: jest.fn(),
  submitApply: jest.fn(async () => true),
  ...extra,
});

const signIn = (permissions: readonly PermissionCode[]): void => {
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
      activeTenant: { id: 't1', name: 'Shree Ganesh Kirana', timezone: 'Asia/Kolkata' },
      tenants: [{ id: 't1', name: 'Shree Ganesh Kirana', timezone: 'Asia/Kolkata' }],
      permissions: [...permissions],
      enabledModules: ['payments', 'parties'],
      version: 1,
    })
  );
};

const OWNER: readonly PermissionCode[] = [
  'payments.payment.read',
  'payments.payment.write',
  'payments.payment.void',
];

beforeEach(() => {
  jest.clearAllMocks();
  store.dispatch(resetAllFeatureState());
  signIn(OWNER);
  hook.usePaymentReceipt.mockImplementation(() => receiptState(RECEIPT));
});

const dock = (): HTMLElement => screen.getByTestId('payment-dock');

it('says what each settled bill still owes, not only what was paid on it', () => {
  renderWithProviders(<PaymentReceiptPageContent id="p1" />);
  const settled = screen.getByRole('list', { name: 'Settled' });
  expect(within(settled).getByText('INV-0412 · ₹200.00 · ₹245.00 still due')).toBeInTheDocument();
});

it('lists how the money came, one line per mode', () => {
  renderWithProviders(<PaymentReceiptPageContent id="p1" />);
  const modes = screen.getByRole('list', { name: 'How it was paid' });
  expect(within(modes).getAllByRole('listitem')).toHaveLength(2);
  expect(within(modes).getAllByText('₹150.00').length).toBeGreaterThan(0);
  expect(within(modes).getByText(/4417/)).toBeInTheDocument();
});

/** 08 §10: three header buttons ran off a phone; Share is the primary act and is docked. */
it('docks Share receipt first, with Print and More, on a phone', () => {
  renderWithProviders(<PaymentReceiptPageContent id="p1" />);
  const buttons = within(dock()).getAllByRole('button');
  expect(buttons[0]).toHaveAccessibleName(/Share receipt/);
  expect(within(dock()).getByRole('button', { name: /Print/ })).toBeInTheDocument();
  expect(within(dock()).getByRole('button', { name: 'More actions' })).toBeInTheDocument();
});

it('calls the undo Cancel receipt, keeps the receipt by default, and says what changes', async () => {
  renderWithProviders(<PaymentReceiptPageContent id="p1" />);
  await userEvent.click(within(dock()).getByRole('button', { name: 'More actions' }));
  await userEvent.click(await screen.findByRole('button', { name: /Cancel receipt/ }));
  const dialog = await screen.findByRole('dialog', { name: 'Cancel RCT/26-27/0233?' });
  expect(within(dialog).getByRole('button', { name: 'Keep receipt' })).toBeInTheDocument();
  expect(within(dialog).getByText('Anita Verma owes the Shop ₹200.00 more')).toBeInTheDocument();
  expect(within(dialog).getByText('INV-0412 will be due again: ₹445.00')).toBeInTheDocument();
  expect(screen.queryByText(/Void|Khata/)).not.toBeInTheDocument();
});

it('offers staff a message for the owner instead of the cancel', async () => {
  signIn(['payments.payment.read', 'payments.payment.write']);
  hook.usePaymentReceipt.mockImplementation(() => receiptState(RECEIPT, { canVoid: false }));
  renderWithProviders(<PaymentReceiptPageContent id="p1" />);
  await userEvent.click(within(dock()).getByRole('button', { name: 'More actions' }));
  expect(await screen.findByRole('button', { name: /Ask owner to cancel/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Cancel receipt/ })).not.toBeInTheDocument();
});

it('shows a cancelled receipt in grey with its reason and Record again, and no Share', () => {
  hook.usePaymentReceipt.mockImplementation(() =>
    receiptState({
      ...RECEIPT,
      status: 'void',
      voidReason: 'Wrong contact',
      voidedAt: '2026-10-17T12:00:00Z',
      voidedBy: { id: 'u1', name: 'Owner' } as Payment['voidedBy'],
    })
  );
  renderWithProviders(<PaymentReceiptPageContent id="p1" />);
  expect(screen.getByText(/^Cancelled on .* by Owner$/)).toBeInTheDocument();
  expect(screen.getByText('Reason: Wrong contact')).toBeInTheDocument();
  expect(within(dock()).getByRole('button', { name: /Record again/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Share receipt/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument();
});

it('names a receipt with nobody on it a Quick Sale', () => {
  hook.usePaymentReceipt.mockImplementation(() =>
    receiptState({ ...RECEIPT, party: null, allocations: [] })
  );
  renderWithProviders(<PaymentReceiptPageContent id="p1" />);
  expect(screen.getByText('Quick Sale')).toBeInTheDocument();
});

/** §0.2: a cancel is not queued, and the share text comes from the server. */
it('without internet keeps Print and holds back Share and Cancel', () => {
  store.dispatch(browserWentOffline());
  renderWithProviders(<PaymentReceiptPageContent id="p1" />);
  expect(within(dock()).getByRole('button', { name: /Share receipt/ })).toBeDisabled();
  expect(within(dock()).getByRole('button', { name: /Print/ })).toBeEnabled();
  expect(within(dock()).queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument();
});

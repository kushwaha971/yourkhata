import type * as ReactModule from 'react';

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetAllFeatureState } from 'src/redux/actions';
import { sessionLoaded } from 'src/redux/slice/sessionSlice';
import { store } from 'src/redux/store';
import { renderWithProviders } from 'src/tests/renderWithProviders';
import type { PermissionCode } from 'src/types/domain.types';

import { PaymentsPageContent } from './PaymentsPageContent';

import type { PaymentListArg, PaymentPage, PaymentRow } from '../types/payment.types';

/**
 * 08 §9 on screen, with the service stubbed at the module boundary. What is
 * asserted is the question ASKED and what a merchant reads: that the Shop's
 * register asks for the Shop's money only (C-3: Library fees and Lending
 * disbursements were listed as Shop payments), that a phone joins the next
 * page under its cards, and that a cancelled payment says so in words.
 */
jest.mock('../api/paymentService');

let mockSearch = '';
const mockUrlListeners = new Set<() => void>();
jest.mock('next/navigation', () => {
  const { useSyncExternalStore } = jest.requireActual<typeof ReactModule>('react');
  const subscribe = (listener: () => void) => {
    mockUrlListeners.add(listener);
    return () => {
      mockUrlListeners.delete(listener);
    };
  };
  const read = () => mockSearch;
  return {
    useRouter: () => ({
      push: jest.fn(),
      replace: (url: string) => {
        mockSearch = url.replace(/^\?/, '');
        mockUrlListeners.forEach((listener) => listener());
      },
      back: jest.fn(),
      prefetch: jest.fn(),
    }),
    useSearchParams: () => new URLSearchParams(useSyncExternalStore(subscribe, read, read)),
    usePathname: () => '/payments',
  };
});

const service = jest.requireMock('../api/paymentService') as { listPayments: jest.Mock };

const ANITA: PaymentRow = {
  id: 'p1',
  number: 'RCT/26-27/0233',
  direction: 'in',
  party: { id: 'c1', name: 'Anita Verma', mobile: null },
  paymentDate: '2026-10-17',
  amount: '200.00',
  primaryMode: 'cash',
  modesCount: 1,
  reference: '',
  status: 'recorded',
  unallocatedAmount: '0.00',
  allocatedAmount: '200.00',
};

const page = (rows: readonly PaymentRow[], extra: Partial<PaymentPage> = {}): PaymentPage => ({
  rows,
  page: 1,
  pageSize: 25,
  total: rows.length,
  hasAny: true,
  totals: {
    count: rows.length,
    countIn: rows.length,
    countOut: 0,
    amountIn: '200.00',
    amountOut: '0.00',
  },
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

const lastAsked = (): PaymentListArg => {
  const calls = service.listPayments.mock.calls as [PaymentListArg][];
  const last = calls[calls.length - 1];
  if (!last) throw new Error('no list request was made');
  return last[0];
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSearch = '';
  store.dispatch(resetAllFeatureState());
  service.listPayments.mockImplementation(async () => page([ANITA]));
  signIn(['payments.payment.read', 'payments.payment.write']);
});

it("asks for the Shop's own payments, never another app's", async () => {
  renderWithProviders(<PaymentsPageContent />);
  await screen.findByText('Anita Verma');
  expect(lastAsked().bucket).toBe('shop');
});

it('says a cancelled payment is Cancelled, in words, on its card', async () => {
  service.listPayments.mockImplementation(async () =>
    page([{ ...ANITA, status: 'void' }])
  );
  renderWithProviders(<PaymentsPageContent />);
  const card = (await screen.findAllByTestId('ub-grid-card'))[0];
  expect(within(card as HTMLElement).getByText('Cancelled')).toBeInTheDocument();
  expect(within(card as HTMLElement).getByText(/RCT\/26-27\/0233 · Cash ·/)).toBeInTheDocument();
});

/** R-DEC-33: a phone scrolls one joined card list; there are no page arrows to aim at. */
it('joins the next page of payments under the phone cards instead of paging', async () => {
  const rows = Array.from({ length: 30 }, (_, i) => ({
    ...ANITA,
    id: `p-${i + 1}`,
    number: `RCT/26-27/${String(i + 1).padStart(4, '0')}`,
  }));
  service.listPayments.mockImplementation(async (query: PaymentListArg) =>
    page(query.page === 2 ? rows.slice(25) : rows.slice(0, 25), { page: query.page, total: 30 })
  );
  renderWithProviders(<PaymentsPageContent />);
  expect(await screen.findAllByTestId('ub-grid-card')).toHaveLength(25);
  expect(screen.queryByText(/Page 1 of/)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Show more' }));
  await waitFor(() => expect(screen.getAllByTestId('ub-grid-card')).toHaveLength(30));
  expect(lastAsked().page).toBe(2);
});

it('shows a business with no payment at all one sentence and one button', async () => {
  service.listPayments.mockImplementation(async () => page([], { hasAny: false }));
  renderWithProviders(<PaymentsPageContent />);
  expect(await screen.findByText('No payments yet')).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: /Receive payment/ }).length).toBeGreaterThan(0);
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
});

/** Money in was painted in the "give" red and supplier payments in the "got" green. */
it('paints money in as money got, and money out in plain ink', async () => {
  service.listPayments.mockImplementation(async () =>
    page([ANITA, { ...ANITA, id: 'p2', number: 'PAYOUT/26-27/0009', direction: 'out' }])
  );
  renderWithProviders(<PaymentsPageContent />);
  const [received, paid] = await screen.findAllByTestId('ub-grid-card');
  expect(within(received as HTMLElement).getByText('₹200.00').className).toContain('text-get');
  const out = within(paid as HTMLElement).getByText('₹200.00').className;
  expect(out).not.toContain('text-get');
  expect(out).not.toContain('text-give');
});

it('names a receipt with nobody on it as a Quick Sale', async () => {
  service.listPayments.mockImplementation(async () => page([{ ...ANITA, party: null }]));
  renderWithProviders(<PaymentsPageContent />);
  expect(await screen.findByText('Quick Sale')).toBeInTheDocument();
});

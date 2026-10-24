import type * as ReactModule from 'react';


import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type * as DesignSystem from 'src/design-system';
import { resetAllFeatureState } from 'src/redux/actions';
import { sessionLoaded } from 'src/redux/slice/sessionSlice';
import { store } from 'src/redux/store';
import { renderWithProviders } from 'src/tests/renderWithProviders';
import type { ModuleCode, PermissionCode } from 'src/types/domain.types';

import { CashbookPageContent } from './CashbookPageContent';

import type { CashbookData, CashbookFilters } from '../types/cashbook.types';

/**
 * EXP-03 on screen, service stubbed at the module boundary.
 *
 * The scope test is the one that matters most: FR-13 makes the cashbook the
 * business's whole cash position, so a member without `reports.financial.read`
 * must send the till-only request (no parameters — the server's default for
 * them) and be shown no range or bank controls. The server refuses anything
 * wider anyway; the client must not invite the refusal.
 */
jest.mock('../api/cashbookService');
jest.mock('modules/DigiKhaato/features/payments/components/PaymentFormDrawer', () => {
  const { UbButton } = jest.requireActual<typeof DesignSystem>('src/design-system');
  return {
    PaymentFormDrawer: ({ onSaved }: { onSaved?: (result: unknown) => void }) => (
      <UbButton onClick={() => onSaved?.({})}>stub: saved</UbButton>
    ),
  };
});
jest.mock('../api/expenseService');

let mockSearch = '';
const mockPush = jest.fn();
jest.mock('next/navigation', () => {
  const { useSyncExternalStore } = jest.requireActual<typeof ReactModule>('react');
  const read = () => mockSearch;
  return {
    useRouter: () => ({
      push: mockPush,
      replace: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn(),
    }),
    useSearchParams: () => new URLSearchParams(useSyncExternalStore(() => () => {}, read, read)),
    usePathname: () => '/cashbook',
  };
});

const cashbookService = jest.requireMock('../api/cashbookService') as { getCashbook: jest.Mock };
const expenseService = jest.requireMock('../api/expenseService') as {
  listExpenseCategories: jest.Mock;
  getExpense: jest.Mock;
};

const NOW = new Date('2026-09-24T06:00:00Z');
const TODAY = '2026-09-24';

const figures = (cash: string, bank?: string) =>
  bank === undefined
    ? { cash, total: cash }
    : { cash, bank, total: String(Number(cash) + Number(bank)) };

const DATA = (scope: CashbookData['scope']): CashbookData => ({
  range: {
    dateFrom: TODAY,
    dateTo: TODAY,
    opening: scope === 'full' ? figures('0.00', '0.00') : figures('0.00'),
    in: scope === 'full' ? figures('2000.00', '0.00') : figures('2000.00'),
    out: scope === 'full' ? figures('440.00', '450.00') : figures('440.00'),
    closing: scope === 'full' ? figures('1560.00', '-450.00') : figures('1560.00'),
  },
  days: [],
  byCategory: [],
  buckets: scope === 'full' ? ['cash', 'bank'] : ['cash'],
  scope,
});

let modules: readonly ModuleCode[] = ['expenses'];
const enableModules = (next: readonly ModuleCode[]): void => {
  modules = next;
};

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
      activeTenant: { id: 't1', name: 'Kumar Stores', timezone: 'Asia/Kolkata' },
      tenants: [{ id: 't1', name: 'Kumar Stores', timezone: 'Asia/Kolkata' }],
      permissions: [...permissions],
      enabledModules: [...modules],
      version: 1,
    })
  );
};

beforeEach(() => {
  jest.useFakeTimers({
    now: NOW,
    doNotFake: [
      'nextTick',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'setImmediate',
      'clearImmediate',
      'setInterval',
      'clearInterval',
      'setTimeout',
      'clearTimeout',
    ],
  });
  jest.clearAllMocks();
  mockSearch = '';
  modules = ['expenses'];
  store.dispatch(resetAllFeatureState());
  expenseService.listExpenseCategories.mockResolvedValue([]);
});

afterEach(() => {
  jest.useRealTimers();
});

it("scopes a member without financial read to today's till", async () => {
  cashbookService.getCashbook.mockResolvedValue(DATA('today_cash'));
  signIn(['expenses.expense.read']);
  renderWithProviders(<CashbookPageContent />);
  expect(await screen.findByText("You can see today's cash only")).toBeInTheDocument();
  expect(cashbookService.getCashbook).toHaveBeenCalledWith(null, expect.anything());
  expect(screen.queryByRole('button', { name: 'This month' })).not.toBeInTheDocument();
  expect(screen.queryByRole('radio', { name: 'Bank' })).not.toBeInTheDocument();
});

it('asks for the range in the URL when the member may read the books', async () => {
  cashbookService.getCashbook.mockResolvedValue(DATA('full'));
  mockSearch = 'period=today';
  signIn(['expenses.expense.read', 'reports.financial.read']);
  renderWithProviders(<CashbookPageContent />);
  await screen.findByText('Close the day');
  const asked = cashbookService.getCashbook.mock.calls[0]?.[0] as CashbookFilters;
  expect(asked).toEqual({ preset: 'today', dateFrom: TODAY, dateTo: TODAY, bucket: 'all' });
});

it('tells the merchant how far the drawer is off, and opens the fix filled in', async () => {
  /* FR-8, 08 §11 — computed on the client, stored nowhere, and the screen says
     so. Short means an expense was missed: "Add the missing expense" opens the
     drawer with the shortfall in cash, not an empty form the merchant has to
     fill with a number they just read off the screen. */
  cashbookService.getCashbook.mockResolvedValue(DATA('full'));
  mockSearch = 'period=today';
  signIn([
    'expenses.expense.read',
    'expenses.expense.write',
    'reports.financial.read',
    'payments.payment.write',
  ]);
  renderWithProviders(<CashbookPageContent />);
  expect(await screen.findByText('Expected cash in drawer: ₹1,560.00')).toBeInTheDocument();
  expect(screen.getByText('This count is not saved anywhere.')).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('Count the cash in your drawer'), '1440');
  expect(await screen.findByText('Short by ₹120.00')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Receive a payment you forgot' })).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Add the missing expense' }));
  const state = store.getState().expenseForm;
  expect(state?.open).toBe(true);
  expect(state?.draft).toMatchObject({ amount: '120.00', mode: 'cash', paid: true });
});

it('offers the forgotten payment when the drawer holds MORE, never when it is short', async () => {
  /* 08 §11 listed both fixes under "Short by". Receiving a payment raises the
     expected cash, so offered for a shortfall it would widen the gap: each fix
     goes with the difference it can close. */
  cashbookService.getCashbook.mockResolvedValue(DATA('full'));
  mockSearch = 'period=today';
  enableModules(['expenses', 'payments']);
  signIn([
    'expenses.expense.read',
    'expenses.expense.write',
    'reports.financial.read',
    'payments.payment.write',
  ]);
  renderWithProviders(<CashbookPageContent />);
  await screen.findByText('Expected cash in drawer: ₹1,560.00');
  await userEvent.type(screen.getByLabelText('Count the cash in your drawer'), '1640');
  expect(await screen.findByText('Extra ₹80.00')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Receive a payment you forgot' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add the missing expense' })).toBeNull();
});

it('shows the four figures with their meaning, and a closing below zero in words', async () => {
  /* BR-9 — a negative closing is shown, never hidden, and says what it means. */
  cashbookService.getCashbook.mockResolvedValue({
    ...DATA('full'),
    range: { ...DATA('full').range, closing: figures('-150.00', '0.00') },
  });
  mockSearch = 'period=today&bucket=cash';
  signIn(['expenses.expense.read', 'reports.financial.read']);
  renderWithProviders(<CashbookPageContent />);
  const group = await screen.findByRole('group', { name: 'Cash book figures' });
  expect(group).toHaveTextContent('Opening₹0.00');
  expect(group).toHaveTextContent('Money in₹2,000.00');
  expect(group).toHaveTextContent('Money out₹440.00');
  expect(group).toHaveTextContent('Closing-₹150.00');
  expect(group).toHaveTextContent('Cash below zero — an entry is probably missing');
  expect(screen.getByRole('radio', { name: 'Cash' })).toBeChecked();
});

const ROW = {
  date: TODAY,
  at: `${TODAY}T05:00:00Z`,
  upiApp: null,
  reference: '',
  note: '',
  category: null,
  number: null,
  runningAfter: { cash: '200.00', total: '200.00' },
} as const;

it('opens a payment row on its receipt and an expense row in its sheet', async () => {
  /* 08 §11 Navigation — "a row opens its receipt or expense". A khata line
     with a mode has nothing to open here, so it is not a button at all. */
  cashbookService.getCashbook.mockResolvedValue({
    ...DATA('full'),
    hasAny: true,
    days: [
      {
        date: TODAY,
        opening: figures('0.00', '0.00'),
        in: figures('2000.00', '0.00'),
        out: figures('440.00', '450.00'),
        closing: figures('1560.00', '-450.00'),
        voidedCount: 1,
        rows: [
          {
            ...ROW,
            id: 'p1',
            sourceType: 'payment',
            sourceId: 'pay-9:0',
            direction: 'in',
            mode: 'cash',
            bucket: 'cash',
            amount: '200.00',
            party: { id: 'c1', name: 'Anita Verma' },
            number: 'RCP/26-27/0001',
          },
          {
            ...ROW,
            id: 'e1',
            sourceType: 'expense',
            sourceId: 'exp-3',
            direction: 'out',
            mode: 'cash',
            bucket: 'cash',
            amount: '40.00',
            party: null,
            category: { id: 'k1', name: 'Tea', color: 'viz-1' },
            number: 'EXP/26-27/0003',
          },
          {
            ...ROW,
            id: 'l1',
            sourceType: 'ledger_entry',
            sourceId: 'le-1',
            direction: 'in',
            mode: 'cash',
            bucket: 'cash',
            amount: '10.00',
            party: { id: 'c2', name: 'Ravi' },
          },
        ],
      },
    ],
  });
  expenseService.getExpense.mockReturnValue(new Promise(() => {}));
  mockSearch = 'period=today';
  signIn(['expenses.expense.read', 'reports.financial.read']);
  renderWithProviders(<CashbookPageContent />);
  await userEvent.click(
    await screen.findByRole('button', { name: 'Open Received from Anita Verma' })
  );
  expect(mockPush).toHaveBeenCalledWith('/payments/pay-9');
  const tea = screen.getByRole('button', { name: 'Open Tea' });
  await userEvent.click(tea);
  await userEvent.click(tea);
  expect(expenseService.getExpense).toHaveBeenCalledTimes(1);
  expect(expenseService.getExpense).toHaveBeenCalledWith('exp-3', expect.anything());
  expect(screen.queryByRole('button', { name: 'Open Received from Ravi' })).toBeNull();
  expect(screen.getByText('Received from Ravi')).toBeInTheDocument();
  expect(screen.getByText('1 cancelled entry on this day')).toBeInTheDocument();
});

it('reads the cash book again after the forgotten payment is saved', async () => {
  /* "Receive a payment you forgot" is recorded FROM this screen, and nothing
     else tells the cash book: without the re-read, the expected cash the
     merchant is reconciling stayed where it was after the payment that fixed
     it. */
  cashbookService.getCashbook.mockResolvedValue(DATA('full'));
  mockSearch = 'period=today';
  enableModules(['expenses', 'payments']);
  signIn(['expenses.expense.read', 'reports.financial.read', 'payments.payment.write']);
  renderWithProviders(<CashbookPageContent />);
  await screen.findByText('Expected cash in drawer: ₹1,560.00');
  await userEvent.type(screen.getByLabelText('Count the cash in your drawer'), '1561');
  await userEvent.click(screen.getByRole('button', { name: 'Receive a payment you forgot' }));
  const before = cashbookService.getCashbook.mock.calls.length;
  await userEvent.click(await screen.findByRole('button', { name: 'stub: saved' }));
  await waitFor(() => expect(cashbookService.getCashbook.mock.calls.length).toBe(before + 1));
});

const EMPTY_BOOK_TITLE = /No money in or out yet|cashbook\.empty\.firstUse\.title/;

it('shows a business that never moved money one empty state and no ₹0.00', async () => {
  /* Owner, 12 Oct 2026: an empty book is one sentence and one button. The
     defect this prevents is the old screen — a period picker, a bucket switch,
     four ₹0.00 tiles and "Days 0" over a business with nothing in it — and a
     header "Add" duplicating the empty state's own action. */
  cashbookService.getCashbook.mockResolvedValue({
    ...DATA('full'),
    range: {
      ...DATA('full').range,
      in: figures('0.00', '0.00'),
      out: figures('0.00', '0.00'),
      closing: figures('0.00', '0.00'),
    },
    hasAny: false,
  });
  signIn(['expenses.expense.read', 'expenses.expense.write', 'reports.financial.read']);
  renderWithProviders(<CashbookPageContent />);
  expect(await screen.findByText(EMPTY_BOOK_TITLE)).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Add expense' })).toHaveLength(1);
  expect(screen.queryByText(/This month|Today/)).not.toBeInTheDocument();
  expect(screen.queryByText('Cash or bank')).not.toBeInTheDocument();
  expect(screen.queryByText('Opening')).not.toBeInTheDocument();
  expect(screen.queryByText('Money in')).not.toBeInTheDocument();
  expect(screen.queryByText('Days')).not.toBeInTheDocument();
  expect(screen.queryByText(/₹0\.00/)).not.toBeInTheDocument();
  expect(screen.queryByText('Close the day')).not.toBeInTheDocument();
});

it('keeps every control when the range is quiet but the book is not', async () => {
  /* A quiet range is not an empty book: the merchant must still be able to
     move the range to reach the money they did record. */
  cashbookService.getCashbook.mockResolvedValue({ ...DATA('full'), hasAny: true });
  signIn(['expenses.expense.read', 'reports.financial.read']);
  renderWithProviders(<CashbookPageContent />);
  expect(
    await screen.findByText('No money came in or went out in this period')
  ).toBeInTheDocument();
  expect(screen.queryByText(EMPTY_BOOK_TITLE)).not.toBeInTheDocument();
  expect(screen.getByText('Opening')).toBeInTheDocument();
  expect(screen.getByText('Days')).toBeInTheDocument();
});

it('never hides the controls for a server that does not say', async () => {
  /* `hasAny` absent (an older server) must read as "unknown", not "empty". */
  cashbookService.getCashbook.mockResolvedValue(DATA('full'));
  signIn(['expenses.expense.read', 'reports.financial.read']);
  renderWithProviders(<CashbookPageContent />);
  expect(await screen.findByText('Opening')).toBeInTheDocument();
  expect(screen.queryByText(EMPTY_BOOK_TITLE)).not.toBeInTheDocument();
});

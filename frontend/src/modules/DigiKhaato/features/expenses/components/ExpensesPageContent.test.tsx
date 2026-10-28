import type * as ReactModule from 'react';

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { resetAllFeatureState } from 'src/redux/actions';
import { sessionLoaded } from 'src/redux/slice/sessionSlice';
import { store } from 'src/redux/store';
import { renderWithProviders } from 'src/tests/renderWithProviders';
import type { PermissionCode } from 'src/types/domain.types';

import { ExpensesPageContent } from './ExpensesPageContent';

import type { Expense, ExpenseFilters } from '../types/expense.types';

/**
 * EXP-01 FR-9 on screen: content → hook → thunk → service, with the service
 * stubbed at the module boundary. What is asserted is that the question on
 * screen is the question ASKED — PTY-02's chips lit up while sending nothing.
 */
jest.mock('../api/expenseService');

const mockReplace = jest.fn();
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
      replace: mockReplace,
      back: jest.fn(),
      prefetch: jest.fn(),
    }),
    useSearchParams: () => new URLSearchParams(useSyncExternalStore(subscribe, read, read)),
    usePathname: () => '/expenses',
  };
});

const service = jest.requireMock('../api/expenseService') as {
  listExpenses: jest.Mock;
  listExpenseCategories: jest.Mock;
};

const TEA: Expense = {
  id: 'e1',
  number: 'EXP/26-27/0001',
  expenseDate: '2026-09-24',
  amount: '120.00',
  category: { id: 'c-food', name: 'Food', color: 'viz-6', status: 'active' },
  party: null,
  mode: 'cash',
  upiApp: null,
  reference: '',
  note: 'Tea for staff',
  paid: true,
  dueOn: null,
  status: 'recorded',
  voidReason: null,
  voidedAt: null,
  voidedBy: null,
  createdBy: { id: 'u1', name: 'Owner' },
  createdAt: '2026-09-24T05:00:00Z',
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
      enabledModules: ['expenses', 'parties'],
      version: 1,
    })
  );
};

const lastAsked = (): ExpenseFilters => {
  const calls = service.listExpenses.mock.calls as [ExpenseFilters][];
  const last = calls[calls.length - 1];
  if (!last) throw new Error('no list request was made');
  return last[0];
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSearch = '';
  mockReplace.mockReset();
  mockReplace.mockImplementation((url: string) => {
    mockSearch = url.replace(/^\?/, '');
    mockUrlListeners.forEach((listener) => listener());
  });
  store.dispatch(resetAllFeatureState());
  service.listExpenseCategories.mockResolvedValue([
    {
      id: 'c-food',
      name: 'Food',
      systemCode: 'food',
      color: 'viz-6',
      isSystem: true,
      status: 'active',
    },
  ]);
  service.listExpenses.mockImplementation(async (filters: ExpenseFilters) => ({
    rows: filters.tab === 'void' ? [] : [TEA],
    totals: {
      amount: filters.tab === 'void' ? '0.00' : '120.00',
      count: filters.tab === 'void' ? 0 : 1,
      byCategory: [],
    },
    page: 1,
    pageSize: 25,
    total: filters.tab === 'void' ? 0 : 1,
  }));
});

it('lists this month and shows the filtered total', async () => {
  /* The total is the server's figure over the filtered set, and the default
     request is "this month, recorded" — never a void. */
  signIn(['expenses.expense.read', 'expenses.expense.write']);
  renderWithProviders(<ExpensesPageContent />);
  expect(await screen.findByText('Tea for staff')).toBeInTheDocument();
  // Once on the total and once on the row.
  expect(screen.getAllByText('₹120.00').length).toBeGreaterThanOrEqual(2);
  expect(lastAsked()).toMatchObject({ preset: 'thisMonth', tab: 'all' });
});

it('asks the server for cancelled expenses when the Cancelled chip is chosen', async () => {
  // The chip must change the REQUEST, not just light up. 08 §12 / R-DEC-33:
  // the chips are on the screen, not inside the Filters sheet.
  signIn(['expenses.expense.read']);
  renderWithProviders(<ExpensesPageContent />);
  await screen.findByText('Tea for staff');
  const group = screen.getByRole('radiogroup', { name: 'Which expenses' });
  await userEvent.click(within(group).getByRole('radio', { name: 'Cancelled' }));
  await waitFor(() => expect(lastAsked().tab).toBe('void'));
  expect(mockSearch).toContain('tab=void');
});

it('reads a card as the category, then number · mode · date, then the note', async () => {
  /* 08 §12 Phone — "Rent" is what the money went on; before the revamp the
     note took the title and the category was nowhere on a phone card. */
  signIn(['expenses.expense.read']);
  renderWithProviders(<ExpensesPageContent />);
  const card = (await screen.findAllByTestId('ub-grid-card'))[0] as HTMLElement;
  expect(within(card).getByText('Food')).toBeInTheDocument();
  expect(within(card).getByText('EXP/26-27/0001 · Cash · 24/09/2026')).toBeInTheDocument();
  expect(within(card).getByText('Tea for staff')).toBeInTheDocument();
});

it('says who an unpaid expense is owed to, and a cancelled one in words', async () => {
  service.listExpenses.mockImplementation(async () => ({
    rows: [
      {
        ...TEA,
        id: 'e2',
        number: 'EXP/26-27/0002',
        paid: false,
        mode: null,
        party: { id: 'p1', name: 'Gupta Oil Mills' },
        dueOn: '2026-10-30',
      },
      { ...TEA, id: 'e3', number: 'EXP/26-27/0003', status: 'void', voidReason: 'Entered twice' },
    ],
    totals: { amount: '120.00', count: 1, byCategory: [] },
    page: 1,
    pageSize: 25,
    total: 2,
  }));
  signIn(['expenses.expense.read']);
  renderWithProviders(<ExpensesPageContent />);
  const [unpaid, cancelled] = (await screen.findAllByTestId('ub-grid-card')) as HTMLElement[];
  expect(within(unpaid as HTMLElement).getByText('Unpaid')).toBeInTheDocument();
  expect(within(unpaid as HTMLElement).getByText(/to pay Gupta Oil Mills/)).toBeInTheDocument();
  expect(within(cancelled as HTMLElement).getByText('Cancelled')).toBeInTheDocument();
});

it('shows the total with its count and the top three categories only', async () => {
  service.listExpenses.mockImplementation(async () => ({
    rows: [TEA],
    totals: {
      amount: '41230.00',
      count: 62,
      byCategory: ['Rent', 'Salaries', 'Food', 'Transport', 'Repairs'].map((name, i) => ({
        categoryId: `c-${i}`,
        name,
        color: 'viz-1',
        amount: '100.00',
      })),
    },
    page: 1,
    pageSize: 25,
    total: 62,
  }));
  signIn(['expenses.expense.read']);
  renderWithProviders(<ExpensesPageContent />);
  const strip = await screen.findByTestId('expense-register-summary');
  expect(within(strip).getByText('₹41,230.00')).toBeInTheDocument();
  expect(within(strip).getByText(/62 expenses/)).toBeInTheDocument();
  expect(within(strip).getByText('Salaries')).toBeInTheDocument();
  expect(within(strip).queryByText('Transport')).not.toBeInTheDocument();
});

/** R-DEC-33: a phone scrolls one joined card list; there are no page arrows to aim at. */
it('joins the next page of expenses under the phone cards instead of paging', async () => {
  const rows = Array.from({ length: 30 }, (_, i) => ({
    ...TEA,
    id: `e-${i + 1}`,
    number: `EXP/26-27/${String(i + 1).padStart(4, '0')}`,
  }));
  service.listExpenses.mockImplementation(async (query: ExpenseFilters) => ({
    rows: query.page === 2 ? rows.slice(25) : rows.slice(0, 25),
    totals: { amount: '3600.00', count: 30, byCategory: [] },
    page: query.page,
    pageSize: 25,
    total: 30,
  }));
  signIn(['expenses.expense.read']);
  renderWithProviders(<ExpensesPageContent />);
  expect(await screen.findAllByTestId('ub-grid-card')).toHaveLength(25);
  expect(screen.queryByText(/Page 1 of/)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Show more' }));
  await waitFor(() => expect(screen.getAllByTestId('ub-grid-card')).toHaveLength(30));
  expect(lastAsked().page).toBe(2);
});

it('shows a business with no expense one sentence, not a period, tabs and ₹0', async () => {
  /* Owner, 12 Oct 2026: "I don't want that type of screen in case of empty". */
  service.listExpenses.mockImplementation(async () => ({
    rows: [],
    totals: { amount: '0.00', count: 0, byCategory: [] },
    page: 1,
    pageSize: 25,
    total: 0,
    hasAny: false,
  }));
  signIn(['expenses.expense.read', 'expenses.expense.write']);
  renderWithProviders(<ExpensesPageContent />);
  expect(await screen.findByText('No expenses yet')).toBeInTheDocument();
  expect(screen.queryByRole('radiogroup', { name: 'Which expenses' })).not.toBeInTheDocument();
  expect(screen.queryByTestId('filters-button')).not.toBeInTheDocument();
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Add expense' })).toHaveLength(1);
});

it('offers Add expense only to a role that can record', async () => {
  // §19.7.5 — hidden, not disabled: a disabled button invites a support call.
  signIn(['expenses.expense.read']);
  const { unmount } = renderWithProviders(<ExpensesPageContent />);
  await screen.findByText('Tea for staff');
  expect(screen.queryByRole('button', { name: 'Add expense' })).not.toBeInTheDocument();
  unmount();

  signIn(['expenses.expense.read', 'expenses.expense.write']);
  renderWithProviders(<ExpensesPageContent />);
  expect(await screen.findByRole('button', { name: 'Add expense' })).toBeInTheDocument();
});

it("opens the form when the dashboard's Add expense sends ?add=1 (WP-06)", async () => {
  // The Shop home's More menu offers Add expense. A link that only lands on
  // this list would be a link pretending to be an action.
  mockSearch = 'add=1';
  signIn(['expenses.expense.read', 'expenses.expense.write']);
  renderWithProviders(<ExpensesPageContent />);
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
});

it('ignores ?add=1 for a role that cannot record', async () => {
  mockSearch = 'add=1';
  signIn(['expenses.expense.read']);
  renderWithProviders(<ExpensesPageContent />);
  await screen.findByText('Tea for staff');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('tells a member without access so, and asks nothing', () => {
  signIn([]);
  renderWithProviders(<ExpensesPageContent />);
  expect(screen.getByText('You cannot view expenses')).toBeInTheDocument();
  expect(service.listExpenses).not.toHaveBeenCalled();
});

import type * as ReactModule from 'react';

import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { UbButton } from 'src/design-system';
import { resetAllFeatureState } from 'src/redux/actions';
import { sessionLoaded } from 'src/redux/slice/sessionSlice';
import { store } from 'src/redux/store';
import { renderWithProviders } from 'src/tests/renderWithProviders';
import type { PermissionCode } from 'src/types/domain.types';

import { InvoicesListPageContent } from './InvoicesListPageContent';

import type { InvoiceListQuery } from '../api/salesService';
import type { InvoiceListPage, InvoiceListRow } from '../types/sales.types';

/**
 * SAL-08 on screen: content → hook → thunk → service, with the service stubbed
 * at the module boundary. As on the expenses list, what is asserted is that the
 * tab on screen is the question ASKED (PTY-02's chips lit up and sent nothing),
 * and that the tiles are the server's totals over the filtered set.
 */
jest.mock('../api/salesService');

const mockReplace = jest.fn();
const mockPush = jest.fn();
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
      push: mockPush,
      replace: mockReplace,
      back: jest.fn(),
      prefetch: jest.fn(),
    }),
    useSearchParams: () => new URLSearchParams(useSyncExternalStore(subscribe, read, read)),
    usePathname: () => '/sales/invoices',
  };
});

const service = jest.requireMock('../api/salesService') as { listInvoices: jest.Mock };

const RAMESH: InvoiceListRow = {
  id: 'd2',
  kind: 'invoice',
  number: 'INV/26-27/0002',
  status: 'issued',
  party: { id: 'p1', name: 'Ramesh Traders' },
  walkInName: null,
  walkInMobileMasked: null,
  documentDate: '2026-09-24',
  dueOn: '2026-10-09',
  grandTotal: '112.00',
  amountPaid: '0.00',
  amountDue: '112.00',
  isOverdue: false,
  createdBy: { id: 'u1', name: 'Owner' },
} as InvoiceListRow;

const page = (rows: readonly InvoiceListRow[]): InvoiceListPage => ({
  rows,
  page: 1,
  pageSize: 25,
  total: rows.length,
  totals: {
    count: rows.length,
    grandTotal: rows.length ? '112.00' : '0.00',
    amountDue: rows.length ? '112.00' : '0.00',
  },
  tabs: { all: 1, unpaid: 1, overdue: 0, paid: 0, draft: 0, void: 0 },
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
      activeTenant: { id: 't1', name: 'Sharma General Store', timezone: 'Asia/Kolkata' },
      tenants: [{ id: 't1', name: 'Sharma General Store', timezone: 'Asia/Kolkata' }],
      permissions: [...permissions],
      enabledModules: ['sales', 'parties'],
      version: 1,
    })
  );
};

const lastAsked = (): InvoiceListQuery => {
  const calls = service.listInvoices.mock.calls as [InvoiceListQuery][];
  const last = calls[calls.length - 1];
  if (!last) throw new Error('no list request was made');
  return last[0];
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSearch = '';
  mockReplace.mockImplementation((url: string) => {
    mockSearch = url.replace(/^\?/, '');
    mockUrlListeners.forEach((listener) => listener());
  });
  store.dispatch(resetAllFeatureState());
  service.listInvoices.mockImplementation(async (query: InvoiceListQuery) =>
    page(query.tab === 'paid' ? [] : [RAMESH])
  );
});

it('lists this financial year and shows the server totals', async () => {
  // The tiles are meta.totals over the filtered set, not a sum of the page.
  signIn(['sales.invoice.read', 'sales.invoice.write']);
  renderWithProviders(<InvoicesListPageContent />);
  expect((await screen.findAllByText(/Ramesh Traders/)).length).toBeGreaterThan(0);
  expect(screen.getByText('Billed')).toBeInTheDocument();
  expect(screen.getAllByText('₹112.00').length).toBeGreaterThanOrEqual(2);
  expect(screen.getByRole('link', { name: /New bill/ })).toBeInTheDocument();
  expect(lastAsked()).toMatchObject({ tab: 'all', dateFrom: expect.stringMatching(/-04-01$/) });
});

/** Counter register: the common status question must not require opening Filters. */
it('asks the server for paid bills directly from the visible status choices', async () => {
  signIn(['sales.invoice.read']);
  const user = userEvent.setup();
  renderWithProviders(<InvoicesListPageContent />);
  await screen.findAllByText(/Ramesh Traders/);
  const group = screen.getByRole('radiogroup', { name: 'Bill status' });
  await user.click(within(group).getByRole('radio', { name: /^Paid/ }));
  await waitFor(() => expect(lastAsked().tab).toBe('paid'));
  expect(mockSearch).toBe('tab=paid');
});

it('a shop with no bill at all sees one sentence and one button (owner, 12 Oct 2026)', async () => {
  service.listInvoices.mockImplementation(async () => ({ ...page([]), hasAny: false }));
  signIn(['sales.invoice.read', 'sales.invoice.write']);
  renderWithProviders(<InvoicesListPageContent />);
  expect(await screen.findByText('No bills yet')).toBeInTheDocument();
  expect(screen.queryByText('Billed')).not.toBeInTheDocument();
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  expect(screen.queryByTestId('filters-button')).not.toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: /New bill/ })).toHaveLength(1);
  expect(screen.queryByRole('link', { name: /New bill/ })).not.toBeInTheDocument();
});

it('keeps the filters when This FY is empty but older bills exist', async () => {
  service.listInvoices.mockImplementation(async () => ({ ...page([]), hasAny: true }));
  signIn(['sales.invoice.read']);
  renderWithProviders(<InvoicesListPageContent />);
  expect(await screen.findByTestId('filters-button')).toBeInTheDocument();
});

it('offers New bill only to a role that can write', async () => {
  // Hidden, not disabled (§19.7.5): a disabled button invites a support call.
  signIn(['sales.invoice.read']);
  renderWithProviders(<InvoicesListPageContent />);
  await screen.findAllByText(/Ramesh Traders/);
  expect(screen.queryByRole('link', { name: /New bill/ })).not.toBeInTheDocument();
});

it('tells a member without access so, and asks nothing', () => {
  signIn([]);
  renderWithProviders(<InvoicesListPageContent />);
  expect(screen.getByText('Bills are not available')).toBeInTheDocument();
  expect(service.listInvoices).not.toHaveBeenCalled();
});

/** The N shortcut must not steal typing from the global command trigger. */
it('does not navigate to a new bill when typing n into the global combobox', async () => {
  signIn(['sales.invoice.read', 'sales.invoice.write']);
  renderWithProviders(
    <>
      <UbButton role="combobox" aria-label="Shop command">
        Find or start
      </UbButton>
      <InvoicesListPageContent />
    </>
  );
  await screen.findAllByText(/Ramesh Traders/);
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Shop command' }), { key: 'n' });
  expect(mockPush).not.toHaveBeenCalled();
});

/** A header-placed primary action must navigate, not become an inert plus icon. */
it('opens the new bill editor from the phone header action', async () => {
  const media = jest.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    matches: query.includes('max-width'),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }));
  signIn(['sales.invoice.read', 'sales.invoice.write']);
  const view = renderWithProviders(<InvoicesListPageContent />);
  await screen.findAllByText(/Ramesh Traders/);
  await userEvent.click(screen.getByRole('button', { name: 'New bill' }));
  expect(mockPush).toHaveBeenCalledWith('/sales/invoices/new');
  view.unmount();
  media.mockRestore();
});

/** Advanced filters must retain the status selected in the visible row. */
it('preserves the chosen status when applying the advanced filter drawer', async () => {
  signIn(['sales.invoice.read']);
  const user = userEvent.setup();
  renderWithProviders(<InvoicesListPageContent />);
  await screen.findAllByText(/Ramesh Traders/);
  await user.click(screen.getByRole('radio', { name: /^Paid/ }));
  await waitFor(() => expect(lastAsked().tab).toBe('paid'));
  await user.click(screen.getByTestId('filters-button'));
  await user.click(await screen.findByTestId('filters-apply'));
  expect(lastAsked().tab).toBe('paid');
});

/** Back/deep-link search must not be overwritten by the previous input debounce. */
it('follows an external search URL while the register stays mounted', async () => {
  signIn(['sales.invoice.read']);
  renderWithProviders(<InvoicesListPageContent />);
  await screen.findAllByText(/Ramesh Traders/);
  act(() => {
    mockSearch = 'q=Radhe';
    mockUrlListeners.forEach((notify) => notify());
  });
  await waitFor(() => expect(screen.getByRole('searchbox')).toHaveValue('Radhe'));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 350));
  });
  expect(mockSearch).toBe('q=Radhe');
  expect(lastAsked().q).toBe('Radhe');
});

/** R-DEC-33: a phone scrolls one joined card list; there are no page arrows to aim at. */
it('joins the next page of bills under the phone cards instead of paging', async () => {
  const media = jest.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    matches: query.includes('max-width'),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }));
  const bills = Array.from({ length: 30 }, (_, i) => ({
    ...RAMESH,
    id: `bill-${i + 1}`,
    number: `INV/26-27/${String(i + 1).padStart(4, '0')}`,
  }));
  service.listInvoices.mockImplementation(async (query: InvoiceListQuery) => ({
    ...page(query.page === 2 ? bills.slice(25) : bills.slice(0, 25)),
    page: query.page,
    total: 30,
  }));
  signIn(['sales.invoice.read']);
  const view = renderWithProviders(<InvoicesListPageContent />);
  expect(await screen.findAllByTestId('ub-grid-card')).toHaveLength(25);
  expect(screen.queryByText(/Page 1 of/)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Show more' }));
  await waitFor(() => expect(screen.getAllByTestId('ub-grid-card')).toHaveLength(30));
  expect(lastAsked().page).toBe(2);
  expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
  view.unmount();
  media.mockRestore();
});

/** At 1024 px a full Date column beside the sidebar cut long bill numbers mid-character. */
it('joins the date under the bill number below 1280 px', async () => {
  const media = jest.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    matches: query === '(min-width: 768px)' || query === '(min-width: 1024px)',
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }));
  signIn(['sales.invoice.read']);
  const view = renderWithProviders(<InvoicesListPageContent />);
  await screen.findByRole('columnheader', { name: 'Customer' });
  expect(screen.queryByRole('columnheader', { name: 'Date' })).not.toBeInTheDocument();
  expect(screen.getByText('INV/26-27/0002 · 24/09/2026')).toBeInTheDocument();
  view.unmount();
  media.mockRestore();
});

import { act, fireEvent, screen } from '@testing-library/react';

import { renderWithProviders } from 'src/tests/renderWithProviders';

import { makeDocument } from '../testing/salesFixtures';

import { SalesFlowListPageContent } from './SalesFlowListPageContent';

import type { UseSalesFlowListResult } from '../hooks/useSalesFlowList';
import type { FlowKind } from '../types/salesFlows.types';

jest.mock('../hooks/useSalesFlowList');
jest.mock('modules/DigiKhaato/features/imports/components/ListHeaderActions', () => ({
  ListExportButton: ({ listPath }: { listPath: string }) => {
    const { UbButton } = jest.requireActual('src/design-system');
    return <UbButton data-path={listPath}>Export</UbButton>;
  },
}));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/sales/estimates',
}));
const hooks = jest.requireMock('../hooks/useSalesFlowList') as { useSalesFlowList: jest.Mock };
const source = (): UseSalesFlowListResult => ({
  rows: [
    {
      ...makeDocument({
        party: { id: 'p1', name: 'Radhe Krishna Enterprises — Electrical and Electronics' },
        grand_total: '1240378.00',
      }),
      walkInMobileMasked: null,
      isOverdue: false,
    },
  ],
  totals: { count: 1, grandTotal: '1240378.00', amountDue: '112.00' },
  tabs: { all: 1, sent: 1, open: 1, issued: 1 },
  hasAny: true,
  page: 1,
  pageSize: 25,
  total: 1,
  status: 'succeeded',
  requestId: null,
  error: null,
  stale: false,
  staleUrgency: null,
  filters: {
    tab: 'all',
    preset: 'thisMonth',
    dateFrom: '2026-10-01',
    dateTo: '2026-10-31',
    q: '',
    page: 1,
    originModule: null,
  },
  today: '2026-10-21',
  canRead: true,
  canWrite: true,
  setPreset: jest.fn(),
  setRange: jest.fn(),
  setTab: jest.fn(),
  applyFilters: jest.fn(),
  setQuery: jest.fn(),
  setPage: jest.fn(),
  clearFilters: jest.fn(),
  refetch: jest.fn(),
});
beforeEach(() => jest.clearAllMocks());

it.each<FlowKind>(['estimate', 'sales_order', 'delivery_challan', 'credit_note'])(
  'draws %s as the Part F design: no status chips, no links to the other lists',
  (kind) => {
    /** Part F (owner, 11 Nov 2026): the register is the design's — search, period, table. */
    hooks.useSalesFlowList.mockReturnValue(source());
    renderWithProviders(<SalesFlowListPageContent kind={kind} />);
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.queryByRole('link', { name: 'Bills' })).not.toBeInTheDocument();
    expect(screen.getByTestId('estimate-new')).toBeInTheDocument();
  }
);

it.each<[FlowKind, boolean]>([
  ['estimate', true],
  ['credit_note', true],
  ['sales_order', false],
  ['delivery_challan', false],
])('offers Export on %s: %s', (kind, shown) => {
  /** The design's Export, where the server has one; orders and challans have none. */
  hooks.useSalesFlowList.mockReturnValue(source());
  renderWithProviders(<SalesFlowListPageContent kind={kind} />);
  const button = screen.queryByRole('button', { name: 'Export' });
  expect(Boolean(button)).toBe(shown);
  if (button) expect(button.dataset.path).toMatch(kind === 'estimate' ? /estimates/ : /credit-notes/);
});

it('synchronizes an externally changed query without sending the old search back', async () => {
  /** Defect: the old local search overwrote URL/clear changes with its stale debounced value. */
  const state = source();
  hooks.useSalesFlowList.mockReturnValue(state);
  const view = renderWithProviders(<SalesFlowListPageContent kind="estimate" />);
  hooks.useSalesFlowList.mockReturnValue({ ...state, filters: { ...state.filters, q: 'switch' } });
  view.rerender(<SalesFlowListPageContent kind="estimate" />);
  expect(screen.getByRole('searchbox')).toHaveValue('switch');
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 350));
  });
  expect(state.setQuery).not.toHaveBeenCalled();
});

it('offers the existing drafts when the recorded credit-note view is empty', () => {
  /** A book containing only drafts is not first use, and clearing an already-default filter cannot reveal them. */
  const base = source();
  const state: UseSalesFlowListResult = {
    ...base,
    rows: [],
    total: 0,
    totals: { count: 0, grandTotal: '0.00', amountDue: '0.00' },
    tabs: { all: 0, draft: 1 },
    filters: { ...base.filters, preset: 'thisFy' },
  };
  hooks.useSalesFlowList.mockReturnValue(state);
  renderWithProviders(<SalesFlowListPageContent kind="credit_note" />);
  fireEvent.click(screen.getByRole('button', { name: 'Show drafts' }));
  expect(state.setTab).toHaveBeenCalledWith('draft');
});

it('keeps a read-only register usable without offering a write action', () => {
  const state = { ...source(), canWrite: false };
  hooks.useSalesFlowList.mockReturnValue(state);
  renderWithProviders(<SalesFlowListPageContent kind="estimate" />);
  expect(screen.queryByRole('link', { name: 'New estimate' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'New estimate' })).not.toBeInTheDocument();
  expect(screen.getByRole('searchbox')).toBeInTheDocument();
});

it('does not render cached records when read permission is absent', () => {
  /** A denied role must not see records left in the shared list source. */
  hooks.useSalesFlowList.mockReturnValue({ ...source(), canRead: false });
  renderWithProviders(<SalesFlowListPageContent kind="estimate" />);
  expect(screen.queryByTestId('ub-grid')).not.toBeInTheDocument();
  expect(screen.queryByText(/Radhe Krishna/)).not.toBeInTheDocument();
});

it('uses the joined identity/date at1024 even though the grid tier is full', async () => {
  /** The shared grid becomes full at1024, before a 232px sidebar leaves room for all date columns. */
  const media = jest.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    matches: query === '(min-width: 768px)' || query === '(min-width: 1024px)',
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: () => true,
  }));
  try {
    hooks.useSalesFlowList.mockReturnValue(source());
    renderWithProviders(<SalesFlowListPageContent kind="estimate" />);
    await screen.findByRole('columnheader', { name: 'Customer' });
    expect(screen.queryByRole('columnheader', { name: 'Date' })).not.toBeInTheDocument();
  } finally {
    media.mockRestore();
  }
});

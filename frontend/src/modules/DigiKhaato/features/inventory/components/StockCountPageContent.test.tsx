import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { sessionLoaded } from 'src/redux/slice/sessionSlice';
import { store } from 'src/redux/store';
import { renderWithProviders } from 'src/tests/renderWithProviders';
import type { PermissionCode } from 'src/types/domain.types';

import * as service from '../api/stockCountService';

import { StockCountPageContent } from './StockCountPageContent';

/**
 * C3 — stock count (design pCount / dCount, R-DEC-67). The jsdom default is
 * the phone layer. Prevents: a scan that does not count, a typed count that
 * does not save, Save count reachable by staff without the adjust right, and
 * the ₹ value change shown to someone who may not see costs.
 */
jest.mock('../api/stockCountService', () => ({
  openStockCount: jest.fn(),
  getStockCountLines: jest.fn(),
  setStockCountLine: jest.fn(),
  saveStockCount: jest.fn(),
}));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/stock/count',
  useSearchParams: () => new URLSearchParams(),
}));

const SUMMARY = {
  id: 'c1',
  status: 'open' as const,
  startedAt: '2026-10-30T10:40:00Z',
  savedAt: null,
  counted: 1,
  differ: 1,
  itemsTotal: 2,
  valueChange: '-60.00',
};
const ROWS = [
  {
    itemId: 'i1',
    name: 'Lifebuoy Soap',
    sku: 'S1',
    barcode: null,
    unitCode: 'NOS',
    allowDecimal: false,
    booksQty: '10.000',
    countedQty: '7.000',
    difference: '-3.000',
    valueChange: '-60.00',
  },
  {
    itemId: 'i2',
    name: 'Tata Salt',
    sku: 'S2',
    barcode: null,
    unitCode: 'NOS',
    allowDecimal: false,
    booksQty: '5.000',
    countedQty: null,
    difference: null,
    valueChange: null,
  },
];

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
      activeTenant: { id: 't1', name: 'Gupta Kirana Store', timezone: 'Asia/Kolkata' },
      tenants: [{ id: 't1', name: 'Gupta Kirana Store', timezone: 'Asia/Kolkata' }],
      permissions: [...permissions],
      enabledModules: ['inventory'],
      version: 1,
    })
  );
};

beforeEach(() => {
  jest.mocked(service.openStockCount).mockResolvedValue(SUMMARY);
  jest.mocked(service.getStockCountLines).mockResolvedValue({
    rows: ROWS,
    page: 1,
    pageSize: 50,
    total: 2,
  });
  jest.mocked(service.setStockCountLine).mockResolvedValue({ ...SUMMARY, counted: 2 });
  jest.mocked(service.saveStockCount).mockResolvedValue({ ...SUMMARY, status: 'saved' });
});

it('reads books against counted, and a "Count" sheet saves what is on the shelf', async () => {
  signIn([
    'inventory.item.read',
    'inventory.stock.read',
    'inventory.stock.adjust',
    'reports.financial.read',
  ]);
  const user = userEvent.setup();
  renderWithProviders(<StockCountPageContent />);
  expect(await screen.findByText('In books 10 · Counted 7')).toBeInTheDocument();
  expect(screen.getByText('−3')).toBeInTheDocument();
  expect(screen.getByTestId('count-line')).toHaveTextContent('Counted 1 item');
  expect(screen.getByTestId('count-line')).toHaveTextContent('Value change −₹60.00');
  await user.click(screen.getByRole('button', { name: 'Count Tata Salt' }));
  await user.type(await screen.findByTestId('count-sheet-input'), '4');
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(service.setStockCountLine).toHaveBeenCalledWith('c1', 'i2', { qty: '4' })
  );
});

it('Save count asks first, then posts the count once', async () => {
  signIn(['inventory.item.read', 'inventory.stock.read', 'inventory.stock.adjust']);
  const user = userEvent.setup();
  renderWithProviders(<StockCountPageContent />);
  const dock = await screen.findByTestId('count-dock');
  await user.click(within(dock).getByRole('button', { name: 'Save count' }));
  expect(await screen.findByText('Save this count?')).toBeInTheDocument();
  await user.click(screen.getByTestId('count-save-confirm'));
  await waitFor(() => expect(service.saveStockCount).toHaveBeenCalledTimes(1));
});

it('staff count but have no Save and see no ₹ value', async () => {
  jest.mocked(service.openStockCount).mockResolvedValue({ ...SUMMARY, valueChange: null });
  signIn(['inventory.item.read', 'inventory.stock.read']);
  renderWithProviders(<StockCountPageContent />);
  expect(await screen.findByText('In books 10 · Counted 7')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Save count|^Save$/ })).toBeNull();
  expect(screen.getByTestId('count-line')).not.toHaveTextContent('Value change');
});

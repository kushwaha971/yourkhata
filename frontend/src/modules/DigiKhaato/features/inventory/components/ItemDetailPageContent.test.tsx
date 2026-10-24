import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { sessionLoaded } from 'src/redux/slice/sessionSlice';
import { store } from 'src/redux/store';
import { renderWithProviders } from 'src/tests/renderWithProviders';
import type { PermissionCode } from 'src/types/domain.types';

import * as service from '../api/itemService';

import { ItemDetailPageContent } from './ItemDetailPageContent';

import type { Item, StockMovement } from '../types/item.types';

/**
 * 09 §8.2 — the item page in its approved order: stock now, in words; then
 * price (margin with permission only); then what moved it, as chips, every row
 * named and linked. Each test names the defect it keeps out.
 */
jest.mock('../api/itemService', () => ({
  ...jest.requireActual('../api/itemService'),
  getItem: jest.fn(),
  listMovements: jest.fn(),
}));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/items/i1',
  useSearchParams: () => new URLSearchParams(''),
}));

const ITEM: Item = {
  id: 'i1',
  name: 'Atta 10 kg bag',
  sku: 'SKU-001',
  barcode: null,
  itemType: 'goods',
  category: null,
  unit: { id: 'u1', code: 'BAG', name: 'Bags' } as Item['unit'],
  sellingPrice: '450.00',
  purchasePrice: '390.00',
  taxCode: 'GST5',
  hsnSac: '1101',
  taxRate: {
    code: 'GST5',
    name: 'GST 5%',
    rate: '5.00',
    cessRate: '0.00',
    effectiveTo: null,
    isCurrent: true,
  },
  taxInclusiveSelling: true,
  mrp: null,
  trackStock: true,
  onHand: '24.000',
  avgCost: '380.0000',
  reorderPoint: '5.000',
  stockStatus: 'ok',
  stockValue: '9120.00',
  status: 'active',
  updatedAt: '2026-10-20T10:00:00Z',
  description: '',
  version: 1,
  createdAt: '2026-01-01T10:00:00Z',
  stock: [
    {
      location: { id: 'l1', code: 'MAIN', name: 'Shop' },
      onHand: '24.000',
      avgCost: '380.0000',
      value: '9120.00',
      lastMovementAt: null,
    },
  ],
  opening: null,
  hasMovements: true,
  movementsRecent: [],
};

const MOVE: StockMovement = {
  id: 'm1',
  sequenceNo: 2,
  movementDate: '2026-10-20',
  movementType: 'reversal',
  qty: '-5.000',
  unitCost: null,
  value: null,
  onHandAfter: '24.000',
  avgCostAfter: null,
  reason: 'void',
  source: {
    type: 'purchase_document',
    id: 'b1',
    number: 'PB/0012',
    kind: 'purchase_bill',
    status: 'void',
  },
  reversesId: 'm0',
  isBackdated: false,
  createdBy: null,
  createdAt: '2026-10-20T10:00:00Z',
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
      activeTenant: { id: 't1', name: 'Gupta Kirana Store', timezone: 'Asia/Kolkata' },
      tenants: [{ id: 't1', name: 'Gupta Kirana Store', timezone: 'Asia/Kolkata' }],
      permissions: [...permissions],
      enabledModules: ['inventory', 'purchases', 'sales'],
      version: 1,
    })
  );
};

const OWNER: readonly PermissionCode[] = [
  'inventory.item.read',
  'inventory.item.write',
  'inventory.item.delete',
  'inventory.stock.read',
  'inventory.stock.adjust',
  'reports.financial.read',
  'purchases.bill.read',
  'sales.invoice.read',
] as PermissionCode[];

beforeEach(() => {
  jest.mocked(service.getItem).mockResolvedValue(ITEM);
  jest
    .mocked(service.listMovements)
    .mockResolvedValue({ rows: [MOVE], nextCursor: null, hasMore: false });
});

it('leads with the stock in words, then Adjust stock and Edit on the page', async () => {
  signIn(OWNER);
  renderWithProviders(<ItemDetailPageContent id="i1" />);
  expect(await screen.findByTestId('item-stock-figure')).toHaveTextContent('24 BAG in stock');
  expect(screen.getByText('Low below 5 BAG')).toBeInTheDocument();
  const row = screen.getByTestId('item-primary-actions');
  expect(within(row).getByRole('button', { name: /Adjust stock/ })).toBeInTheDocument();
  expect(within(row).getByRole('button', { name: /Edit/ })).toBeInTheDocument();
});

it('shows the usual price with its GST, and the margin only with the cost permission', async () => {
  signIn(OWNER);
  const { unmount } = renderWithProviders(<ItemDetailPageContent id="i1" />);
  const price = await screen.findByTestId('item-price');
  expect(within(price).getByText('Usual price')).toBeInTheDocument();
  expect(within(price).getByText('incl. GST 5%')).toBeInTheDocument();
  expect(within(price).getByTestId('item-margin')).toHaveTextContent('9.0%');
  unmount();

  signIn(OWNER.filter((p) => p !== 'reports.financial.read'));
  jest.mocked(service.getItem).mockResolvedValue({ ...ITEM, purchasePrice: null, avgCost: null });
  renderWithProviders(<ItemDetailPageContent id="i1" />);
  const hidden = await screen.findByTestId('item-price');
  expect(within(hidden).queryByText('Purchase price')).not.toBeInTheDocument();
  expect(within(hidden).queryByTestId('item-margin')).not.toBeInTheDocument();
});

it('says a below-cost margin in words, not colour alone', async () => {
  signIn(OWNER);
  jest.mocked(service.getItem).mockResolvedValue({ ...ITEM, sellingPrice: '350.00' });
  renderWithProviders(<ItemDetailPageContent id="i1" />);
  expect(await screen.findByTestId('item-margin')).toHaveTextContent(/selling below cost/);
});

it('names a cancelled bill on its movement and links to it, with no raw message id', async () => {
  signIn(OWNER);
  renderWithProviders(<ItemDetailPageContent id="i1" />);
  const link = await screen.findByRole('link', { name: /PB\/0012 cancelled/ });
  expect(link).toHaveAttribute('href', '/purchases/bills/b1');
  expect(screen.queryByText(/stock\.adjust\.reason/)).not.toBeInTheDocument();
});

it('history is chips; a failed movements tab offers retry instead of "No movements yet"', async () => {
  signIn(OWNER);
  jest.mocked(service.listMovements).mockRejectedValueOnce(new Error('offline'));
  jest.mocked(service.getItem).mockResolvedValue({ ...ITEM, id: 'i2' });
  renderWithProviders(<ItemDetailPageContent id="i2" />);
  expect(await screen.findByText("Couldn't load movements")).toBeInTheDocument();
  expect(screen.queryByText('No movements yet')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('link', { name: /PB\/0012 cancelled/ })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'Sales' })).toBeInTheDocument();
});

it('a service says it has no stock and offers no Adjust stock', async () => {
  signIn(OWNER);
  jest.mocked(service.getItem).mockResolvedValue({
    ...ITEM,
    itemType: 'service',
    trackStock: false,
    onHand: null,
    stockStatus: null,
    stock: [],
  });
  renderWithProviders(<ItemDetailPageContent id="i1" />);
  expect(await screen.findByText('Services have no stock')).toBeInTheDocument();
  expect(screen.queryByTestId('item-adjust')).not.toBeInTheDocument();
});

it('an archived item carries a banner with Restore', async () => {
  signIn(OWNER);
  jest.mocked(service.getItem).mockResolvedValue({ ...ITEM, status: 'archived' });
  renderWithProviders(<ItemDetailPageContent id="i1" />);
  expect(await screen.findByText(/This item is archived/)).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Restore' }).length).toBeGreaterThan(0);
  expect(screen.queryByTestId('item-primary-actions')).not.toBeInTheDocument();
});

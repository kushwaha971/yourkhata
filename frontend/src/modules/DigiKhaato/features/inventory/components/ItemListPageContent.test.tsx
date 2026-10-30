import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { sessionLoaded } from 'src/redux/slice/sessionSlice';
import { store } from 'src/redux/store';
import { renderWithProviders } from 'src/tests/renderWithProviders';
import type { PermissionCode } from 'src/types/domain.types';

import * as service from '../api/itemService';

import { ItemListPageContent } from './ItemListPageContent';

import type { ItemListResult } from '../types/item.types';

/**
 * The approved list designs (owner, 12 Oct 2026: "I don't want that type of
 * screen in case of empty"). An empty catalogue is one sentence and one
 * button — not "Items 0 · Stock value ₹0.00", four tabs at 0, a search box
 * and Filters over a dashed box. And on a phone the stock tabs are inside the
 * one Filters sheet.
 */
jest.mock('../api/itemService', () => ({
  ...jest.requireActual('../api/itemService'),
  listItems: jest.fn(),
  lookupItemByBarcode: jest.fn(),
}));
let mockSearch = '';
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, prefetch: jest.fn() }),
  usePathname: () => '/items',
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

const PAGE: ItemListResult = {
  rows: [],
  page: 1,
  pageSize: 25,
  total: 0,
  totalPages: 0,
  totals: { items: 0, stockValue: '0.00' },
  counts: { all: 0, in: 0, low: 0, out: 0 },
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
      enabledModules: ['inventory'],
      version: 1,
    })
  );
};

beforeEach(() => {
  mockSearch = '';
  mockReplace.mockReset();
});

it('an empty catalogue is one sentence and one button', async () => {
  jest.mocked(service.listItems).mockResolvedValue({ ...PAGE, hasAny: false });
  signIn(['inventory.item.read', 'inventory.item.write']);
  renderWithProviders(<ItemListPageContent />);
  expect(await screen.findByText('No items yet')).toBeInTheDocument();
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  expect(screen.queryByTestId('filters-button')).not.toBeInTheDocument();
  expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  expect(screen.queryByText('₹0.00')).not.toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: /Add item/ })).toHaveLength(1);
});

it('on a phone, Low is a chip above the cards, not inside the Filters sheet (09 §8.1)', async () => {
  /** R-DEC-30: status chips stay visible; a stock state hidden in a sheet took two taps. */
  jest.mocked(service.listItems).mockResolvedValue({
    ...PAGE,
    hasAny: true,
    counts: { all: 3, in: 2, low: 1, out: 0 },
  });
  signIn(['inventory.item.read']);
  const user = userEvent.setup();
  renderWithProviders(<ItemListPageContent />);
  const group = await screen.findByRole('radiogroup', { name: 'Stock' });
  expect(within(group).getByRole('radio', { name: 'Out of stock · 0' })).toBeInTheDocument();
  await user.click(within(group).getByRole('radio', { name: 'Low · 1' }));
  await waitFor(() =>
    expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining('tab=low'), {
      scroll: false,
    })
  );
  await user.click(screen.getByTestId('filters-button'));
  expect(await screen.findByTestId('filters-apply')).toBeInTheDocument();
  expect(screen.getAllByRole('radiogroup', { name: 'Stock' })).toHaveLength(1);
});

const ROW = {
  id: 'i1',
  name: 'Lifebuoy Soap 100g',
  sku: 'LIFEBUOY-001',
  barcode: null,
  itemType: 'goods',
  category: { id: 'c1', name: 'Soap & co' },
  unit: { id: 'u-nos', code: 'NOS', allowDecimal: false },
  sellingPrice: '1059.00',
  purchasePrice: '40.00',
  taxCode: 'GST18',
  trackStock: true,
  onHand: '12',
  avgCost: '40.00',
  reorderPoint: null,
  stockStatus: 'ok',
  stockValue: '480.00',
  status: 'active',
  matchField: null,
  updatedAt: '2026-10-17T05:00:00Z',
} as const;

it('on a phone, a card reads price, stock in words and code — never the cost (09 §8.1)', async () => {
  /**
   * SH-012 put the price on the card; 09 §8.1 moves it to the trailing slot and
   * writes the stock as words. LOOK 23 Oct: "SKU · category" was cut mid-word on
   * every 390 px card, so the category leaves the card for the filter.
   */
  jest.mocked(service.listItems).mockResolvedValue({
    ...PAGE,
    hasAny: true,
    total: 3,
    totalPages: 1,
    counts: { all: 3, in: 1, low: 1, out: 1 },
    rows: [
      ROW,
      { ...ROW, id: 'i2', name: 'Rin Bar', sku: 'RIN-002', onHand: '3', stockStatus: 'low' },
      { ...ROW, id: 'i3', name: 'Surf 1kg', sku: 'SURF-003', onHand: '0', stockStatus: 'out' },
    ],
  });
  signIn(['inventory.item.read', 'reports.financial.read']);
  renderWithProviders(<ItemListPageContent />);
  const card = (await screen.findByText('Lifebuoy Soap 100g')).closest('li') as HTMLElement;
  expect(card).toHaveTextContent('₹1,059.00usual price');
  expect(within(card).getByText('12 NOS in stock')).toBeInTheDocument();
  expect(within(card).getByText('LIFEBUOY-001')).toBeInTheDocument();
  expect(card).not.toHaveTextContent('Soap & co');
  expect(within(card).queryByText(/₹40\.00/)).not.toBeInTheDocument();
  expect(screen.getByText('Low: 3 NOS left')).toBeInTheDocument();
  expect(screen.getAllByText('Out of stock').length).toBeGreaterThan(0);
});

it('on a phone, a camera scan of an unknown code opens "Not in your items" with Add and Scan again (C2)', async () => {
  /**
   * Design pScanNF. Prevents: an unknown code answered only by a snackbar and
   * a banner a phone has to scroll for, and "Add item" losing the scanned
   * barcode. The camera reads once and closes; the sheet says it was the
   * camera, shows the code big, and Add opens the form with that barcode.
   */
  jest.mocked(service.listItems).mockResolvedValue({ ...PAGE, rows: [ROW], total: 1, hasAny: true });
  const lookup = jest.mocked(service.lookupItemByBarcode).mockResolvedValue(null);
  let seen: string | null = '8901030875021';
  (globalThis as unknown as { BarcodeDetector: unknown }).BarcodeDetector = class {
    detect = async () => {
      const code = seen;
      seen = null;
      return code ? [{ rawValue: code }] : [];
    };
  };
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: async () => ({ getTracks: () => [], getVideoTracks: () => [] }) },
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: () => Promise.resolve(),
  });
  try {
    signIn(['inventory.item.read', 'inventory.item.write']);
    const user = userEvent.setup();
    renderWithProviders(<ItemListPageContent />);
    await user.click(await screen.findByRole('button', { name: 'Scan with camera' }));
    const sheet = await screen.findByTestId('scan-not-in-items', {}, { timeout: 3000 });
    expect(lookup).toHaveBeenCalledWith('8901030875021');
    expect(screen.queryByTestId('scan-sheet')).toBeNull();
    expect(within(sheet).getByText('8901030875021')).toBeInTheDocument();
    expect(within(sheet).getByText('Scanned just now with the camera')).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: /Scan again/ })).toBeInTheDocument();
    await user.click(within(sheet).getByRole('button', { name: /Add item with this barcode/ }));
    // The item form opens for a new item with the scanned barcode filled in.
    await waitFor(() =>
      expect((store.getState() as unknown as { itemForm?: { openFor: string; prefillBarcode: string } }).itemForm).toMatchObject({
        openFor: 'new',
        prefillBarcode: '8901030875021',
      })
    );
    // …and in sight: the Codes section opens on it (it was filled, closed).
    expect(await screen.findByDisplayValue('8901030875021', {}, { timeout: 5000 })).toBeVisible();
  } finally {
    lookup.mockReset();
    delete (globalThis as unknown as { BarcodeDetector?: unknown }).BarcodeDetector;
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
  }
});

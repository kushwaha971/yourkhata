import { screen } from '@testing-library/react';

import { renderWithProviders } from 'src/tests/renderWithProviders';

import { ExpiryPageContent } from 'modules/DigiKhaato/features/inventory/components/ExpiryPageContent';
import { PriceListsPageContent } from 'modules/DigiKhaato/features/inventory/components/PriceListsPageContent';
import { ShortBookPageContent } from 'modules/DigiKhaato/features/inventory/components/ShortBookPageContent';

/**
 * Owner, 13 Nov 2026: "if any feature is not access to any other type of user,
 * based on role hide that feature for that specific user". A staff member and
 * an accountant signed in to the Business app and were walked through every
 * page. Three screens still offered what the role table does not give them:
 * the short book's Add (needs the right to change items), the price lists' and
 * the expiry list's Export (staff export nothing), and the expiry list's
 * Return to distributor (a debit note, which an accountant cannot write).
 */
jest.mock('modules/DigiKhaato/features/inventory/api/shortBookService');
jest.mock('modules/DigiKhaato/features/inventory/api/expiryService');
jest.mock('modules/DigiKhaato/features/inventory/api/priceListService', () => ({
  ...jest.requireActual('modules/DigiKhaato/features/inventory/api/priceListService'),
  listPriceLists: jest.fn(),
}));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/stock',
  useSearchParams: () => new URLSearchParams(),
}));

let granted: readonly string[] = [];
jest.mock('src/hooks/usePermissions', () => ({
  usePermissions: () => ({
    can: (code: string) => granted.includes(code),
    canAll: (codes: readonly string[]) => codes.every((c) => granted.includes(c)),
    hasModule: () => true,
    permissions: granted,
  }),
}));

const shortBook = jest.requireMock('modules/DigiKhaato/features/inventory/api/shortBookService') as { getShortBook: jest.Mock };
const expiry = jest.requireMock('modules/DigiKhaato/features/inventory/api/expiryService') as { getExpiry: jest.Mock };
const priceLists = jest.requireMock('modules/DigiKhaato/features/inventory/api/priceListService') as { listPriceLists: jest.Mock };

const STAFF = ['inventory.item.read', 'inventory.stock.read', 'purchases.bill.read', 'purchases.bill.write'];
const ACCOUNTANT = ['inventory.item.read', 'inventory.stock.read', 'purchases.bill.read', 'reports.export', 'reports.financial.read'];
const OWNER = [...STAFF, 'inventory.item.write', 'reports.export', 'reports.financial.read'];

beforeEach(() => {
  shortBook.getShortBook.mockResolvedValue({
    rows: [{ item: { id: 'i1', name: 'Crocin 650', unitCode: 'STRIP', salt: null }, reason: 'asked', askedCount: 2, onHand: '0', qty: '10', supplier: null, lastRate: null }],
    counts: { items: 1, distributors: 0, askedToday: 1 },
  });
  expiry.getExpiry.mockResolvedValue({
    rows: [{ item: { id: 'i1', name: 'Crocin 650' }, batchNo: 'B1', expiry: '2026-12-01', days: 18, qty: '4', value: null, supplier: 'Mehta Pharma', purchaseId: 'p1' }],
    counts: { expired: 0, '30': 1, '60': 1, '90': 1 },
  });
  priceLists.listPriceLists.mockResolvedValue([{ id: 'w1', name: 'Wholesale', adjustPercent: '-5.00', rateCount: 2, partyCount: 1 }]);
});

describe('The Business app shows a member only what their role may do', () => {
  it.each([['staff', STAFF], ['accountant', ACCOUNTANT]])('%s read the short book but are not offered Add', async (_role, codes) => {
    granted = codes;
    renderWithProviders(<ShortBookPageContent />);
    expect((await screen.findAllByText('Crocin 650')).length).toBeGreaterThan(0);
    expect(screen.queryByTestId('short-book-add')).not.toBeInTheDocument();
  });

  it('the owner keeps Add on the short book', async () => {
    granted = OWNER;
    renderWithProviders(<ShortBookPageContent />);
    expect(await screen.findByTestId('short-book-add')).toBeInTheDocument();
  });

  it('staff see the price lists without Export; the accountant keeps it', async () => {
    granted = STAFF;
    const first = renderWithProviders(<PriceListsPageContent />);
    expect((await screen.findAllByText('Wholesale')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Export' })).not.toBeInTheDocument();
    first.unmount();
    granted = ACCOUNTANT;
    renderWithProviders(<PriceListsPageContent />);
    expect(await screen.findByRole('button', { name: 'Export' })).toBeInTheDocument();
  });

  it('staff see the expiry list without Export but may return goods', async () => {
    granted = STAFF;
    renderWithProviders(<ExpiryPageContent />);
    expect((await screen.findAllByText('Crocin 650')).length).toBeGreaterThan(0);
    expect(screen.queryByTestId('expiry-export')).not.toBeInTheDocument();
    expect(screen.getByTestId('expiry-return')).toBeInTheDocument();
  });

  it('the accountant reads the expiry list but is not offered a return', async () => {
    granted = ACCOUNTANT;
    renderWithProviders(<ExpiryPageContent />);
    expect((await screen.findAllByText('Crocin 650')).length).toBeGreaterThan(0);
    expect(screen.queryByTestId('expiry-return')).not.toBeInTheDocument();
  });
});

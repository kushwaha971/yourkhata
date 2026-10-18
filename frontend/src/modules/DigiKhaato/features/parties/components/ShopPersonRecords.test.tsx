import { screen, waitFor } from '@testing-library/react';

import { renderWithProviders } from 'src/tests/renderWithProviders';

import { listInvoices } from 'modules/DigiKhaato/features/sales/api/salesService';

import { ShopPersonRecords } from './ShopPersonRecords';

jest.mock('modules/DigiKhaato/features/sales/api/salesService');
const list = jest.mocked(listInvoices);

/** A migrated book can have unpaid bills without any Shop ledger timeline rows. */
it('reads actual unpaid Shop bills for this person and links to the owning document', async () => {
  list.mockResolvedValue({ rows: [{ id: 'bill-1', kind: 'invoice', number: 'INV-001',
    documentDate: '2026-10-18', amountDue: '1000.00', amountPaid: '200.00',
    grandTotal: '1200.00', status: 'partially_paid', party: null, walkInName: null,
    walkInMobileMasked: null, dueOn: null, validUntil: null, isOverdue: false,
    voidReason: null, createdBy: null }], page: 1, pageSize: 25, total: 1,
    totals: { count: 1, grandTotal: '1200.00', amountDue: '1000.00' },
    tabs: { all: 1, unpaid: 1, paid: 0, overdue: 0, draft: 0, void: 0 } });
  renderWithProviders(<ShopPersonRecords partyId="person-1" />);
  expect(await screen.findByRole('link', { name: 'INV-001' })).toHaveAttribute('href', '/sales/invoices/bill-1');
  expect(screen.getByText('₹1,000.00')).toBeInTheDocument();
  await waitFor(()=>expect(list).toHaveBeenCalledWith(expect.objectContaining({
    partyId: 'person-1', book: 'shop', tab: 'unpaid', page: 1,
  }), expect.anything()));
});

import { fireEvent, screen, waitFor } from '@testing-library/react';

import { renderWithProviders } from 'src/tests/renderWithProviders';

import { CounterSearchPanel as CounterSearch } from './CounterSearchPanel';

const push = jest.fn();
jest.mock('src/hooks/useAppRouter', () => ({ useAppRouter: () => ({ push }) }));
jest.mock('src/hooks/usePermissions', () => ({
  usePermissions: () => ({ can: () => true, hasModule: () => true }),
}));
jest.mock('../../purchases/api/purchaseBillService', () => ({
  listPurchaseBills: jest.fn().mockResolvedValue({ rows: [], pageSize: 25, total: 0 }),
}));
jest.mock('../../sales/api/salesService', () => ({
  listInvoices: jest.fn().mockResolvedValue({ rows: [], pageSize: 25, total: 0 }),
}));
jest.mock('../../parties/hooks/usePartySearch', () => ({
  usePartySearch: () => {
    const [query, setQuery] = jest.requireActual('react').useState('');
    return {
      query,
      setQuery,
      activate: jest.fn(),
      pending: false,
      results: [
        ...(query === 'Sharma'
          ? [
              {
                id: 'p2',
                name: 'Sharma Mart',
                mobile: null,
                isCustomer: true,
                isSupplier: false,
                shop: { customerDue: '500.00', supplierDue: '0.00' },
              },
            ]
          : []),
        {
          id: 'p1',
          name: 'Radhe Krishna Enterprises',
          mobile: '+919876543210',
          isCustomer: true,
          isSupplier: true,
          shop: { customerDue: '1240.00', supplierDue: '600.00' },
        },
      ],
    };
  },
}));
jest.mock('../../inventory/hooks/useItemSearch', () => ({
  useItemSearch: () => {
    const [query, setQuery] = jest.requireActual('react').useState('');
    return {
      query,
      setQuery,
      activate: jest.fn(),
      pending: false,
      results:
        query === 'LED'
          ? [
              {
                id: 'i1',
                name: 'LED driver',
                sellingPrice: '900.00',
                onHand: '14.000',
                unit: { id: 'u1', code: 'PCS', allowDecimal: false },
              },
            ]
          : [],
    };
  },
}));
const field = () => screen.getByRole('combobox', { name: 'Find or start' });
const option = (name: string | RegExp) => screen.findByRole('option', { name });

beforeEach(() => push.mockClear());
it('opens a reviewed Shop payment for a name and amount, preserving separate dual-role actions', async () => {
  const onPayment = jest.fn();
  renderWithProviders(<CounterSearch onPayment={onPayment} />);
  fireEvent.change(field(), { target: { value: 'Radhe 2000' } });
  const receive = await option(/^Receive ₹2,000\.00 from Radhe Krishna Enterprises/);
  expect(
    screen.getByRole('option', { name: /^Pay ₹2,000\.00 to Radhe Krishna Enterprises/ })
  ).toBeInTheDocument();
  fireEvent.click(receive);
  expect(onPayment).toHaveBeenCalledWith(
    expect.objectContaining({
      direction: 'in',
      bucket: 'shop',
      presetAmount: '2000.00',
      partyId: 'p1',
    })
  );
  expect(push).not.toHaveBeenCalled();
});
it('opens an item-seeded new bill without saving a document from the search', async () => {
  renderWithProviders(<CounterSearch onPayment={jest.fn()} />);
  fireEvent.change(field(), { target: { value: 'LED' } });
  fireEvent.click(await option(/^LED driver Stock 14 PCS/));
  await waitFor(() => expect(push).toHaveBeenCalledWith('/sales/invoices/new?item=i1'));
});

/** Regression: a document number must open its source, not a person search. */
it('finds both sales and supplier bills through their existing Shop services', async () => {
  const sales = jest.requireMock('../../sales/api/salesService');
  const purchases = jest.requireMock('../../purchases/api/purchaseBillService');
  sales.listInvoices.mockResolvedValueOnce({
    rows: [
      {
        id: 'd1',
        number: 'INV/26/1',
        grandTotal: '900.00',
        party: { name: 'Radhe Krishna Enterprises' },
      },
    ],
    pageSize: 25,
    total: 1,
  });
  purchases.listPurchaseBills.mockResolvedValueOnce({
    rows: [
      {
        id: 'b1',
        number: 'PB/26/1',
        grandTotal: '700.00',
        party: { name: 'Radhe Krishna Enterprises' },
      },
    ],
    pageSize: 25,
    total: 1,
  });
  renderWithProviders(<CounterSearch onPayment={jest.fn()} />);
  fireEvent.change(field(), { target: { value: '26/1' } });
  fireEvent.click(await option(/^PB\/26\/1 · Radhe Krishna Enterprises/));
  expect(push).toHaveBeenCalledWith('/purchases/bills/b1');
  expect(sales.listInvoices).toHaveBeenCalledWith(
    expect.objectContaining({ book: 'shop', q: '26/1' }),
    expect.anything()
  );
});

/** D-L2: command identity must show the same grouped mobile as the party list. */
it('keeps a grouped mobile beside the contact role', async () => {
  renderWithProviders(<CounterSearch onPayment={jest.fn()} />);
  fireEvent.change(field(), { target: { value: 'Radhe' } });
  expect(await screen.findAllByText('Customer · +91 98765 43210')).toHaveLength(1);
});

/**
 * A1 / FB-011 — the owner's complaint was one long list where every row
 * wrapped onto two or three lines and "nothing is saved yet" was repeated on
 * each. Results are grouped, the warning is said once in the Start heading,
 * and a person's row carries what they owe — in neutral ink, as the design
 * draws it (the list is for finding, not for reading balances).
 */
it('groups results under Start, People, Items and Bills with the warning said once', async () => {
  renderWithProviders(<CounterSearch onPayment={jest.fn()} />);
  fireEvent.change(field(), { target: { value: 'Radhe' } });
  await option(/^New bill for Radhe Krishna Enterprises/);
  expect(screen.getByText('Start · nothing is saved until you press Save')).toBeInTheDocument();
  expect(screen.getByText('People')).toBeInTheDocument();
  expect(screen.queryByText(/nothing is saved yet/)).not.toBeInTheDocument();
  const owed = screen.getByText('₹1,240.00 to collect');
  expect(owed.className).toContain('text-text-secondary');
  expect(screen.getByText('₹600.00 to pay')).toBeInTheDocument();
});

/** A1 — the design's Start row: receive money from a customer who owes, no amount typed. */
it('offers to receive money from a customer who owes, without a preset amount', async () => {
  const onPayment = jest.fn();
  renderWithProviders(<CounterSearch onPayment={onPayment} />);
  fireEvent.change(field(), { target: { value: 'Radhe' } });
  fireEvent.click(await option(/^Receive money from Radhe Krishna Enterprises Owes ₹1,240\.00/));
  expect(onPayment).toHaveBeenCalledWith(
    expect.objectContaining({ direction: 'in', partyId: 'p1', tradeRole: 'customer' })
  );
  expect(onPayment.mock.calls[0][0].presetAmount).toBeUndefined();
});

/**
 * A1 — Start is the best match's actions. With two New bill and Receive rows
 * per matching customer, "sharma" filled a phone with Start and pushed People,
 * Items and Bills off the screen.
 */
it('offers Start actions for the best match only', async () => {
  renderWithProviders(<CounterSearch onPayment={jest.fn()} />);
  fireEvent.change(field(), { target: { value: 'Sharma' } });
  await option(/^New bill for Sharma Mart/);
  expect(screen.getAllByRole('option', { name: /^New bill for/ })).toHaveLength(1);
  expect(screen.getAllByRole('option', { name: /^Receive money from/ })).toHaveLength(1);
  expect(
    screen.getByRole('option', { name: /^Radhe Krishna Enterprises Customer/ })
  ).toBeInTheDocument();
});

import { fireEvent, screen, waitFor } from '@testing-library/react';

import type { UbAsyncComboboxProps } from 'src/design-system';
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
        {
          id: 'p1',
          name: 'Radhe Krishna Enterprises',
          mobile: '+919876543210',
          isCustomer: true,
          isSupplier: true,
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
      results: query === 'LED' ? [{ id: 'i1', name: 'LED driver', sellingPrice: '900.00' }] : [],
    };
  },
}));
jest.mock('src/design-system', () => ({
  ...jest.requireActual('src/design-system'),
  UbAsyncCombobox: (props: UbAsyncComboboxProps) => {
    const { UbTextInput, UbButton } = jest.requireActual('src/design-system');
    return (
      <>
        <UbTextInput
          aria-label="Counter"
          value={props.query}
          onFocus={props.onOpen}
          onChange={(value: string) => props.onQueryChange(value)}
        />
        {props.options.map((row) => (
          <UbButton aria-label={row.label} key={row.value} onClick={() => props.onSelect(row)}>
            {row.label}
            {row.detail}
          </UbButton>
        ))}
      </>
    );
  },
}));

beforeEach(() => push.mockClear());
it('opens a reviewed Shop payment for a name and amount, preserving separate dual-role actions', async () => {
  const onPayment = jest.fn();
  renderWithProviders(<CounterSearch onPayment={onPayment} />);
  fireEvent.change(screen.getByLabelText('Counter'), { target: { value: 'Radhe 2000' } });
  const receive = await screen.findByRole('button', {
    name: 'Receive ₹2,000.00 from Radhe Krishna Enterprises',
  });
  expect(
    screen.getByRole('button', { name: 'Pay ₹2,000.00 to Radhe Krishna Enterprises' })
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
  fireEvent.change(screen.getByLabelText('Counter'), { target: { value: 'LED' } });
  fireEvent.click(await screen.findByRole('button', { name: 'New bill with LED driver' }));
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
  fireEvent.focus(screen.getByLabelText('Counter'));
  fireEvent.change(screen.getByLabelText('Counter'), { target: { value: '26/1' } });
  fireEvent.click(await screen.findByRole('button', { name: 'Open PB/26/1' }));
  expect(push).toHaveBeenCalledWith('/purchases/bills/b1');
  expect(sales.listInvoices).toHaveBeenCalledWith(
    expect.objectContaining({ book: 'shop', q: '26/1' }),
    expect.anything()
  );
});

/** D-L2: command identity must show the same grouped mobile as the party list. */
it('keeps a grouped mobile beside the contact role', async () => {
  renderWithProviders(<CounterSearch onPayment={jest.fn()} />);
  expect(await screen.findByText(/Customer · Shop book · \+91 98765 43210/)).toBeInTheDocument();
});

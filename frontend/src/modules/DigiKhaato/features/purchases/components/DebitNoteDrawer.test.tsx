import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from 'src/tests/renderWithProviders';

import { toBill } from '../api/purchaseBillService';

import { DebitNoteDrawer } from './DebitNoteDrawer';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/purchases/bills/b',
  useSearchParams: () => new URLSearchParams(),
}));

it('does not silently omit an invalid return quantity while issuing the other selected line', async () => {
  // Defect: preserving typed negative quantities must never turn a mixed invalid return into a partial issue.
  const bill = toBill({
    id: 'b',
    kind: 'purchase_bill',
    status: 'recorded',
    number: 'PB/1',
    party: { id: 'p', name: 'Radhe Krishna Electrical Supplies' },
    links: { returned: {} },
    lines: [
      {
        line_no: 1,
        description: 'LED driver',
        qty: '2.000',
        unit_code: 'NOS',
        unit_cost: '42.0000',
      },
      {
        line_no: 2,
        description: 'Copper cable roll',
        qty: '2.000',
        unit_code: 'NOS',
        unit_cost: '90.0000',
      },
    ],
  });
  renderWithProviders(<DebitNoteDrawer bill={bill} onClose={jest.fn()} />);
  await userEvent.click(screen.getByRole('combobox', { name: 'Reason' }));
  await userEvent.click(await screen.findByRole('option', { name: 'Goods returned' }));
  await userEvent.type(screen.getByLabelText('Quantity of LED driver to return'), '-1');
  await userEvent.type(screen.getByLabelText('Quantity of Copper cable roll to return'), '1');
  expect(screen.getByTestId('debit-note-issue')).toBeDisabled();
  expect(screen.getByLabelText('Quantity of LED driver to return')).toHaveAttribute(
    'aria-invalid',
    'true'
  );
});

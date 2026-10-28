import { render, screen } from '@testing-library/react';

import { InvoiceCustomerBox } from './InvoiceCustomerBox';

const t = ((id: string, values?: Record<string, unknown>) =>
  id === 'sales.editor.box.noMobile'
    ? 'No mobile number'
    : id === 'sales.editor.box.toCollect'
      ? `${String(values?.amount)} to collect`
      : id) as never;

it('says "No mobile number" rather than leaving the slot empty', () => {
  /**
   * The defect it prevents (A7 regression, 28 Oct): a contact with no number
   * left line 2's first slot empty once the reply landed, so on a desktop the
   * line stopped wrapping and the box shrank 20 px under the merchant's eye,
   * while the loading bars had held three lines. The words keep the shape and
   * say why there is nothing to call.
   */
  render(<InvoiceCustomerBox name="Gupta Kirana" mobile={null} balance="1500.00" onChange={() => {}} disabled={false} t={t} />);
  expect(screen.getByText('No mobile number')).toBeInTheDocument();
  expect(screen.getByText('₹1,500.00 to collect')).toBeInTheDocument();
});

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';

import { UbForm } from 'src/design-system';
import { renderWithProviders } from 'src/tests/renderWithProviders';

import { emptyInvoiceForm, emptyLine, type InvoiceFormValues } from '../view-model/invoiceForm';

import { InvoiceLinesSection } from './InvoiceLinesSection';

import type { EngineResult } from '../view-model/taxEngine';

jest.mock('../../inventory/api/itemService');
jest.mock('../../inventory/api/priceListService');
jest.setTimeout(20000);

const named = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    ...emptyLine(),
    itemId: `item-${i + 1}`,
    description: i === 8 ? 'Syska bulb 9W' : `Wire roll ${i + 1}`,
    qty: String(i + 1),
    unitCode: 'PCS',
    unitPrice: '10.00',
  }));

function Lines({ count }: Readonly<{ count: number }>) {
  const form = useForm<InvoiceFormValues>({
    defaultValues: { ...emptyInvoiceForm('2026-10-20', 'walkIn', '27'), lines: named(count) },
  });
  return (
    <UbForm form={form} onSubmit={jest.fn()}>
      <InvoiceLinesSection
        form={form}
        preview={{ lines: [] } as unknown as EngineResult}
        rateOptions={[]}
        taxFree={false}
        disabled={false}
        onSubmitShortcut={jest.fn()}
      />
    </UbForm>
  );
}

/**
 * A busy counter's long bill: forty lines are forty cards on a phone, and
 * changing the quantity of one meant scrolling past the rest to find it.
 */
describe('finding a line on a long bill', () => {
  it('is not offered while the whole bill fits on a screen', () => {
    /* Prevents: a second search box above every three-line bill. */
    renderWithProviders(<Lines count={3} />);
    expect(screen.queryByTestId('invoice-line-finder')).not.toBeInTheDocument();
  });

  it('puts the caret in the Qty of the line that was chosen', async () => {
    /* Prevents: a finder that lists the line and leaves the merchant scrolling. */
    const user = userEvent.setup();
    renderWithProviders(<Lines count={12} />);
    await user.click(await screen.findByRole('combobox', { name: 'Find a line on this bill' }));
    await user.keyboard('syska');
    await user.click(await screen.findByRole('option', { name: /Syska bulb 9W/ }));
    const cell = document.activeElement?.closest('[data-line-cell]');
    expect(cell).toHaveAttribute('data-row', '8');
    expect(cell).toHaveAttribute('data-col', '1');
  });

  it('names each line with its number and quantity, so two of one item are told apart', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Lines count={12} />);
    await user.click(await screen.findByRole('combobox', { name: 'Find a line on this bill' }));
    expect(
      await screen.findByRole('option', { name: 'Line 9 · Syska bulb 9W · 9 PCS' })
    ).toBeVisible();
  });
});

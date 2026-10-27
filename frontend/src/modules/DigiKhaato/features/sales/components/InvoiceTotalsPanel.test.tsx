import { screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';

import { UbForm } from 'src/design-system';
import { renderWithProviders } from 'src/tests/renderWithProviders';

import { computeDocumentTotals } from '../view-model/taxEngine';

import { InvoiceTotalsPanel } from './InvoiceTotalsPanel';

import type { InvoiceFormValues } from '../view-model/invoiceForm';

const preview = {
  ...computeDocumentTotals({
    lines: [],
    gstType: 'regular',
    tenantState: '27',
    placeOfSupply: '27',
    roundOffEnabled: true,
    discountType: null,
    discountValue: null,
  }),
  roundOff: '-0.47',
};

function Harness() {
  const form = useForm<InvoiceFormValues>({
    defaultValues: { discountType: '', roundOffEnabled: true, placeOfSupplyState: '27' },
  });
  return (
    <UbForm form={form} onSubmit={() => undefined}>
      <InvoiceTotalsPanel form={form} preview={preview} taxFree={false} rule46={null} warnings={[]} />
    </UbForm>
  );
}

/** Prevents "-₹0.47" (Intl's hyphen) under a discount row that reads "— ₹x" (A4 dark/Hindi look). */
it('shows a rounding down the way it shows a discount', () => {
  renderWithProviders(<Harness />);
  expect(screen.getByText('— ₹0.47')).toBeVisible();
  expect(screen.queryByText('-₹0.47')).toBeNull();
});

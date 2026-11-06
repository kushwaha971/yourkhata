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
      <InvoiceTotalsPanel
        form={form}
        preview={preview}
        taxFree={false}
        rule46={null}
        warnings={[]}
      />
    </UbForm>
  );
}

/** Prevents "-₹0.47" (Intl's hyphen) under a discount row that reads "— ₹x" (A4 dark/Hindi look). */
it('shows a rounding down the way it shows a discount', () => {
  renderWithProviders(<Harness />);
  expect(screen.getByText('— ₹0.47')).toBeVisible();
  expect(screen.queryByText('-₹0.47')).toBeNull();
});

/** Design §A4 dBill: the desktop totals card always has its Discount row, "— ₹0.00" when there is none. */
it('shows Discount at zero on the desktop card, and not on the phone', () => {
  function Desk({ always }: Readonly<{ always: boolean }>) {
    const form = useForm<InvoiceFormValues>({
      defaultValues: { discountType: '', roundOffEnabled: true, placeOfSupplyState: '27' },
    });
    return (
      <UbForm form={form} onSubmit={() => undefined}>
        <InvoiceTotalsPanel
          form={form}
          preview={{ ...preview, discountAmount: '0.00' }}
          taxFree={false}
          rule46={null}
          warnings={[]}
          alwaysDiscount={always}
        />
      </UbForm>
    );
  }
  const { rerender } = renderWithProviders(<Desk always />);
  expect(screen.getByText('— ₹0.00')).toBeInTheDocument();
  rerender(<Desk always={false} />);
  expect(screen.queryByText('— ₹0.00')).toBeNull();
});

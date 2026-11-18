import { screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';

import { UbForm } from 'src/design-system';
import { renderWithProviders } from 'src/tests/renderWithProviders';

import { JewelLineFields } from './JewelLineFields';

import type { JewelLine } from '../../inventory/api/tagService';
import type { InvoiceFormValues } from '../view-model/invoiceForm';

const CHAIN: JewelLine = {
  tag_no: 'GC-1042',
  purity: 'gold_22k',
  gross_g: '12.900',
  stone_g: '0.560',
  net_g: '12.340',
  rate: '11650.00',
  making_type: 'pct',
  making_value: '12.00',
  wastage_pct: '0.00',
  stone_charge: '0.00',
  huid: '7K2P9X',
};
const TAX = [
  { value: 'GST0', label: 'GST 0%' },
  { value: 'GST3', label: 'GST 3%' },
];

function Harness({ taxFree }: Readonly<{ taxFree: boolean }>) {
  const form = useForm<InvoiceFormValues>({
    defaultValues: { lines: [{ jewel: CHAIN, taxCode: 'GST0', unitPrice: '161012.32' }] } as never,
  });
  return (
    <UbForm form={form} onSubmit={() => undefined}>
      <JewelLineFields
        form={form}
        index={0}
        jewel={CHAIN}
        taxOptions={TAX}
        taxFree={taxFree}
        disabled={false}
        t={(id) => id}
      />
    </UbForm>
  );
}

/** Owner, 2 Nov 2026: GST is the business's choice on every line, 0% included —
 *  the tag line's sheet once hid the picker and printed "GST 3%" as a fact. */
it('lets a GST business choose the rate on a tag line, 0% included', () => {
  renderWithProviders(<Harness taxFree={false} />);
  expect(screen.getByLabelText('sales.line.gst')).toBeInTheDocument();
  expect(screen.getAllByText('GST 0%').length).toBeGreaterThan(0);
});

it('shows no picker for a business that charges no GST, as every other line', () => {
  renderWithProviders(<Harness taxFree />);
  expect(screen.queryByLabelText('sales.line.gst')).not.toBeInTheDocument();
});

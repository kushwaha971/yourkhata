import { useEffect } from 'react';

import { act, screen, waitFor } from '@testing-library/react';
import { useForm, useWatch, type UseFormReturn } from 'react-hook-form';

import { UbForm, UbText } from 'src/design-system';
import { renderWithProviders } from 'src/tests/renderWithProviders';

import { getParty } from '../../parties/api/partyService';
import { emptyInvoiceForm, type InvoiceFormValues } from '../view-model/invoiceForm';

import { InvoicePartySection } from './InvoicePartySection';

jest.mock('../../parties/api/partyService');
const get = jest.mocked(getParty);
const holder: { form?: UseFormReturn<InvoiceFormValues> } = {};
function SeededForm() {
  const form = useForm<InvoiceFormValues>({ defaultValues: {
    ...emptyInvoiceForm('2026-10-18', 'party', ''), partyId: 'p1', partyName: 'Customer in Karnataka',
  } });
  useEffect(() => { holder.form = form; return () => { holder.form = undefined; }; }, [form]);
  const pos = useWatch({ control: form.control, name: 'placeOfSupplyState' });
  return <UbForm form={form} onSubmit={jest.fn()}>
    <InvoicePartySection form={form} today="2026-10-18" tenantState="27" locale="en" disabled={false} />
    <UbText data-testid="pos-result">{pos}</UbText>
  </UbForm>;
}
const contact = { party: { stateCode: '29', billingAddress: {} } } as Awaited<ReturnType<typeof getParty>>;

/** A preselected interstate customer must use the same GST default as a picker selection. */
it('resolves the selected customer state instead of quietly keeping the shop state', async () => {
  get.mockResolvedValue(contact);
  renderWithProviders(<SeededForm />);
  await waitFor(()=>expect(screen.getByTestId('pos-result')).toHaveTextContent('29'));
  expect(get).toHaveBeenCalledWith('p1', expect.anything());
});

/** A late contact lookup must not replace the merchant's invoice-specific adjustment. */
it('preserves a manual place-of-supply override while the contact lookup is pending', async () => {
  let resolve: (value: Awaited<ReturnType<typeof getParty>>) => void = () => undefined;
  get.mockReturnValue(new Promise(done=>{resolve=done;}));
  renderWithProviders(<SeededForm />);
  await act(async()=>{holder.form?.setValue('placeOfSupplyState','33');resolve(contact);});
  expect(screen.getByTestId('pos-result')).toHaveTextContent('33');
});

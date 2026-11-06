import { useEffect } from 'react';

import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm, useWatch, type UseFormReturn } from 'react-hook-form';

import { UbForm, UbText } from 'src/design-system';
import { sessionLoaded } from 'src/redux/slice/sessionSlice';
import { store } from 'src/redux/store';
import { renderWithProviders } from 'src/tests/renderWithProviders';

import { getParty } from '../../parties/api/partyService';
import { emptyInvoiceForm, type InvoiceFormValues } from '../view-model/invoiceForm';

import { InvoicePartySection } from './InvoicePartySection';

jest.mock('../../parties/api/partyService');
const get = jest.mocked(getParty);
const holder: { form?: UseFormReturn<InvoiceFormValues> } = {};
function SeededForm() {
  const form = useForm<InvoiceFormValues>({
    defaultValues: {
      ...emptyInvoiceForm('2026-10-18', 'party', ''),
      partyId: 'p1',
      partyName: 'Customer in Karnataka',
    },
  });
  useEffect(() => {
    holder.form = form;
    return () => {
      holder.form = undefined;
    };
  }, [form]);
  const pos = useWatch({ control: form.control, name: 'placeOfSupplyState' });
  return (
    <UbForm form={form} onSubmit={jest.fn()}>
      <InvoicePartySection
        form={form}
        today="2026-10-18"
        tenantState="27"
        locale="en"
        disabled={false}
      />
      <UbText data-testid="pos-result">{pos}</UbText>
    </UbForm>
  );
}
const contact = {
  party: { stateCode: '29', billingAddress: {} },
  summary: { balance: '0.00' },
  credit: null,
} as Awaited<ReturnType<typeof getParty>>;

/** A preselected interstate customer must use the same GST default as a picker selection. */
it('resolves the selected customer state instead of quietly keeping the shop state', async () => {
  get.mockResolvedValue(contact);
  renderWithProviders(<SeededForm />);
  await waitFor(() => expect(screen.getByTestId('pos-result')).toHaveTextContent('29'));
  // One read, from the Shop book (DEC-019): it also feeds the customer's dues line.
  expect(get).toHaveBeenCalledWith('p1', expect.anything(), 'shop');
});

/** A late contact lookup must not replace the merchant's invoice-specific adjustment. */
it('preserves a manual place-of-supply override while the contact lookup is pending', async () => {
  let resolve: (value: Awaited<ReturnType<typeof getParty>>) => void = () => undefined;
  get.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    })
  );
  renderWithProviders(<SeededForm />);
  await act(async () => {
    holder.form?.setValue('placeOfSupplyState', '33');
    resolve(contact);
  });
  expect(screen.getByTestId('pos-result')).toHaveTextContent('33');
});

const withShop = (shop: { customerBalance: string } | undefined, main: string) =>
  ({
    party: {
      stateCode: '27',
      billingAddress: {},
      mobile: '+919876543210',
      ...(shop ? { shop } : {}),
    },
    summary: { balance: main },
    credit: null,
  }) as unknown as Awaited<ReturnType<typeof getParty>>;

/**
 * A3 — the box printed the party's MAIN (Udhaar) balance on a Shop bill:
 * `summary.balance` is `party.balance` whatever `?book=shop` says, so a
 * customer the Shop owes nothing read "Advance in Shop ₹27,983.54". The box
 * shows the Shop figure, `party.shop.customerBalance`.
 */
it('shows the Shop balance, never the main book balance', async () => {
  get.mockResolvedValue(withShop({ customerBalance: '0.00' }, '-27983.54'));
  renderWithProviders(<SeededForm />);
  const box = await screen.findByTestId('invoice-customer-line');
  await waitFor(() => expect(box).toHaveTextContent('Nothing due'));
  expect(box).not.toHaveTextContent('27,983.54');
});

/** A3 — line 2 is the mobile and the Shop figure in words and money colour. */
it('reads to collect in green and you owe in red, with the mobile beside it', async () => {
  get.mockResolvedValue(withShop({ customerBalance: '1240.00' }, '0.00'));
  const { unmount } = renderWithProviders(<SeededForm />);
  const owes = await screen.findByText('₹1,240.00 to collect');
  expect(owes.className).toContain('text-get');
  expect(screen.getByText('+91 98765 43210')).toBeInTheDocument();
  unmount();
  get.mockResolvedValue(withShop({ customerBalance: '-600.00' }, '0.00'));
  renderWithProviders(<SeededForm />);
  expect((await screen.findByText('₹600.00 to pay')).className).toContain('text-give');
});

/**
 * A3 — the box no longer repeats "Saved customer" (the switch above says it),
 * and Quick sale / Saved customer are one two-part switch, not two chips.
 */
it('drops the caption and offers one two-part switch', async () => {
  get.mockResolvedValue(withShop(undefined, '0.00'));
  renderWithProviders(<SeededForm />);
  const box = await screen.findByTestId('invoice-customer-line');
  expect(box).not.toHaveTextContent('Saved customer');
  const group = screen.getByRole('group', { name: 'Bill to' });
  expect(group).toContainElement(screen.getByRole('button', { name: 'Quick sale' }));
  expect(screen.getByRole('button', { name: 'Saved customer' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await waitFor(() => expect(box).toHaveTextContent('Nothing due'));
});

function WalkInForm() {
  const form = useForm<InvoiceFormValues>({
    defaultValues: emptyInvoiceForm('2026-10-18', 'walkIn', '27'),
  });
  return (
    <UbForm form={form} onSubmit={jest.fn()}>
      <InvoicePartySection
        form={form}
        today="2026-10-18"
        tenantState="27"
        locale="en"
        disabled={false}
      />
    </UbForm>
  );
}

/**
 * A3 manual pass, by hand at 390 px: tapping Saved customer left focus on the
 * switch, so the name typed next went nowhere and the field stayed empty — tap,
 * type, lost, at a counter. The picker takes focus when the switch moves to it.
 */
it('focuses the customer picker when the switch moves to Saved customer', async () => {
  store.dispatch(
    sessionLoaded({
      user: {
        id: 'u1',
        name: 'Owner',
        email: 'o@shop.test',
        mobile: null,
        locale: 'en',
        mustChangePassword: false,
        passwordExpiresAt: null,
      },
      activeTenant: { id: 't1', name: 'Shop', timezone: 'Asia/Kolkata' },
      tenants: [{ id: 't1', name: 'Shop', timezone: 'Asia/Kolkata' }],
      permissions: ['parties.party.read'],
      enabledModules: ['parties', 'sales'],
      version: 1,
    } as Parameters<typeof sessionLoaded>[0])
  );
  renderWithProviders(<WalkInForm />);
  await userEvent.click(screen.getByRole('button', { name: 'Saved customer' }));
  const picker = screen.getByTestId('invoice-party-picker').querySelector('input');
  await waitFor(() => expect(picker).toHaveFocus());
});

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { TranslateFn } from 'src/hooks/useTranslation';
import { renderWithProviders } from 'src/tests/renderWithProviders';

import { ShopPartyRowActions } from './PartyListRow';

import type { Party } from '../types/party.types';

const t = ((key: string) => key) as TranslateFn;
const person: Party = {
  id: '1',
  name: 'Ramesh',
  displayCode: null,
  mobile: '+919812345678',
  isCustomer: true,
  isSupplier: true,
  balance: '1000.00',
  status: 'active',
  lastActivityAt: null,
  tags: [],
  shop: {
    customerBalance: '1000',
    customerDue: '1000',
    customerCredit: '0',
    supplierBalance: '600',
    supplierDue: '600',
    supplierCredit: '0',
    oldestDueOn: null,
    daysOverdue: 42,
    lastActivityAt: null,
    lastActivityKind: null,
  },
};

/** BP-09: only a permitted, active customer with positive Shop dues has Remind. */
it('opens the editable Shop reminder for the actual selected customer', async () => {
  const remind = jest.fn(),
    open = jest.fn();
  renderWithProviders(<ShopPartyRowActions party={person} t={t} onOpen={open} onRemind={remind} />);
  await userEvent.click(screen.getByRole('button', { name: /shop.remind/ }));
  expect(remind).toHaveBeenCalledWith(person);
  expect(open).not.toHaveBeenCalled();
});

/** Missing permission, recipient, context or dues must not offer an unusable send. */
it.each(['permission', 'phone', 'archived', 'settled', 'advance', 'book'])(
  'keeps the person link without Remind when %s is missing',
  (reason) => {
    const row = {
      ...person,
      mobile: reason === 'phone' ? null : person.mobile,
      status: reason === 'archived' ? ('archived' as const) : ('active' as const),
      balance: reason === 'settled' ? '0' : reason === 'advance' ? '-1' : '1000',
      shop: reason === 'book' ? undefined : person.shop,
    };
    renderWithProviders(
      <ShopPartyRowActions
        party={row}
        t={t}
        onOpen={jest.fn()}
        onRemind={reason === 'permission' ? undefined : jest.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: /shop.remind/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /viewBills/ })).toBeInTheDocument();
  }
);

it('pays only the supplier amount and never offers a customer reminder', async () => {
  /** Supplier register: a dual-role contact must open the outgoing payment action. */
  const pay = jest.fn(),
    remind = jest.fn(),
    row = { ...person, balance: '-600.00' };
  renderWithProviders(
    <ShopPartyRowActions party={row} supplier t={t} onPay={pay} onRemind={remind} />
  );
  await userEvent.click(screen.getByRole('button', { name: /supplier.pay/ }));
  expect(pay).toHaveBeenCalledWith(row);
  expect(remind).not.toHaveBeenCalled();
});

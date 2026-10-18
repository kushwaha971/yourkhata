import { screen } from '@testing-library/react';

import type { TranslateFn } from 'src/hooks/useTranslation';
import { renderWithProviders } from 'src/tests/renderWithProviders';

import { ShopPersonActions } from './ShopPersonActions';

const t = ((key: string) => key) as TranslateFn;
const props = { t, id: 'p1', name: 'Ramesh & Sons', kind: 'customer' as const,
  canPay: true, canSell: true, canPurchase: true, receive: jest.fn(), pay: jest.fn() };

/** Role-specific links must carry the person into the existing editor, without another picker. */
it.each([['customer', '/sales/invoices/new'], ['supplier', '/purchases/bills/new']] as const)(
  'opens the correct new bill in the %s book', (kind, path) => {
    renderWithProviders(<ShopPersonActions {...props} kind={kind} />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe(`${path}?party=p1&partyName=Ramesh%20%26%20Sons`);
  });

/** Denied payment rights cannot leave a money-write control in either rendering. */
it('keeps only permitted billing when the viewer cannot record payments', () => {
  renderWithProviders(<ShopPersonActions {...props} canPay={false} />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.getByRole('link')).toBeInTheDocument();
});

/** Sharing a person must never combine the two roles' actions. */
it('shows only supplier actions in the supplier view', () => {
  renderWithProviders(<ShopPersonActions {...props} kind="supplier" />);
  expect(screen.queryByRole('button', { name: /receiveAction/ })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /payAction/ })).toBeInTheDocument();
  expect(screen.getByRole('link')).toHaveAttribute('href', '/purchases/bills/new?party=p1&partyName=Ramesh%20%26%20Sons');
});

/** A dynamic payment form must acknowledge the tap before its chunk arrives. */
it('shows pending feedback and locks the payment opener while its form is open', () => {
  renderWithProviders(<ShopPersonActions {...props} opening />);
  expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  expect(screen.getByRole('button')).toBeDisabled();
});

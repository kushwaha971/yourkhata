import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useTranslation } from 'src/hooks/useTranslation';
import { renderWithProviders } from 'src/tests/renderWithProviders';

import { HomePromises } from './HomePromises';

import type { ShopPromise } from '../../parties/types/shopPromise.types';

/**
 * BP-16 — Home's promises. What these protect: the row says the figure
 * PROMISED in the title and the balance owed NOW in the caption (never one for
 * the other); somebody who has since paid in full is not offered Remind; a
 * supplier promise is the shop's own and offers Pay; and no promise due means
 * no panel at all.
 */
const ROW = (over: Partial<ShopPromise> = {}): ShopPromise => ({
  id: 'p1',
  party: { id: 'party-1', name: 'Sharma General Store', mobile: '9812345678' },
  role: 'customer',
  promisedOn: '2026-10-24',
  amount: '1500.00',
  note: 'internal',
  state: 'open',
  daysLate: 0,
  version: 1,
  createdAt: '2026-10-20T10:00:00Z',
  createdBy: null,
  closedAt: null,
  closedBy: null,
  balance: '3100.00',
  daysOverdue: 42,
  ...over,
});

const show = (rows: readonly ShopPromise[], handlers = { onRemind: jest.fn(), onPay: jest.fn() }) => {
  renderWithProviders(
    <HomePromises
      state={{ status: 'ready', rows }}
      today="2026-10-24"
      formatDate={(iso) => iso}
      canRemind
      canPay
      onRetry={jest.fn()}
      t={(id, values) => `${id}${values ? JSON.stringify(values) : ''}`}
      {...handlers}
    />
  );
  return handlers;
};

function InEnglish({ rows }: Readonly<{ rows: readonly ShopPromise[] }>): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <HomePromises
      state={{ status: 'ready', rows }}
      today="2026-10-24"
      formatDate={(iso) => iso}
      canRemind
      canPay
      onRemind={jest.fn()}
      onPay={jest.fn()}
      onRetry={jest.fn()}
      t={t}
    />
  );
}

it('titles the row by the promise and captions it by what is owed now', () => {
  renderWithProviders(<InEnglish rows={[ROW()]} />);
  expect(screen.getByRole('link', { name: 'Sharma General Store promised ₹1,500.00 today' })).toBeInTheDocument();
  expect(screen.getByText('Owes ₹3,100.00 · 42 days late')).toBeInTheDocument();
  expect(screen.queryByText(/internal/)).toBeNull();
});

it('says a late promise in the caption', () => {
  renderWithProviders(<InEnglish rows={[ROW({ promisedOn: '2026-10-22', daysLate: 2 })]} />);
  expect(screen.getByText('Owes ₹3,100.00 · 42 days late · Promise 2 days late')).toBeInTheDocument();
});

it('offers no Remind to somebody who has paid since', () => {
  show([ROW({ balance: '0.00' })]);
  expect(screen.getByText('homePromise.nothingDue')).toBeInTheDocument();
  expect(screen.queryByTestId('home-promise-act')).toBeNull();
});

it("a supplier promise is the shop's own and offers Pay", async () => {
  const handlers = show([ROW({ role: 'supplier', daysLate: 2, daysOverdue: null })]);
  expect(screen.getByText(/homePromise\.supplier\.amountToday/)).toBeInTheDocument();
  expect(screen.getByText(/homePromise\.youOwe.*homePromise\.late/)).toBeInTheDocument();
  await userEvent.click(screen.getByTestId('home-promise-act'));
  expect(handlers.onPay).toHaveBeenCalledWith(expect.objectContaining({ role: 'supplier' }));
});

it('draws nothing when no promise is due', () => {
  show([]);
  expect(screen.queryByTestId('home-promises')).toBeNull();
});

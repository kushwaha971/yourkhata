import type { TranslateFn } from 'src/hooks/useTranslation';

import { shopAgeView } from './shopPartyDisplay';

import type { Party } from '../types/party.types';

const t = ((key: string, values?: { count?: number }) =>
  `${key}:${values?.count ?? ''}`) as TranslateFn;
const party = (balance: string, daysOverdue: number | null): Party => ({
  id: '1',
  name: 'Dual role',
  displayCode: null,
  mobile: null,
  isCustomer: true,
  isSupplier: true,
  balance,
  status: 'active',
  lastActivityAt: null,
  tags: [],
  shop: {
    customerBalance: balance,
    customerDue: balance,
    customerCredit: '0',
    supplierBalance: '600',
    supplierDue: '600',
    supplierCredit: '0',
    oldestDueOn: null,
    daysOverdue,
    lastActivityAt: null,
    lastActivityKind: null,
  },
});

/** BP-09: lateness is the server business-date result, never the browser clock. */
it.each([
  [0, 'neutral', 'notDue'],
  [30, 'warning', 'daysLate'],
  [31, 'error', 'daysLate'],
] as const)('renders server age %s at the exact severity boundary', (days, tone, key) => {
  expect(shopAgeView(party('1000.00', days), t)).toEqual({
    tone,
    label: `parties.list.shop.${key}:${days === 0 ? '' : days}`,
  });
});

/** A stale bill date must not call a settled or prepaid customer late. */
it('gives zero and customer credit precedence over old invoice dates', () => {
  expect(shopAgeView(party('0.00', 42), t).label).toContain('settled');
  expect(shopAgeView(party('-0.01', 42), t).label).toContain('credit');
  expect(shopAgeView(party('0.01', null), t).label).toContain('noDueDate');
});

it('interprets a negative supplier list amount as money to pay rather than an advance', () => {
  /** Supplier sign convention must not label an overdue purchase as prepaid. */
  expect(shopAgeView(party('-600.00', 42), t, true).label).toContain('daysLate');
  expect(shopAgeView(party('200.00', 42), t, true).label).toContain('supplier.advance');
});

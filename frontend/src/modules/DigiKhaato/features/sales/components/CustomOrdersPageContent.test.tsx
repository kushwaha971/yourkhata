import { screen } from '@testing-library/react';

import { renderWithProviders } from 'src/tests/renderWithProviders';
import { addDaysIso } from 'src/utils/calendarDays';
import { todayInTenantTz } from 'src/utils/dates';

import * as orders from '../api/customOrderService';
import * as karigars from '../api/karigarService';

import { CustomOrdersPageContent } from './CustomOrdersPageContent';

jest.mock('../api/customOrderService');
jest.mock('../api/karigarService');

const order = (o: Partial<orders.CustomOrder>): orders.CustomOrder => ({
  id: 'o1',
  number: 'ORD-0001',
  party: { id: 'p', name: 'Meena', mobile: null },
  what: 'Ring',
  approxWeightG: null,
  purity: 'gold_22k',
  deliverOn: addDaysIso(todayInTenantTz(), 5),
  advance: '0.00',
  advancePaymentId: null,
  fixedRate: null,
  status: 'open',
  invoiceId: null,
  withKarigar: null,
  ...o,
});

const show = (rows: orders.CustomOrder[]) => {
  jest
    .mocked(orders.listCustomOrders)
    .mockResolvedValue({ rows, open: rows.length, advanceHeld: '0.00' });
  jest
    .mocked(karigars.listKarigars)
    .mockResolvedValue({ rows: [], open_lots: [], to_tag: [], gold_with_karigars: '0.000' });
  renderWithProviders(<CustomOrdersPageContent />);
};

/** A past date cannot be typed live, so "late" can only be proved here. */
it('says how many days late an order is', async () => {
  show([order({ deliverOn: addDaysIso(todayInTenantTz(), -2) })]);
  expect((await screen.findAllByText('2 days late')).length).toBeGreaterThan(0);
});

it('offers no action on a finished order', async () => {
  show([order({ status: 'delivered' })]);
  expect((await screen.findAllByText('Delivered')).length).toBeGreaterThan(0);
  expect(screen.queryByText('Make bill')).not.toBeInTheDocument();
  expect(screen.queryByText('Mark ready')).not.toBeInTheDocument();
});

import { billHref, linesSummary } from './cafeOrderService';

import type { CafeOrder } from './cafeOrderService';

const order = (party: CafeOrder['party']): CafeOrder => ({
  id: 'o1',
  kind: 'advance',
  number: 'ADV-0001',
  party,
  lines: [],
  total: '0.00',
  status: 'preparing',
  readyAt: null,
  fulfil: 'pickup',
  advance: '0.00',
  balance: '0.00',
  invoiceId: null,
  createdAt: '2026-11-10T00:00:00Z',
});

it('says one of a thing by its name and more with × count (design "Cold coffee × 2, sandwich")', () => {
  const line = (name: string, qty: string) => ({ item_id: name, name, qty, rate: '1.00', note: '' });
  expect(linesSummary([line('Cold coffee', '2'), line('Sandwich', '1')])).toBe('Cold coffee × 2, Sandwich');
});

it('opens the bill for the order, with its customer when it has one', () => {
  /** Without the customer an advance bill is a quick sale, which the server refuses to settle it. */
  expect(billHref('/sales/invoices', order({ id: 'p1', name: 'Sunita Yadav', mobile: null }))).toBe(
    '/sales/invoices/new?cafe_order=o1&party=p1&partyName=Sunita+Yadav'
  );
  expect(billHref('/sales/invoices', order(null))).toBe('/sales/invoices/new?cafe_order=o1');
});

it('names a phone order’s items in full, not by a brand word (G11)', async () => {
  const { itemsSummary } = await import('./phoneOrderService');
  const line = (name: string) => ({ item_id: name, name, qty: '1', rate: '1.00' });
  expect(
    itemsSummary([line('Aashirvaad Atta'), line('Fortune Oil'), line('Toor Dal'), line('Salt')], (n) => `${n} items`)
  ).toBe('4 items · aashirvaad atta, fortune oil, toor dal…');
});

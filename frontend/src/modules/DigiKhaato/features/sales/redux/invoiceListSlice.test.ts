import { invoiceFiltersChanged, invoiceListReducer } from './invoiceListSlice';
import { fetchInvoices, type InvoiceListArg } from './salesThunk';

import type { InvoiceListRow } from '../types/sales.types';

const query: InvoiceListArg = {
  tab: 'all',
  dateFrom: '2026-10-01',
  dateTo: '2026-10-31',
  partyId: null,
  q: '',
  page: 1,
  originModule: null,
};
const page = (total: string, rows: InvoiceListRow[] = [], pageNo = 1) => ({
  rows,
  totals: { count: 26, grandTotal: total, amountDue: '0.00' },
  tabs: { all: 26, unpaid: 0, overdue: 0, paid: 26, draft: 0, void: 0 },
  hasAny: true,
  page: pageNo,
  pageSize: 25,
  total: 26,
});
const row = (id: string) => ({ id }) as InvoiceListRow;

it('keeps phone cards and totals through the next-page request and deduplicates overlap', () => {
  /** R-DEC-33: page two replaced page one, so a phone lost the cards it had scrolled past. */
  const first = { ...query, mode: 'append' as const };
  let state = invoiceListReducer(undefined, invoiceFiltersChanged(first));
  state = invoiceListReducer(state, fetchInvoices.pending('one', first));
  state = invoiceListReducer(
    state,
    fetchInvoices.fulfilled(page('500.00', [row('one')]), 'one', first)
  );
  const next = { ...first, page: 2 };
  state = invoiceListReducer(state, invoiceFiltersChanged(next));
  expect(state.rows).toHaveLength(1);
  expect(state.totals?.grandTotal).toBe('500.00');
  state = invoiceListReducer(state, fetchInvoices.pending('two', next));
  expect(state.status).toBe('refreshing');
  state = invoiceListReducer(
    state,
    fetchInvoices.fulfilled(page('500.00', [row('one'), row('two')], 2), 'two', next)
  );
  expect(state.rows.map((r) => r.id)).toEqual(['one', 'two']);
});

it('replaces the page on a desktop, where page two is its own page', () => {
  /** The table pages by replacement; appending there would grow it without end. */
  let state = invoiceListReducer(undefined, invoiceFiltersChanged(query));
  state = invoiceListReducer(state, fetchInvoices.pending('one', query));
  state = invoiceListReducer(
    state,
    fetchInvoices.fulfilled(page('500.00', [row('one')]), 'one', query)
  );
  const next = { ...query, page: 2 };
  state = invoiceListReducer(state, invoiceFiltersChanged(next));
  expect(state.rows).toHaveLength(0);
  state = invoiceListReducer(state, fetchInvoices.pending('two', next));
  state = invoiceListReducer(
    state,
    fetchInvoices.fulfilled(page('500.00', [row('two')], 2), 'two', next)
  );
  expect(state.rows.map((r) => r.id)).toEqual(['two']);
});

it('starts again from nothing when the search or the origin changes', () => {
  /** A new question must not keep cards (or a total) that answered the old one. */
  const first = { ...query, mode: 'append' as const };
  let state = invoiceListReducer(undefined, invoiceFiltersChanged(first));
  state = invoiceListReducer(state, fetchInvoices.pending('one', first));
  state = invoiceListReducer(
    state,
    fetchInvoices.fulfilled(page('500.00', [row('one')]), 'one', first)
  );
  state = invoiceListReducer(state, invoiceFiltersChanged({ ...first, originModule: 'library' }));
  expect(state.rows).toHaveLength(0);
  expect(state.totals).toBeNull();
});

it('does not let an older reply overwrite a newer one for the same filters', () => {
  /** Defect: only filters were compared, so a slow earlier refresh could replace the latest. */
  let state = invoiceListReducer(undefined, invoiceFiltersChanged(query));
  state = invoiceListReducer(state, fetchInvoices.pending('old', query));
  state = invoiceListReducer(state, fetchInvoices.pending('new', query));
  state = invoiceListReducer(state, fetchInvoices.fulfilled(page('500.00'), 'new', query));
  state = invoiceListReducer(state, fetchInvoices.fulfilled(page('100.00'), 'old', query));
  expect(state.totals?.grandTotal).toBe('500.00');
});

it('keeps the cards when the next page fails, so the merchant can retry', () => {
  /** R-DEC-33: a failed append must not erase what is already on the screen. */
  const first = { ...query, mode: 'append' as const };
  let state = invoiceListReducer(undefined, invoiceFiltersChanged(first));
  state = invoiceListReducer(state, fetchInvoices.pending('one', first));
  state = invoiceListReducer(
    state,
    fetchInvoices.fulfilled(page('500.00', [row('one')]), 'one', first)
  );
  const next = { ...first, page: 2 };
  state = invoiceListReducer(state, invoiceFiltersChanged(next));
  state = invoiceListReducer(state, fetchInvoices.pending('two', next));
  state = invoiceListReducer(state, fetchInvoices.rejected(new Error('offline'), 'two', next));
  expect(state.status).toBe('failed');
  expect(state.rows.map((r) => r.id)).toEqual(['one']);
});

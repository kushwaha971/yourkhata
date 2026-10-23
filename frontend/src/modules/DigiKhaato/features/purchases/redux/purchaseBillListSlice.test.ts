import { purchaseBillListReducer, purchaseBillFiltersChanged } from './purchaseBillListSlice';
import { fetchPurchaseBillList } from './purchaseBillThunk';

import type { PurchaseBillListQuery } from '../api/purchaseBillService';
import type { PurchaseBillListPage } from '../types/purchase.types';
const query: PurchaseBillListQuery = {
  kind: 'purchase_bill',
  tab: 'unpaid',
  dateFrom: '2026-04-01',
  dateTo: '2027-03-31',
  partyId: null,
  q: '',
  page: 1,
  dueFrom: '2026-10-21',
  dueTo: '2026-10-28',
};
const result: PurchaseBillListPage = {
  rows: [],
  total: 0,
  page: 1,
  pageSize: 25,
  totals: { count: 0, grandTotal: '0.00', amountDue: '0.00' },
  counts: { all: 0, unpaid: 0, overdue: 0, paid: 0, draft: 0, void: 0 },
};
it('clears old totals when only the supplier-due window changes', () => {
  /** Defect: sameFilters omitted dueFrom/dueTo, keeping the previous window's money visible under the new filter. */
  let state = purchaseBillListReducer(undefined, purchaseBillFiltersChanged(query));
  state = purchaseBillListReducer(state, fetchPurchaseBillList.pending('current', query));
  state = purchaseBillListReducer(state, fetchPurchaseBillList.fulfilled(result, 'current', query));
  expect(state.totals).not.toBeNull();
  state = purchaseBillListReducer(
    state,
    purchaseBillFiltersChanged({ ...query, dueFrom: null, dueTo: null })
  );
  expect(state.status).toBe('loading');
  expect(state.filters?.dueFrom).toBeNull();
  expect(state.totals).toBeNull();
});
it('ignores a late rejected request after the current request succeeded', () => {
  /** Defect: an old network failure could erase a newer successful list with the same filters. */
  let state = purchaseBillListReducer(undefined, purchaseBillFiltersChanged(query));
  state = purchaseBillListReducer(state, fetchPurchaseBillList.pending('new', query));
  state = purchaseBillListReducer(state, fetchPurchaseBillList.fulfilled(result, 'new', query));
  state = purchaseBillListReducer(
    state,
    fetchPurchaseBillList.rejected(new Error('old network'), 'old', query)
  );
  expect(state.status).toBe('succeeded');
  expect(state.error).toBeNull();
});

const withRows = (ids: readonly string[], pageNo = 1): PurchaseBillListPage => ({
  ...result,
  rows: ids.map((id) => ({ id }) as PurchaseBillListPage['rows'][number]),
  page: pageNo,
  total: 30,
  totals: { count: 30, grandTotal: '900.00', amountDue: '500.00' },
});

it('keeps phone cards, totals and counts through the next page and joins it', () => {
  /** R-DEC-33: page two replaced page one, so a phone lost the bills it had scrolled past. */
  const first = { ...query, mode: 'append' as const };
  let state = purchaseBillListReducer(undefined, purchaseBillFiltersChanged(first));
  state = purchaseBillListReducer(state, fetchPurchaseBillList.pending('one', first));
  state = purchaseBillListReducer(
    state,
    fetchPurchaseBillList.fulfilled(withRows(['a']), 'one', first)
  );
  const next = { ...first, page: 2 };
  state = purchaseBillListReducer(state, purchaseBillFiltersChanged(next));
  expect(state.rows).toHaveLength(1);
  expect(state.totals?.amountDue).toBe('500.00');
  expect(state.counts).not.toBeNull();
  state = purchaseBillListReducer(state, fetchPurchaseBillList.pending('two', next));
  state = purchaseBillListReducer(
    state,
    fetchPurchaseBillList.rejected(new Error('x'), 'two', next)
  );
  expect(state.status).toBe('failed');
  expect(state.rows.map((r) => r.id)).toEqual(['a']);
  state = purchaseBillListReducer(state, fetchPurchaseBillList.pending('three', next));
  state = purchaseBillListReducer(
    state,
    fetchPurchaseBillList.fulfilled(withRows(['a', 'b'], 2), 'three', next)
  );
  expect(state.rows.map((r) => r.id)).toEqual(['a', 'b']);
});

it('replaces the page on a desktop and starts again on a new search', () => {
  /** The table pages by replacement, and a new question must not keep the old cards. */
  let state = purchaseBillListReducer(undefined, purchaseBillFiltersChanged(query));
  state = purchaseBillListReducer(state, fetchPurchaseBillList.pending('one', query));
  state = purchaseBillListReducer(
    state,
    fetchPurchaseBillList.fulfilled(withRows(['a']), 'one', query)
  );
  state = purchaseBillListReducer(state, purchaseBillFiltersChanged({ ...query, page: 2 }));
  expect(state.rows).toHaveLength(0);
  const phone = { ...query, mode: 'append' as const };
  state = purchaseBillListReducer(state, purchaseBillFiltersChanged(phone));
  state = purchaseBillListReducer(state, fetchPurchaseBillList.pending('p', phone));
  state = purchaseBillListReducer(
    state,
    fetchPurchaseBillList.fulfilled(withRows(['a']), 'p', phone)
  );
  state = purchaseBillListReducer(
    state,
    purchaseBillFiltersChanged({ ...phone, q: 'agro', page: 2 })
  );
  expect(state.rows).toHaveLength(0);
  expect(state.totals).toBeNull();
});

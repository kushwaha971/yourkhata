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
  state = purchaseBillListReducer(state, purchaseBillFiltersChanged({...query,dueFrom:null,dueTo:null}));
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

import { salesDocListReducer, flowFiltersChanged } from './salesDocListSlice';
import { fetchFlowDocuments, type FlowListArg } from './salesFlowThunk';

import type { InvoiceListRow } from '../types/sales.types';
const query: FlowListArg = {
  kind: 'estimate',
  tab: 'all',
  dateFrom: '2026-10-01',
  dateTo: '2026-10-31',
  partyId: null,
  q: '',
  page: 1,
};
const page = (total: string) => ({
  rows: [],
  totals: { count: 1, grandTotal: total, amountDue: '0.00' },
  tabs: { all: 1 },
  hasAny: true,
  page: 1,
  pageSize: 25,
  total: 1,
});
it('does not replace a newer source total with an older same-filter reply', () => {
  /** Defect: a slow earlier refresh could overwrite the latest total because only filters were compared. */
  let state = salesDocListReducer(undefined, flowFiltersChanged(query));
  state = salesDocListReducer(state, fetchFlowDocuments.pending('old', query));
  state = salesDocListReducer(state, fetchFlowDocuments.pending('new', query));
  state = salesDocListReducer(state, fetchFlowDocuments.fulfilled(page('500.00'), 'new', query));
  state = salesDocListReducer(state, fetchFlowDocuments.fulfilled(page('100.00'), 'old', query));
  expect(state.totals?.grandTotal).toBe('500.00');
});
it('ignores a failed request from the previous document kind', () => {
  /** Defect: rejected requests were not checked against the current kind/filter or latest request. */
  let state = salesDocListReducer(undefined, flowFiltersChanged(query));
  state = salesDocListReducer(state, fetchFlowDocuments.pending('old', query));
  const next = { ...query, kind: 'sales_order' as const };
  state = salesDocListReducer(state, flowFiltersChanged(next));
  state = salesDocListReducer(state, fetchFlowDocuments.pending('new', next));
  state = salesDocListReducer(state, fetchFlowDocuments.fulfilled(page('500.00'), 'new', next));
  state = salesDocListReducer(
    state,
    fetchFlowDocuments.rejected(new Error('old reply'), 'old', query)
  );
  expect(state.status).toBe('succeeded');
  expect(state.error).toBeNull();
});

it('keeps phone cards and totals through the next-page request and deduplicates overlap', () => {
  /** R-DEC-33: desktop replacement paging erased mobile cards and jumped the merchant back. */
  const first = { ...query, mode: 'append' as const };
  const row = { id: 'one' } as InvoiceListRow;
  let state = salesDocListReducer(undefined, flowFiltersChanged(first));
  state = salesDocListReducer(state, fetchFlowDocuments.pending('one', first));
  state = salesDocListReducer(
    state,
    fetchFlowDocuments.fulfilled({ ...page('500.00'), rows: [row], total: 26 }, 'one', first)
  );
  const next = { ...first, page: 2 };
  state = salesDocListReducer(state, flowFiltersChanged(next));
  expect(state.rows).toHaveLength(1);
  expect(state.totals?.grandTotal).toBe('500.00');
  state = salesDocListReducer(state, fetchFlowDocuments.pending('two', next));
  state = salesDocListReducer(
    state,
    fetchFlowDocuments.fulfilled(
      { ...page('500.00'), rows: [row, { ...row, id: 'two' }], page: 2, total: 26 },
      'two',
      next
    )
  );
  expect(state.rows.map((r) => r.id)).toEqual(['one', 'two']);
  const filtered = { ...next, page: 1, q: 'different' };
  state = salesDocListReducer(state, flowFiltersChanged(filtered));
  expect(state.rows).toHaveLength(0);
  expect(state.totals).toBeNull();
});

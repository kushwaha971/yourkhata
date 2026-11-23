import { createSlice, type Draft, type PayloadAction, type WithSlice } from '@reduxjs/toolkit';

import { resetAllFeatureState } from 'src/redux/actions';
import { acceptInvalidation } from 'src/redux/invalidation/listener';
import { rootReducer, type RootState } from 'src/redux/store';
import type { ApiErrorShape, RequestStatus } from 'src/types/api.types';
import { mergePageRows } from 'src/utils/mergePageRows';

import { PURCHASE_BILL_PAGE_SIZE } from '../constants/purchaseConstants';

import { fetchPurchaseBillList, type PurchaseBillListArg } from './purchaseBillThunk';

import type {
  PurchaseBillListRow,
  PurchaseBillTabCounts,
  PurchaseBillTotals,
} from '../types/purchase.types';

/**
 * Part 19 §19.3.2 Shape B — the purchase bills list (PUR-03). Route-local, so
 * it is injected lazily (CR-134) and ships with `/purchases/bills` only.
 */
export interface PurchaseBillListState {
  rows: PurchaseBillListRow[];
  totals: PurchaseBillTotals | null;
  counts: PurchaseBillTabCounts | null;
  hasAny: boolean | null;
  page: number;
  pageSize: number;
  total: number;
  status: RequestStatus;
  error: ApiErrorShape | null;
  filters: PurchaseBillListArg | null;
  requestId: string | null;
  stale: boolean;
  staleUrgency: 'now' | 'next-mount' | null;
}

const initialState: PurchaseBillListState = {
  rows: [],
  totals: null,
  counts: null,
  hasAny: null,
  page: 1,
  pageSize: PURCHASE_BILL_PAGE_SIZE,
  total: 0,
  status: 'idle',
  error: null,
  filters: null,
  requestId: null,
  stale: false,
  staleUrgency: null,
};

const sameFilters = (
  a: PurchaseBillListArg | null,
  b: PurchaseBillListArg,
  ignorePage = false
): boolean =>
  !!a &&
  a.kind === b.kind &&
  a.tab === b.tab &&
  a.dateFrom === b.dateFrom &&
  a.dateTo === b.dateTo &&
  a.partyId === b.partyId &&
  a.q === b.q &&
  (ignorePage || a.page === b.page) &&
  (a.mode ?? 'replace') === (b.mode ?? 'replace') &&
  (a.dueFrom ?? null) === (b.dueFrom ?? null) &&
  (a.dueTo ?? null) === (b.dueTo ?? null);

const purchaseBillListSlice = createSlice({
  name: 'purchaseBillList',
  initialState,
  reducers: {
    /** Rows AND totals clear together — a total over the previous filter's rows was never true. */
    purchaseBillFiltersChanged(state, action: PayloadAction<PurchaseBillListArg>) {
      if (sameFilters(state.filters, action.payload)) return;
      // R-DEC-33: a phone's next page keeps the cards above it, their totals and counts.
      const appending =
        action.payload.mode === 'append' &&
        action.payload.page > 1 &&
        sameFilters(state.filters, action.payload, true) &&
        state.rows.length > 0;
      state.filters = action.payload as Draft<PurchaseBillListArg>;
      if (!appending) {
        state.rows = [];
        state.totals = null;
        state.counts = null;
      }
      state.status = appending ? 'refreshing' : 'loading';
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    acceptInvalidation<PurchaseBillListState>('purchaseBillList')(builder);
    builder
      .addCase(fetchPurchaseBillList.pending, (state, action) => {
        state.requestId = action.meta.requestId;
        state.status = state.rows.length > 0 ? 'refreshing' : 'loading';
        state.error = null;
      })
      .addCase(fetchPurchaseBillList.fulfilled, (state, action) => {
        if (
          state.requestId !== action.meta.requestId ||
          !sameFilters(state.filters, action.meta.arg)
        )
          return;
        state.rows = (
          action.meta.arg.mode === 'append' && action.meta.arg.page > 1
            ? mergePageRows(state.rows, action.payload.rows)
            : action.payload.rows
        ) as Draft<PurchaseBillListRow>[];
        state.totals = action.payload.totals;
        state.counts = action.payload.counts as Draft<PurchaseBillTabCounts>;
        state.hasAny = action.payload.hasAny ?? null;
        state.page = action.payload.page;
        state.pageSize = action.payload.pageSize;
        state.total = action.payload.total;
        state.status = 'succeeded';
        state.stale = false;
        state.staleUrgency = null;
      })
      .addCase(fetchPurchaseBillList.rejected, (state, action) => {
        if (
          action.meta.aborted ||
          state.requestId !== action.meta.requestId ||
          !sameFilters(state.filters, action.meta.arg)
        )
          return;
        state.status = 'failed';
        state.error = (action.payload ?? null) as Draft<ApiErrorShape> | null;
      })
      .addCase(resetAllFeatureState, () => initialState);
  },
});

export const { purchaseBillFiltersChanged } = purchaseBillListSlice.actions;
export const purchaseBillListReducer = purchaseBillListSlice.reducer;

declare module 'src/redux/store' {
  export interface LazyLoadedSlices extends WithSlice<typeof purchaseBillListSlice> {}
}

const injected = purchaseBillListSlice.injectInto(rootReducer);

export const selectPurchaseBillList = (state: RootState): PurchaseBillListState =>
  injected.selectSlice(state);

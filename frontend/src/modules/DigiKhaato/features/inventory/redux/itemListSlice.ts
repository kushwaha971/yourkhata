import { createSlice, type Draft, type PayloadAction, type WithSlice } from '@reduxjs/toolkit';

import { resetAllFeatureState } from 'src/redux/actions';
import { acceptInvalidation } from 'src/redux/invalidation/listener';
import { rootReducer, type RootState } from 'src/redux/store';
import type { ApiErrorShape, RequestStatus } from 'src/types/api.types';
import { mergePageRows } from 'src/utils/mergePageRows';

import { fetchItemList, type ItemListArg } from './itemThunk';

import type { ItemListResult, ItemListRow } from '../types/item.types';

/**
 * INV-02 — the item list. Route-local, so it is injected lazily (CR-134): the
 * reducer arrives with `/items`' chunk, not with every page in the product.
 */
export interface ItemListState {
  rows: ItemListRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  totals: ItemListResult['totals'] | null;
  counts: ItemListResult['counts'] | null;
  /** The server's: whether any item exists at all. `null` until known. */
  hasAny: boolean | null;
  status: RequestStatus;
  error: ApiErrorShape | null;
  filters: ItemListArg | null;
  /** The latest request; an older reply for the same filters is not allowed to win. */
  requestId: string | null;
  stale: boolean;
  staleUrgency: 'now' | 'next-mount' | null;
}

const initialState: ItemListState = {
  rows: [],
  page: 1,
  pageSize: 25,
  total: 0,
  totalPages: 0,
  totals: null,
  counts: null,
  hasAny: null,
  status: 'idle',
  error: null,
  filters: null,
  requestId: null,
  stale: false,
  staleUrgency: null,
};

/**
 * Two requests with the same filters (and the same way of landing) are the same
 * request. `sameQuery` asks only whether they are the same LIST — page and mode
 * aside — which is what decides that page two may join page one's cards.
 */
const key = (f: ItemListArg, query: boolean): string => {
  const flat = { ...f, mode: query ? null : (f.mode ?? 'replace'), page: query ? 0 : f.page };
  return JSON.stringify(flat, Object.keys(flat).sort());
};
const sameFilters = (a: ItemListArg | null, b: ItemListArg, query = false): boolean =>
  a !== null && key(a, query) === key(b, query);

const itemListSlice = createSlice({
  name: 'itemList',
  initialState,
  reducers: {
    itemFiltersChanged(state, action: PayloadAction<ItemListArg>) {
      if (sameFilters(state.filters, action.payload)) return;
      // R-DEC-33: a phone's next page keeps the cards above it.
      const appending =
        action.payload.mode === 'append' &&
        action.payload.page > 1 &&
        sameFilters(state.filters, action.payload, true) &&
        state.rows.length > 0;
      /* A phone that is NOT appending (a new search, a chip) starts from no cards:
         page one of the new answer must not sit under the old list's rows. */
      if (!appending && action.payload.mode === 'append') state.rows = [];
      state.filters = action.payload as Draft<ItemListArg>;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    acceptInvalidation<ItemListState>('itemList')(builder);
    builder
      .addCase(fetchItemList.pending, (state, action) => {
        state.requestId = action.meta.requestId;
        state.status = state.rows.length > 0 ? 'refreshing' : 'loading';
        state.error = null;
      })
      .addCase(fetchItemList.fulfilled, (state, action) => {
        /* A late page for filters the merchant has already left is dropped:
           the "Low" tab must never show the "All" rows that raced it. */
        if (
          state.requestId !== action.meta.requestId ||
          (state.filters && !sameFilters(state.filters as ItemListArg, action.meta.arg))
        )
          return;
        const result = action.payload;
        state.rows = (
          action.meta.arg.mode === 'append' && action.meta.arg.page > 1
            ? mergePageRows(state.rows, result.rows)
            : result.rows
        ) as Draft<ItemListRow>[];
        state.page = result.page;
        state.pageSize = result.pageSize;
        state.total = result.total;
        state.totalPages = result.totalPages;
        state.totals = result.totals;
        state.counts = result.counts;
        state.hasAny = result.hasAny ?? null;
        state.status = 'succeeded';
        state.stale = false;
        state.staleUrgency = null;
      })
      .addCase(fetchItemList.rejected, (state, action) => {
        if (action.meta.aborted || state.requestId !== action.meta.requestId) return;
        state.status = 'failed';
        state.error = (action.payload ?? null) as Draft<ApiErrorShape> | null;
      })
      .addCase(resetAllFeatureState, () => initialState);
  },
});

export const { itemFiltersChanged } = itemListSlice.actions;

declare module 'src/redux/store' {
  export interface LazyLoadedSlices extends WithSlice<typeof itemListSlice> {}
}

const injected = itemListSlice.injectInto(rootReducer);
const slice$ = (state: RootState) => injected.selectSlice(state);

export const selectItemRows = (state: RootState): readonly ItemListRow[] => slice$(state).rows;
export const selectItemListStatus = (state: RootState): RequestStatus => slice$(state).status;
export const selectItemListError = (state: RootState): ApiErrorShape | null => slice$(state).error;
export const selectItemListTotals = (state: RootState): ItemListState['totals'] =>
  slice$(state).totals;
export const selectItemListHasAny = (state: RootState): boolean | null => slice$(state).hasAny;
export const selectItemListCounts = (state: RootState): ItemListState['counts'] =>
  slice$(state).counts;
export const selectItemListPage = (state: RootState): number => slice$(state).page;
export const selectItemListPageSize = (state: RootState): number => slice$(state).pageSize;
export const selectItemListTotal = (state: RootState): number => slice$(state).total;
export const selectItemListTotalPages = (state: RootState): number => slice$(state).totalPages;
export const selectItemListStale = (state: RootState): boolean => slice$(state).stale;

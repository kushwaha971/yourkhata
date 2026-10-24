import { createSlice, type Draft, type PayloadAction, type WithSlice } from '@reduxjs/toolkit';

import { resetAllFeatureState } from 'src/redux/actions';
import { acceptInvalidation } from 'src/redux/invalidation/listener';
import { rootReducer, type RootState } from 'src/redux/store';
import type { ApiErrorShape, RequestStatus } from 'src/types/api.types';
import { mergePageRows } from 'src/utils/mergePageRows';

import { PAYMENT_PAGE_SIZE } from '../constants/paymentConstants';

import { fetchPayments } from './paymentThunk';

import type { PaymentListArg, PaymentRow, PaymentTotals } from '../types/payment.types';

/**
 * Part 19 §19.3.2 Shape B — the payments list. Route-local, so it is injected
 * lazily (CR-134) and ships with `/payments`, not with every route.
 */
export interface PaymentListState {
  rows: PaymentRow[];
  totals: PaymentTotals | null;
  hasAny: boolean | null;
  page: number;
  pageSize: number;
  total: number;
  status: RequestStatus;
  error: ApiErrorShape | null;
  /** The filters the rows on screen answer — the late-response guard's key. */
  filters: PaymentListArg | null;
  /** The latest request; an older reply for the same filters is not allowed to win. */
  requestId: string | null;
  stale: boolean;
  staleUrgency: 'now' | 'next-mount' | null;
}

const initialState: PaymentListState = {
  rows: [],
  totals: null,
  hasAny: null,
  page: 1,
  pageSize: PAYMENT_PAGE_SIZE,
  total: 0,
  status: 'idle',
  error: null,
  filters: null,
  requestId: null,
  stale: false,
  staleUrgency: null,
};

const sameFilters = (
  a: PaymentListArg | null,
  b: PaymentListArg,
  ignorePage = false
): boolean =>
  !!a &&
  a.dateFrom === b.dateFrom &&
  a.dateTo === b.dateTo &&
  a.tab === b.tab &&
  a.mode === b.mode &&
  a.q === b.q &&
  (a.bucket ?? null) === (b.bucket ?? null) &&
  (ignorePage || a.page === b.page) &&
  (a.listMode ?? 'replace') === (b.listMode ?? 'replace');

/** R-DEC-33 — a phone's next page of the same question, joined to the cards shown. */
const isAppend = (arg: PaymentListArg): boolean => arg.listMode === 'append' && arg.page > 1;

const paymentListSlice = createSlice({
  name: 'paymentList',
  initialState,
  reducers: {
    /** Rows AND totals clear together: a total over last month's rows is never true. */
    paymentFiltersChanged(state, action: PayloadAction<PaymentListArg>) {
      if (sameFilters(state.filters, action.payload)) return;
      // A phone's next page keeps the cards above it and their totals.
      const appending =
        isAppend(action.payload) &&
        sameFilters(state.filters, action.payload, true) &&
        state.rows.length > 0;
      state.filters = action.payload as Draft<PaymentListArg>;
      if (!appending) {
        state.rows = [];
        state.totals = null;
      }
      state.status = appending ? 'refreshing' : 'loading';
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    acceptInvalidation<PaymentListState>('paymentList')(builder);
    builder
      .addCase(fetchPayments.pending, (state, action) => {
        state.requestId = action.meta.requestId;
        state.status = state.rows.length > 0 ? 'refreshing' : 'loading';
        state.error = null;
      })
      .addCase(fetchPayments.fulfilled, (state, action) => {
        if (
          state.requestId !== action.meta.requestId ||
          !sameFilters(state.filters, action.meta.arg)
        )
          return;
        state.rows = (
          isAppend(action.meta.arg)
            ? mergePageRows(state.rows, action.payload.rows)
            : action.payload.rows
        ) as Draft<PaymentRow>[];
        state.totals = action.payload.totals as Draft<PaymentTotals>;
        state.hasAny = action.payload.hasAny ?? null;
        state.page = action.payload.page;
        state.pageSize = action.payload.pageSize;
        state.total = action.payload.total;
        state.status = 'succeeded';
        state.stale = false;
        state.staleUrgency = null;
      })
      .addCase(fetchPayments.rejected, (state, action) => {
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

export const { paymentFiltersChanged } = paymentListSlice.actions;

declare module 'src/redux/store' {
  export interface LazyLoadedSlices extends WithSlice<typeof paymentListSlice> {}
}

const injected = paymentListSlice.injectInto(rootReducer);
const slice$ = (state: RootState) => injected.selectSlice(state);

export const selectPaymentRows = (state: RootState): readonly PaymentRow[] => slice$(state).rows;
export const selectPaymentTotals = (state: RootState): PaymentTotals | null => slice$(state).totals;
export const selectPaymentStatus = (state: RootState): RequestStatus => slice$(state).status;
export const selectPaymentError = (state: RootState): ApiErrorShape | null => slice$(state).error;
export const selectPaymentPage = (state: RootState): number => slice$(state).page;
export const selectPaymentPageSize = (state: RootState): number => slice$(state).pageSize;
export const selectPaymentTotal = (state: RootState): number => slice$(state).total;
export const selectPaymentHasAny = (state: RootState): boolean | null => slice$(state).hasAny;
export const selectPaymentListStale = (state: RootState): boolean => slice$(state).stale;

import { createSlice, type Draft, type PayloadAction, type WithSlice } from '@reduxjs/toolkit';

import { resetAllFeatureState } from 'src/redux/actions';
import { acceptInvalidation } from 'src/redux/invalidation/listener';
import { rootReducer, type RootState } from 'src/redux/store';
import type { ApiErrorShape, RequestStatus } from 'src/types/api.types';
import { mergePageRows } from 'src/utils/mergePageRows';

import { EXPENSE_PAGE_SIZE } from '../constants/expensePeriod';

import { fetchExpenses } from './expenseThunk';

import type { Expense, ExpenseListArg, ExpenseTotals } from '../types/expense.types';

/**
 * Part 19 §19.3.2 Shape B — the expense list. Route-local, so it is injected
 * lazily (CR-134) and ships with `/expenses`, not with every route.
 */
export interface ExpenseListState {
  rows: Expense[];
  totals: ExpenseTotals | null;
  hasAny: boolean | null;
  page: number;
  pageSize: number;
  total: number;
  status: RequestStatus;
  error: ApiErrorShape | null;
  /** The filters the rows on screen answer — the late-response guard's key. */
  filters: ExpenseListArg | null;
  /** The latest request; an older reply for the same filters is not allowed to win. */
  requestId: string | null;
  stale: boolean;
  staleUrgency: 'now' | 'next-mount' | null;
}

const initialState: ExpenseListState = {
  rows: [],
  totals: null,
  hasAny: null,
  page: 1,
  pageSize: EXPENSE_PAGE_SIZE,
  total: 0,
  status: 'idle',
  error: null,
  filters: null,
  requestId: null,
  stale: false,
  staleUrgency: null,
};

const sameFilters = (a: ExpenseListArg | null, b: ExpenseListArg, ignorePage = false): boolean =>
  !!a &&
  a.dateFrom === b.dateFrom &&
  a.dateTo === b.dateTo &&
  a.tab === b.tab &&
  a.categoryId === b.categoryId &&
  a.mode === b.mode &&
  a.q === b.q &&
  (a.app ?? null) === (b.app ?? null) &&
  (ignorePage || a.page === b.page) &&
  (a.listMode ?? 'replace') === (b.listMode ?? 'replace');

/** R-DEC-33 — a phone's next page of the same question, joined to the cards shown. */
const isAppend = (arg: ExpenseListArg): boolean => arg.listMode === 'append' && arg.page > 1;

const expenseListSlice = createSlice({
  name: 'expenseList',
  initialState,
  reducers: {
    /**
     * The merchant changed the period, a filter or the page. Rows AND totals
     * clear together: "Total ₹41,230" over last month's rows for the length of
     * a request is a figure that was never true of anything on screen.
     */
    expenseFiltersChanged(state, action: PayloadAction<ExpenseListArg>) {
      if (sameFilters(state.filters, action.payload)) return;
      // A phone's next page keeps the cards above it and their totals.
      const appending =
        isAppend(action.payload) &&
        sameFilters(state.filters, action.payload, true) &&
        state.rows.length > 0;
      state.filters = action.payload as Draft<ExpenseListArg>;
      if (!appending) {
        state.rows = [];
        state.totals = null;
      }
      state.status = appending ? 'refreshing' : 'loading';
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    acceptInvalidation<ExpenseListState>('expenseList')(builder);
    builder
      .addCase(fetchExpenses.pending, (state, action) => {
        state.requestId = action.meta.requestId;
        state.status = state.rows.length > 0 ? 'refreshing' : 'loading';
        state.error = null;
      })
      .addCase(fetchExpenses.fulfilled, (state, action) => {
        // A page for filters the merchant has already moved away from is dropped.
        if (
          state.requestId !== action.meta.requestId ||
          !sameFilters(state.filters, action.meta.arg)
        )
          return;
        state.rows = (
          isAppend(action.meta.arg)
            ? mergePageRows(state.rows, action.payload.rows)
            : action.payload.rows
        ) as Draft<Expense>[];
        state.totals = action.payload.totals as Draft<ExpenseTotals>;
        state.hasAny = action.payload.hasAny ?? null;
        state.page = action.payload.page;
        state.pageSize = action.payload.pageSize;
        state.total = action.payload.total;
        state.status = 'succeeded';
        state.stale = false;
        state.staleUrgency = null;
      })
      .addCase(fetchExpenses.rejected, (state, action) => {
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

export const { expenseFiltersChanged } = expenseListSlice.actions;

declare module 'src/redux/store' {
  export interface LazyLoadedSlices extends WithSlice<typeof expenseListSlice> {}
}

const injected = expenseListSlice.injectInto(rootReducer);
const slice$ = (state: RootState) => injected.selectSlice(state);

export const selectExpenseRows = (state: RootState): readonly Expense[] => slice$(state).rows;
export const selectExpenseTotals = (state: RootState): ExpenseTotals | null => slice$(state).totals;
export const selectExpenseStatus = (state: RootState): RequestStatus => slice$(state).status;
export const selectExpenseError = (state: RootState): ApiErrorShape | null => slice$(state).error;
export const selectExpensePage = (state: RootState): number => slice$(state).page;
export const selectExpensePageSize = (state: RootState): number => slice$(state).pageSize;
export const selectExpenseTotal = (state: RootState): number => slice$(state).total;
export const selectExpenseHasAny = (state: RootState): boolean | null => slice$(state).hasAny;
export const selectExpenseListStale = (state: RootState): boolean => slice$(state).stale;

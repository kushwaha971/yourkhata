import {
  createSlice,
  type AsyncThunk,
  type Draft,
  type PayloadAction,
  type WithSlice,
} from '@reduxjs/toolkit';

import { resetAllFeatureState } from 'src/redux/actions';
import { rootReducer, type RootState } from 'src/redux/store';
import type { ApiErrorShape, RequestStatus } from 'src/types/api.types';

import {
  collect,
  fetchBorrower,
  fetchBorrowers,
  fetchLoan,
  fetchLoans,
  fetchRemind,
  fetchRoutes,
  fetchSettings,
  fetchToday,
  notPaid,
} from './lendingThunks';

import type {
  Borrower,
  BorrowerDetail,
  LendingSettings,
  Loan,
  LoanDetail,
  RemindKind,
  Round,
  Route,
} from '../types/lending.types';

/** A screen's data: what it shows, whether it is loading, and why it failed. */
interface Loadable<T> {
  data: T | null;
  status: RequestStatus;
  error: ApiErrorShape | null;
  /** The latest request: an older answer must not replace a newer one. */
  request: string | null;
}

const loadable = <T>(): Loadable<T> => ({ data: null, status: 'idle', error: null, request: null });

/** Loans & Collections on screen. Injected lazily: no other route pays for it. */
export interface LendingState {
  route: string;
  round: Loadable<Round>;
  loans: Loadable<Loan[]>;
  loan: Loadable<LoanDetail>;
  borrowers: Loadable<Borrower[]>;
  borrower: Loadable<BorrowerDetail>;
  routes: Loadable<Route[]>;
  remindKind: RemindKind;
  remind: Loadable<{ rows: Loan[]; counts: Record<RemindKind, number> }>;
  settings: Loadable<LendingSettings>;
}

const initialState: LendingState = {
  route: '',
  round: loadable(),
  loans: loadable(),
  loan: loadable(),
  borrowers: loadable(),
  borrower: loadable(),
  routes: loadable(),
  remindKind: 'late',
  remind: loadable(),
  settings: loadable(),
};

type Key = { [K in keyof LendingState]: LendingState[K] extends Loadable<unknown> ? K : never }[keyof LendingState];

export const lendingSlice = createSlice({
  name: 'lending',
  initialState,
  reducers: {
    setRoute(state, action: PayloadAction<string>) {
      state.route = action.payload;
    },
    setRemindKind(state, action: PayloadAction<RemindKind>) {
      state.remindKind = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchLoan.pending, (state, action) => {
        // Paint the loan already held (from the round or a list) at once rather than a blank.
        if (state.loan.data?.id !== action.meta.arg) {
          const held =
            state.round.data?.stops.find((s) => s.id === action.meta.arg) ??
            state.loans.data?.find((l) => l.id === action.meta.arg);
          state.loan.data = held ? ({ ...held, schedule: [], collections: [], visits: [], daysToGo: 0 } as Draft<LoanDetail>) : null;
        }
      })
      .addCase(collect.fulfilled, (state, action) => {
        if (state.loan.data?.id === action.payload.loan.id) state.loan.data = action.payload.loan as Draft<LoanDetail>;
      })
      .addCase(notPaid.fulfilled, () => undefined)
      .addCase(resetAllFeatureState, () => initialState);

    /** A screen's thunk: loading, its answer (only the latest request's), its failure. */
    const track = <T>(key: Key, thunk: AsyncThunk<T, never, { rejectValue: ApiErrorShape }>) => {
      builder
        .addMatcher(thunk.pending.match, (state, action) => {
          const slot = state[key] as Loadable<unknown>;
          slot.request = action.meta.requestId;
          slot.status = 'loading';
          slot.error = null;
        })
        .addMatcher(thunk.fulfilled.match, (state, action) => {
          const slot = state[key] as Loadable<unknown>;
          if (action.meta.requestId !== slot.request) return;
          slot.status = 'succeeded';
          slot.data = action.payload as never;
        })
        .addMatcher(thunk.rejected.match, (state, action) => {
          const slot = state[key] as Loadable<unknown>;
          if (action.meta.aborted || action.meta.requestId !== slot.request) return;
          slot.status = 'failed';
          slot.error = (action.payload ?? null) as Draft<ApiErrorShape> | null;
        });
    };
    track('round', fetchToday as never);
    track('loans', fetchLoans as never);
    track('loan', fetchLoan as never);
    track('borrowers', fetchBorrowers as never);
    track('borrower', fetchBorrower as never);
    track('routes', fetchRoutes as never);
    track('remind', fetchRemind as never);
    track('settings', fetchSettings as never);
  },
});

export const { setRoute, setRemindKind } = lendingSlice.actions;

declare module 'src/redux/store' {
  export interface LazyLoadedSlices extends WithSlice<typeof lendingSlice> {}
}

const injected = lendingSlice.injectInto(rootReducer);

export const selectLending = (state: RootState): LendingState => injected.selectSlice(state);

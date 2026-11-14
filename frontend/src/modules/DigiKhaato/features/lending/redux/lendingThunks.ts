import { createAsyncThunk } from '@reduxjs/toolkit';

import type { ApiErrorShape } from 'src/types/api.types';
import { toApiError } from 'src/utils/apiError';

import type {
  Borrower,
  BorrowerDetail,
  CollectValues,
  LendingSettings,
  Loan,
  LoanDetail,
  RemindKind,
  Round,
  Route,
} from '../types/lending.types';

/** Loans & Collections' thunks: one service call each; the service loads with the first. */
const service = () => import('../api/lendingService');
type Reject = { rejectValue: ApiErrorShape };
type Service = Awaited<ReturnType<typeof service>>;

const run =
  <A, R>(fail: string, call: (s: Service, arg: A, signal: AbortSignal) => Promise<R>) =>
  async (
    arg: A,
    { signal, rejectWithValue }: { signal: AbortSignal; rejectWithValue: (e: ApiErrorShape) => unknown }
  ) => {
    try {
      return await call(await service(), arg, signal);
    } catch (error) {
      return rejectWithValue(toApiError(error, fail)) as never;
    }
  };

export const fetchToday = createAsyncThunk<Round, string, Reject>(
  'lending/today',
  run('lending.today.error', (s, route, signal) => s.getToday(route, signal))
);

export const fetchLoans = createAsyncThunk<Loan[], { status?: string; route?: string; q?: string }, Reject>(
  'lending/loans',
  run('lending.loans.error', (s, q, signal) => s.listLoans(q, signal))
);

export const fetchLoan = createAsyncThunk<LoanDetail, string, Reject>(
  'lending/loan',
  run('lending.loan.error', (s, id, signal) => s.getLoan(id, signal))
);

export const fetchBorrowers = createAsyncThunk<Borrower[], string, Reject>(
  'lending/borrowers',
  run('lending.borrowers.error', (s, q, signal) => s.listBorrowers(q, signal))
);

export const fetchBorrower = createAsyncThunk<BorrowerDetail, string, Reject>(
  'lending/borrower',
  run('lending.borrower.error', (s, id, signal) => s.getBorrower(id, signal))
);

export const fetchRoutes = createAsyncThunk<Route[], void, Reject>(
  'lending/routes',
  run('lending.routes.error', (s, _a: void, signal) => s.listRoutes(signal))
);

export const fetchRemind = createAsyncThunk<
  { rows: Loan[]; counts: Record<RemindKind, number> },
  RemindKind,
  Reject
>('lending/remind', run('lending.messages.error', (s, kind, signal) => s.remindList(kind, signal)));

export const fetchSettings = createAsyncThunk<LendingSettings, void, Reject>(
  'lending/settings',
  run('lending.settings.error', (s, _a: void, signal) => s.getSettings(signal))
);

export const collect = createAsyncThunk<
  { loan: LoanDetail; receipt: string },
  { loanId: string; values: CollectValues; key: string },
  Reject
>('lending/collect', run('lending.collect.error', (s, a) => s.collect(a.loanId, a.values, a.key)));

export const notPaid = createAsyncThunk<void, { loanId: string; reason: string; promisedOn: string; key: string }, Reject>(
  'lending/notPaid',
  run('lending.notPaid.error', (s, a) => s.notPaid(a.loanId, { reason: a.reason, promisedOn: a.promisedOn }, a.key))
);

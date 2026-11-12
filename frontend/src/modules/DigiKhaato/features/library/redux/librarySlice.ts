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
  changeStatus,
  collect,
  enrol,
  fetchAttendance,
  fetchBooks,
  fetchExpenses,
  fetchFees,
  fetchHome,
  fetchMessages,
  fetchMoney,
  fetchPayments,
  fetchSeats,
  fetchSettings,
  fetchStudent,
  fetchStudents,
  moveStudent,
  removePayment,
} from './libraryThunks';

import type { StudentsQuery } from '../api/libraryService';
import type {
  AttendanceRow,
  Book,
  Expense,
  FeeFilter,
  FeesPage,
  Home,
  LibrarySettings,
  MessageRow,
  MoneyReport,
  Payment,
  SeatMap,
  Student,
  StudentDetail,
  StudentsPage,
} from '../types/library.types';

/** A screen's data: what it shows, whether it is loading, and why it failed. */
interface Loadable<T> {
  data: T | null;
  status: RequestStatus;
  error: ApiErrorShape | null;
  /** The latest request: an older answer must not replace a newer one. */
  request: string | null;
}

const loadable = <T>(): Loadable<T> => ({ data: null, status: 'idle', error: null, request: null });

/** Members & Fees on screen. Injected lazily: no other route pays for it. */
export interface LibraryState {
  home: Loadable<Home>;
  seats: Loadable<SeatMap>;
  seatShift: string;
  studentsQuery: StudentsQuery;
  students: Loadable<StudentsPage>;
  student: Loadable<StudentDetail>;
  payments: Loadable<Payment[]>;
  fee: FeeFilter;
  fees: Loadable<FeesPage>;
  attendance: Loadable<AttendanceRow[]>;
  messages: Loadable<MessageRow[]>;
  money: Loadable<MoneyReport>;
  expenses: Loadable<Expense[]>;
  books: Loadable<Book[]>;
  settings: Loadable<LibrarySettings>;
  /** A write changed money or seats: lists refetch next time they show. */
  stale: boolean;
}

const initialState: LibraryState = {
  home: loadable(),
  seats: loadable(),
  seatShift: '',
  studentsQuery: { fee: 'all', page: 1 },
  students: loadable(),
  student: loadable(),
  payments: loadable(),
  fee: 'over',
  fees: loadable(),
  attendance: loadable(),
  messages: loadable(),
  money: loadable(),
  expenses: loadable(),
  books: loadable(),
  settings: loadable(),
  stale: false,
};

type Key = { [K in keyof LibraryState]: LibraryState[K] extends Loadable<unknown> ? K : never }[keyof LibraryState];

/** A student changed (a fee, a move, a hold): every copy of them moves at once. */
const studentChanged = (state: LibraryState, s: Student): void => {
  const swap = (rows: readonly Student[]) => rows.map((row) => (row.id === s.id ? s : row));
  if (state.student.data?.id === s.id) state.student.data = { ...state.student.data, ...s };
  if (state.students.data) state.students.data = { ...state.students.data, rows: swap(state.students.data.rows) };
  if (state.fees.data) state.fees.data = { ...state.fees.data, rows: swap(state.fees.data.rows) };
  if (state.home.data) state.home.data = { ...state.home.data, today: swap(state.home.data.today) };
  if (state.seats.data)
    state.seats.data = {
      ...state.seats.data,
      seats: state.seats.data.seats.map((c) => (c.student?.id === s.id ? { ...c, student: s } : c)),
    };
  // Totals, counts and the seat map's shape are the server's: refetch them.
  state.stale = true;
};

export const librarySlice = createSlice({
  name: 'library',
  initialState,
  reducers: {
    setStudentsQuery(state, action: PayloadAction<StudentsQuery>) {
      state.studentsQuery = { ...state.studentsQuery, ...action.payload };
    },
    setSeatShift(state, action: PayloadAction<string>) {
      state.seatShift = action.payload;
    },
    setFee(state, action: PayloadAction<FeeFilter>) {
      state.fee = action.payload;
    },
    markStale(state) {
      state.stale = true;
    },
  },
  extraReducers: (builder) => {
    /** A screen's thunk: loading, its answer (only the latest request's), its failure. */
    const track = <T>(
      key: Key,
      thunk: AsyncThunk<T, never, { rejectValue: ApiErrorShape }>,
      onDone?: (state: Draft<LibraryState>, payload: T) => void
    ) => {
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
          if (onDone) onDone(state, action.payload as T);
          else slot.data = action.payload as never;
        })
        .addMatcher(thunk.rejected.match, (state, action) => {
          const slot = state[key] as Loadable<unknown>;
          if (action.meta.aborted || action.meta.requestId !== slot.request) return;
          slot.status = 'failed';
          slot.error = (action.payload ?? null) as Draft<ApiErrorShape> | null;
        });
    };

    builder
      .addCase(fetchStudent.pending, (state, action) => {
        // Paint the row already held (from a list) at once rather than a blank.
        if (state.student.data?.id !== action.meta.arg.id) {
          const held =
            state.students.data?.rows.find((r) => r.id === action.meta.arg.id) ??
            state.fees.data?.rows.find((r) => r.id === action.meta.arg.id) ??
            state.home.data?.today.find((r) => r.id === action.meta.arg.id);
          state.student.data = held
            ? { ...held, paidThisYear: '', paymentsThisYear: 0, attendance: [], attendanceMonth: '', lastIn: null, messages: 0 }
            : null;
          state.payments.data = null;
        }
      })
      .addCase(collect.fulfilled, (state, action) => {
        studentChanged(state, action.payload.student);
        if (state.payments.data && state.student.data?.id === action.payload.student.id)
          state.payments.data = [action.payload.payment, ...state.payments.data];
      })
      .addCase(removePayment.fulfilled, (state, action) => studentChanged(state, action.payload))
      .addCase(moveStudent.fulfilled, (state, action) => studentChanged(state, action.payload))
      .addCase(changeStatus.fulfilled, (state, action) => studentChanged(state, action.payload))
      .addCase(enrol.fulfilled, (state) => {
        state.stale = true;
      })
      .addCase(resetAllFeatureState, () => initialState);
    track('home', fetchHome as never, (state, payload: Home) => {
      state.home.data = payload as Draft<Home>;
      state.stale = false;
    });
    track('seats', fetchSeats as never);
    track('students', fetchStudents as never, (state, payload: StudentsPage) => {
      // "Show more" asks for the next page and keeps what is on screen.
      const more = payload.page > 1 && state.students.data;
      state.students.data = (
        more ? { ...payload, rows: [...(state.students.data?.rows ?? []), ...payload.rows] } : payload
      ) as Draft<StudentsPage>;
    });
    track('student', fetchStudent as never, (state, payload: StudentDetail) => {
      state.student.data = payload as Draft<StudentDetail>;
    });
    track('payments', fetchPayments as never);
    track('fees', fetchFees as never);
    track('attendance', fetchAttendance as never);
    track('messages', fetchMessages as never);
    track('money', fetchMoney as never);
    track('expenses', fetchExpenses as never);
    track('books', fetchBooks as never);
    track('settings', fetchSettings as never);

  },
});

export const { setStudentsQuery, setSeatShift, setFee, markStale } = librarySlice.actions;

declare module 'src/redux/store' {
  export interface LazyLoadedSlices extends WithSlice<typeof librarySlice> {}
}

const injected = librarySlice.injectInto(rootReducer);

export const selectLibrary = (state: RootState): LibraryState => injected.selectSlice(state);

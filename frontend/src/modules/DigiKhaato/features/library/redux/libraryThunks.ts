import { createAsyncThunk } from '@reduxjs/toolkit';

import type { ApiErrorShape } from 'src/types/api.types';
import { toApiError } from 'src/utils/apiError';

import type { StudentsQuery } from '../api/libraryService';
import type {
  AttendanceRow,
  Book,
  CollectValues,
  EnrolValues,
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

/** The Library's thunks: one service call each; the service loads with the first. */
const service = () => import('../api/libraryService');
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

export const fetchHome = createAsyncThunk<Home, void, Reject>(
  'library/home',
  run('library.home.error', (s, _a: void, signal) => s.getHome(signal))
);

export const fetchSeats = createAsyncThunk<SeatMap, string, Reject>(
  'library/seats',
  run('library.seats.error', (s, shift, signal) => s.getSeats(shift, signal))
);

export const fetchStudents = createAsyncThunk<StudentsPage, StudentsQuery, Reject>(
  'library/students',
  run('library.students.error', (s, q, signal) => s.listStudents(q, signal))
);

export const fetchStudent = createAsyncThunk<StudentDetail, { id: string; month?: string }, Reject>(
  'library/student',
  run('library.student.error', (s, a, signal) => s.getStudent(a.id, signal, a.month))
);

export const fetchPayments = createAsyncThunk<Payment[], { id: string; includeRemoved?: boolean }, Reject>(
  'library/payments',
  run('library.student.error', (s, a, signal) => s.listPayments(a.id, Boolean(a.includeRemoved), signal))
);

export const fetchFees = createAsyncThunk<FeesPage, FeeFilter, Reject>(
  'library/fees',
  run('library.fees.error', (s, fee, signal) => s.getFees(fee, signal))
);

export const enrol = createAsyncThunk<Student, { values: EnrolValues; key: string }, Reject>(
  'library/enrol',
  run('library.enrol.error', (s, a) => s.enrolStudent(a.values, a.key))
);

export const collect = createAsyncThunk<
  { payment: Payment; student: Student; receipt: string },
  { studentId: string; values: CollectValues; key: string },
  Reject
>('library/collect', run('library.collect.error', (s, a) => s.collectFee(a.studentId, a.values, a.key)));

export const removePayment = createAsyncThunk<Student, { paymentId: string; reason: string; key: string }, Reject>(
  'library/removePayment',
  run('library.payment.removeError', (s, a) => s.removePayment(a.paymentId, a.reason, a.key))
);

export const moveStudent = createAsyncThunk<
  Student,
  { id: string; seat: number | null; shiftId: string; key: string },
  Reject
>('library/move', run('library.move.error', (s, a) => s.moveStudent(a.id, { seat: a.seat, shiftId: a.shiftId }, a.key)));

export const changeStatus = createAsyncThunk<
  Student,
  { id: string; action: 'hold' | 'resume' | 'leave'; key: string },
  Reject
>('library/status', run('library.student.statusError', (s, a) => s.setStudentStatus(a.id, a.action, a.key)));

export const fetchAttendance = createAsyncThunk<AttendanceRow[], string, Reject>(
  'library/attendance',
  run('library.attendance.error', (s, day, signal) => s.listAttendance(day, signal))
);

export const fetchMessages = createAsyncThunk<MessageRow[], void, Reject>(
  'library/messages',
  run('library.messages.error', (s, _a: void, signal) => s.listMessages(signal))
);

export const fetchMoney = createAsyncThunk<MoneyReport, { from: string; to: string }, Reject>(
  'library/money',
  run('library.money.error', (s, a, signal) => s.getMoney(a.from, a.to, signal))
);

export const fetchExpenses = createAsyncThunk<Expense[], { from: string; to: string }, Reject>(
  'library/expenses',
  run('library.expenses.error', (s, a, signal) => s.listExpenses(a.from, a.to, signal))
);

export const fetchBooks = createAsyncThunk<Book[], { q?: string }, Reject>(
  'library/books',
  run('library.books.error', (s, a, signal) => s.listBooks(a, signal))
);

export const fetchSettings = createAsyncThunk<LibrarySettings, void, Reject>(
  'library/settings',
  run('library.settings.error', (s, _a: void, signal) => s.getSettings(signal))
);

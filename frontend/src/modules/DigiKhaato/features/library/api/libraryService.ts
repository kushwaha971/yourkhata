import { api } from 'src/api/AxiosInstances';
import { toQueryString } from 'src/utils/queryString';

import type {
  AttendanceRow,
  Book,
  CollectValues,
  EnrolValues,
  Expense,
  ExpenseHead,
  FeeCounts,
  FeeFilter,
  FeePreview,
  FeesPage,
  Home,
  LibrarySettings,
  MessageKind,
  MessageRow,
  MoneyReport,
  Payment,
  SeatMap,
  Shift,
  Student,
  StudentDetail,
  StudentsPage,
} from '../types/library.types';

/** The Library's own API (`/library/…`): one function per endpoint. */
type Wire = Readonly<Record<string, unknown>>;

const seg = (id: string): string => encodeURIComponent(id);
export const LIBRARY_PATHS = {
  HOME: '/library/home',
  SHIFTS: '/library/shifts',
  SHIFT: (id: string) => `/library/shifts/${seg(id)}`,
  SEATS: '/library/seats',
  STUDENTS: '/library/students',
  STUDENT: (id: string) => `/library/students/${seg(id)}`,
  MOVE: (id: string) => `/library/students/${seg(id)}/move`,
  STATUS: (id: string, action: 'hold' | 'resume' | 'leave') => `/library/students/${seg(id)}/${action}`,
  PAYMENTS: (id: string) => `/library/students/${seg(id)}/payments`,
  REMOVE_PAYMENT: (id: string) => `/library/payments/${seg(id)}/remove`,
  FEES: '/library/fees',
  MESSAGES: '/library/messages',
  MESSAGE_TEXT: '/library/messages/text',
  ATTENDANCE: '/library/attendance',
  MONEY: '/library/money',
  EXPENSES: '/library/expenses',
  REMOVE_EXPENSE: (id: string) => `/library/expenses/${seg(id)}/remove`,
  BOOKS: '/library/books',
  BOOK: (id: string) => `/library/books/${seg(id)}`,
  GIVE: (id: string) => `/library/books/${seg(id)}/give`,
  BACK: (id: string) => `/library/issues/${seg(id)}/back`,
  SETTINGS: '/library/settings',
} as const;

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const strOrNull = (v: unknown): string | null =>
  v === null || v === undefined || v === '' ? null : String(v);
const num = (v: unknown): number => Number(v ?? 0) || 0;
const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const data = <T>(r: { data: { data: T } }): T => r.data.data;
const key = (k?: string) => (k ? { headers: { 'Idempotency-Key': k } } : {});

export const toStudent = (r: Wire): Student => ({
  id: str(r.id),
  name: str(r.name),
  mobile: str(r.mobile),
  seat: numOrNull(r.seat),
  shiftId: str(r.shift_id),
  shift: str(r.shift),
  fullDay: Boolean(r.full_day),
  monthlyFee: str(r.monthly_fee || '0.00'),
  joinedOn: str(r.joined_on),
  paidTo: str(r.paid_to),
  credit: str(r.credit || '0.00'),
  status: str(r.status) as Student['status'],
  holdUntil: strOrNull(r.hold_until),
  fee: str(r.fee) as Student['fee'],
  due: str(r.due || '0.00'),
  daysLate: num(r.days_late),
  note: str(r.note),
});

const toShift = (r: Wire): Shift => ({
  id: str(r.id),
  name: str(r.name),
  fullDay: Boolean(r.full_day),
  monthlyFee: str(r.monthly_fee || '0.00'),
  filled: num(r.filled),
  seats: num(r.seats),
  startsAt: strOrNull(r.starts_at),
  endsAt: strOrNull(r.ends_at),
});

const toCounts = (r: unknown): FeeCounts => {
  const c = (r ?? {}) as Wire;
  return {
    all: num(c.all),
    hold: num(c.hold),
    part: num(c.part),
    over: num(c.over),
    soon: num(c.soon),
    paid: num(c.paid),
  };
};

const toPayment = (r: Wire): Payment => ({
  id: str(r.id),
  amount: str(r.amount),
  mode: str(r.mode) as Payment['mode'],
  paidOn: str(r.paid_on),
  months: num(r.months),
  fromDate: strOrNull(r.from_date),
  toDate: strOrNull(r.to_date),
  status: str(r.status) as Payment['status'],
  reason: str(r.reason),
});

const toExpense = (r: Wire): Expense => ({
  id: str(r.id),
  spentOn: str(r.spent_on),
  head: str(r.head) as ExpenseHead,
  amount: str(r.amount),
  note: str(r.note),
  status: str(r.status) as Expense['status'],
  reason: str(r.reason),
});

const toBook = (r: Wire): Book => ({
  id: str(r.id),
  title: str(r.title),
  author: str(r.author),
  copies: num(r.copies),
  note: str(r.note),
  code: str(r.code),
  left: num(r.left),
  out: ((r.out as Wire[]) ?? []).map((o) => ({
    id: str(o.id),
    studentId: str(o.student_id),
    student: str(o.student),
    givenOn: str(o.given_on),
  })),
});

const toSettings = (r: Wire): LibrarySettings => ({
  signAs: str(r.sign_as),
  name: str(r.name),
  upiId: str(r.upi_id),
  dueSoonDays: num(r.due_soon_days),
  seats: num(r.seats),
  shifts: num(r.shifts),
});

export async function getHome(signal?: AbortSignal): Promise<Home> {
  const r = data<Wire>(await api.get(LIBRARY_PATHS.HOME, { signal }));
  return {
    day: str(r.day),
    name: str(r.name),
    seats: num(r.seats),
    seatsFilled: num(r.seats_filled),
    shifts: ((r.shifts as Wire[]) ?? []).map(toShift),
    collected: str(r.collected),
    payments: num(r.payments),
    dueWeek: str(r.due_week),
    dueWeekStudents: num(r.due_week_students),
    overdue: str(r.overdue),
    overdueStudents: num(r.overdue_students),
    today: ((r.today as Wire[]) ?? []).map(toStudent),
    students: num(r.students),
  };
}

export async function getSeats(shiftId: string, signal?: AbortSignal): Promise<SeatMap> {
  const r = data<Wire>(await api.get(`${LIBRARY_PATHS.SEATS}${toQueryString({ shift: shiftId || undefined })}`, { signal }));
  return {
    shiftId: strOrNull(r.shift_id),
    seats: ((r.seats as Wire[]) ?? []).map((s) => ({
      number: num(s.number),
      student: s.student ? toStudent(s.student as Wire) : null,
    })),
    filled: num(r.filled),
    empty: num(r.empty),
    shifts: ((r.shifts as Wire[]) ?? []).map(toShift),
  };
}

export async function setSeatCount(count: number): Promise<number> {
  return num(data<Wire>(await api.put(LIBRARY_PATHS.SEATS, { count })).count);
}

export async function listShifts(signal?: AbortSignal): Promise<Shift[]> {
  return data<Wire[]>(await api.get(LIBRARY_PATHS.SHIFTS, { signal })).map(toShift);
}

export async function saveShift(
  values: { name: string; monthlyFee: string; fullDay?: boolean },
  id?: string,
  idempotencyKey?: string
): Promise<void> {
  const body = { name: values.name, monthly_fee: values.monthlyFee, is_full_day: Boolean(values.fullDay) };
  if (id) await api.patch(LIBRARY_PATHS.SHIFT(id), body);
  else await api.post(LIBRARY_PATHS.SHIFTS, body, key(idempotencyKey));
}

export interface StudentsQuery {
  readonly q?: string;
  readonly fee?: FeeFilter;
  readonly shift?: string;
  readonly status?: 'current' | 'left';
  readonly page?: number;
  readonly pageSize?: number;
}

export async function listStudents(q: StudentsQuery, signal?: AbortSignal): Promise<StudentsPage> {
  const r = await api.get(
    `${LIBRARY_PATHS.STUDENTS}${toQueryString({
      q: q.q || undefined,
      fee: q.fee && q.fee !== 'all' ? q.fee : undefined,
      shift: q.shift || undefined,
      status: q.status && q.status !== 'current' ? q.status : undefined,
      page: q.page ?? 1,
      page_size: q.pageSize ?? 25,
    })}`,
    { signal }
  );
  const meta = (r.data.meta ?? {}) as Wire;
  return {
    rows: (r.data.data as Wire[]).map(toStudent),
    total: num(meta.total),
    page: num(meta.page) || 1,
    counts: toCounts(meta.counts),
    due: str(meta.due || '0.00'),
  };
}

export async function getStudent(id: string, signal?: AbortSignal, month?: string): Promise<StudentDetail> {
  const r = data<Wire>(await api.get(`${LIBRARY_PATHS.STUDENT(id)}${toQueryString({ month })}`, { signal }));
  return {
    ...toStudent(r),
    paidThisYear: str(r.paid_this_year),
    paymentsThisYear: num(r.payments_this_year),
    attendance: (r.attendance as string[]) ?? [],
    attendanceMonth: str(r.attendance_month),
    lastIn: strOrNull(r.last_in),
    messages: num(r.messages),
  };
}

export async function enrolStudent(v: EnrolValues, idempotencyKey: string): Promise<Student> {
  const body = {
    name: v.name,
    mobile: v.mobile,
    shift_id: v.shiftId,
    seat: v.seat || null,
    monthly_fee: v.monthlyFee,
    joined_on: v.joinedOn || undefined,
    first_payment: v.firstPayment || undefined,
    mode: v.mode,
  };
  return toStudent(data<Wire>(await api.post(LIBRARY_PATHS.STUDENTS, body, key(idempotencyKey))));
}

export async function updateStudent(
  id: string,
  v: Partial<{ name: string; mobile: string; monthlyFee: string; note: string }>
): Promise<Student> {
  const body = {
    ...(v.name !== undefined ? { name: v.name } : {}),
    ...(v.mobile !== undefined ? { mobile: v.mobile } : {}),
    ...(v.monthlyFee !== undefined ? { monthly_fee: v.monthlyFee } : {}),
    ...(v.note !== undefined ? { note: v.note } : {}),
  };
  return toStudent(data<Wire>(await api.patch(LIBRARY_PATHS.STUDENT(id), body)));
}

export async function moveStudent(
  id: string,
  v: { seat: number | null; shiftId: string },
  idempotencyKey: string
): Promise<Student> {
  const body = { seat: v.seat, shift_id: v.shiftId };
  return toStudent(data<Wire>(await api.post(LIBRARY_PATHS.MOVE(id), body, key(idempotencyKey))));
}

export async function setStudentStatus(
  id: string,
  action: 'hold' | 'resume' | 'leave',
  idempotencyKey: string
): Promise<Student> {
  return toStudent(data<Wire>(await api.post(LIBRARY_PATHS.STATUS(id, action), {}, key(idempotencyKey))));
}

export async function listPayments(id: string, includeRemoved: boolean, signal?: AbortSignal): Promise<Payment[]> {
  const r = await api.get(
    `${LIBRARY_PATHS.PAYMENTS(id)}${toQueryString({ include_removed: includeRemoved ? 'true' : undefined })}`,
    { signal }
  );
  return (r.data.data as Wire[]).map(toPayment);
}

const payBody = (v: CollectValues): Wire => ({
  amount: v.amount,
  mode: v.mode,
  ...(v.paidOn ? { paid_on: v.paidOn } : {}),
});

export async function previewFee(id: string, v: CollectValues, signal?: AbortSignal): Promise<FeePreview> {
  const r = data<Wire>(await api.post(`${LIBRARY_PATHS.PAYMENTS(id)}?preview=true`, payBody(v), { signal }));
  return { months: num(r.months), paidTo: str(r.paid_to), credit: str(r.credit) };
}

export async function collectFee(
  id: string,
  v: CollectValues,
  idempotencyKey: string
): Promise<{ payment: Payment; student: Student; receipt: string }> {
  const r = await api.post(LIBRARY_PATHS.PAYMENTS(id), payBody(v), key(idempotencyKey));
  const meta = (r.data.meta ?? {}) as Wire;
  return {
    payment: toPayment(r.data.data as Wire),
    student: toStudent(meta.student as Wire),
    receipt: str(meta.receipt),
  };
}

export async function removePayment(id: string, reason: string, idempotencyKey: string): Promise<Student> {
  const r = data<Wire>(await api.post(LIBRARY_PATHS.REMOVE_PAYMENT(id), { reason }, key(idempotencyKey)));
  return toStudent(r.student as Wire);
}

export async function getFees(fee: FeeFilter, signal?: AbortSignal): Promise<FeesPage> {
  const r = data<Wire>(await api.get(`${LIBRARY_PATHS.FEES}${toQueryString({ fee })}`, { signal }));
  return {
    rows: ((r.rows as Wire[]) ?? []).map(toStudent),
    counts: toCounts(r.counts),
    collected: str(r.collected),
    toCome: str(r.to_come),
    month: str(r.month),
  };
}

export async function messageText(
  studentId: string,
  kind: MessageKind,
  lang: string,
  signal?: AbortSignal
): Promise<{ text: string; mobile: string }> {
  const r = data<Wire>(
    await api.get(`${LIBRARY_PATHS.MESSAGE_TEXT}${toQueryString({ student: studentId, kind, lang })}`, { signal })
  );
  return { text: str(r.text), mobile: str(r.mobile) };
}

export async function recordMessage(
  studentId: string,
  kind: MessageKind,
  text: string,
  idempotencyKey: string
): Promise<void> {
  await api.post(LIBRARY_PATHS.MESSAGES, { student_id: studentId, kind, text }, key(idempotencyKey));
}

export async function listMessages(signal?: AbortSignal): Promise<MessageRow[]> {
  const r = await api.get(`${LIBRARY_PATHS.MESSAGES}${toQueryString({ page_size: 100 })}`, { signal });
  return (r.data.data as Wire[]).map((m) => ({
    id: str(m.id),
    studentId: str(m.student_id),
    student: str(m.student),
    kind: str(m.kind) as MessageKind,
    text: str(m.text),
    openedAt: str(m.opened_at),
  }));
}

export async function listAttendance(day: string, signal?: AbortSignal): Promise<AttendanceRow[]> {
  const r = await api.get(`${LIBRARY_PATHS.ATTENDANCE}${toQueryString({ day: day || undefined })}`, { signal });
  return (r.data.data as Wire[]).map((a) => ({
    id: str(a.id),
    studentId: str(a.student_id),
    student: str(a.student),
    seat: numOrNull(a.seat),
    inAt: str(a.in_at),
    outAt: strOrNull(a.out_at),
  }));
}

export async function markAttendance(studentId: string, out: boolean, idempotencyKey: string): Promise<void> {
  await api.post(LIBRARY_PATHS.ATTENDANCE, { student_id: studentId, out }, key(idempotencyKey));
}

export async function getMoney(from: string, to: string, signal?: AbortSignal): Promise<MoneyReport> {
  const r = data<Wire>(await api.get(`${LIBRARY_PATHS.MONEY}${toQueryString({ from, to })}`, { signal }));
  return {
    from: str(r.from),
    to: str(r.to),
    fees: str(r.fees),
    payments: num(r.payments),
    expenses: str(r.expenses),
    net: str(r.net),
    heads: (r.heads ?? {}) as MoneyReport['heads'],
  };
}

export async function listExpenses(from: string, to: string, signal?: AbortSignal): Promise<Expense[]> {
  const r = await api.get(`${LIBRARY_PATHS.EXPENSES}${toQueryString({ from, to })}`, { signal });
  return (r.data.data as Wire[]).map(toExpense);
}

export async function addExpense(
  v: { head: ExpenseHead; amount: string; spentOn: string; note: string },
  idempotencyKey: string
): Promise<Expense> {
  const body = { head: v.head, amount: v.amount, spent_on: v.spentOn || undefined, note: v.note };
  return toExpense(data<Wire>(await api.post(LIBRARY_PATHS.EXPENSES, body, key(idempotencyKey))));
}

export async function removeExpense(id: string, reason: string, idempotencyKey: string): Promise<void> {
  await api.post(LIBRARY_PATHS.REMOVE_EXPENSE(id), { reason }, key(idempotencyKey));
}

export async function listBooks(q: { q?: string; code?: string }, signal?: AbortSignal): Promise<Book[]> {
  const r = await api.get(`${LIBRARY_PATHS.BOOKS}${toQueryString({ q: q.q || undefined, code: q.code || undefined })}`, {
    signal,
  });
  return (r.data.data as Wire[]).map(toBook);
}

export async function saveBook(
  v: { title: string; author: string; copies: string; code: string },
  id: string | null,
  idempotencyKey: string
): Promise<void> {
  const body = { title: v.title, author: v.author, copies: Number(v.copies), code: v.code };
  if (id) await api.patch(LIBRARY_PATHS.BOOK(id), body);
  else await api.post(LIBRARY_PATHS.BOOKS, body, key(idempotencyKey));
}

export async function giveBook(bookId: string, studentId: string, idempotencyKey: string): Promise<void> {
  await api.post(LIBRARY_PATHS.GIVE(bookId), { student_id: studentId }, key(idempotencyKey));
}

export async function takeBack(issueId: string, idempotencyKey: string): Promise<void> {
  await api.post(LIBRARY_PATHS.BACK(issueId), {}, key(idempotencyKey));
}

export async function getSettings(signal?: AbortSignal): Promise<LibrarySettings> {
  return toSettings(data<Wire>(await api.get(LIBRARY_PATHS.SETTINGS, { signal })));
}

export async function saveSettings(v: { signAs: string; upiId: string; dueSoonDays: string }): Promise<LibrarySettings> {
  const body = { sign_as: v.signAs, upi_id: v.upiId, due_soon_days: Number(v.dueSoonDays) };
  return toSettings(data<Wire>(await api.patch(LIBRARY_PATHS.SETTINGS, body)));
}

export interface Poster {
  readonly name: string;
  readonly upiId: string;
  readonly shifts: readonly { name: string; monthlyFee: string; fullDay: boolean }[];
  readonly qr: readonly string[] | null;
}

export async function getPoster(signal?: AbortSignal): Promise<Poster> {
  const r = data<Wire>(await api.get(`${LIBRARY_PATHS.FEES}/poster`, { signal }));
  const qr = r.qr as Wire | null;
  return {
    name: str(r.name),
    upiId: str(r.upi_id),
    shifts: ((r.shifts as Wire[]) ?? []).map((s) => ({
      name: str(s.name),
      monthlyFee: str(s.monthly_fee),
      fullDay: Boolean(s.full_day),
    })),
    qr: qr ? ((qr.modules as string[]) ?? []) : null,
  };
}

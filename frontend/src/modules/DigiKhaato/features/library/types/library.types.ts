/** Members & Fees (docs/revamp/library/01-model-and-api.md), as the screens hold it. */

export type FeeStatus = 'hold' | 'part' | 'over' | 'soon' | 'paid';
export type FeeFilter = 'all' | FeeStatus;
export type StudentStatus = 'active' | 'hold' | 'left';
export type PayMode = 'cash' | 'upi';
export type MessageKind = 'fee_due' | 'receipt' | 'welcome';
export type ExpenseHead = 'rent' | 'electricity' | 'internet' | 'salary' | 'cleaning' | 'other';

export interface Student {
  readonly id: string;
  readonly name: string;
  readonly mobile: string;
  readonly seat: number | null;
  readonly shiftId: string;
  readonly shift: string;
  readonly fullDay: boolean;
  readonly monthlyFee: string;
  readonly joinedOn: string;
  /** The day the next fee is due ("Paid to 25 Nov"). */
  readonly paidTo: string;
  readonly credit: string;
  readonly status: StudentStatus;
  readonly holdUntil: string | null;
  readonly fee: FeeStatus;
  readonly due: string;
  readonly daysLate: number;
  readonly note: string;
}

export interface StudentDetail extends Student {
  readonly paidThisYear: string;
  readonly paymentsThisYear: number;
  /** yyyy-mm-dd days present in `attendanceMonth`. */
  readonly attendance: readonly string[];
  readonly attendanceMonth: string;
  readonly lastIn: string | null;
  readonly messages: number;
}

export interface Shift {
  readonly id: string;
  readonly name: string;
  readonly fullDay: boolean;
  readonly monthlyFee: string;
  readonly filled: number;
  readonly seats: number;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
}

export interface SeatCell {
  readonly number: number;
  readonly student: Student | null;
}

export interface SeatMap {
  readonly shiftId: string | null;
  readonly seats: readonly SeatCell[];
  readonly filled: number;
  readonly empty: number;
  readonly shifts: readonly Shift[];
}

export interface Home {
  readonly day: string;
  /** The library's name, as messages are signed. */
  readonly name: string;
  readonly seats: number;
  readonly seatsFilled: number;
  readonly shifts: readonly Shift[];
  readonly collected: string;
  readonly payments: number;
  readonly dueWeek: string;
  readonly dueWeekStudents: number;
  readonly overdue: string;
  readonly overdueStudents: number;
  readonly today: readonly Student[];
  readonly students: number;
}

export type FeeCounts = Readonly<Record<FeeFilter, number>>;

export interface StudentsPage {
  readonly rows: readonly Student[];
  readonly total: number;
  readonly page: number;
  readonly counts: FeeCounts;
  readonly due: string;
}

export interface FeesPage {
  readonly rows: readonly Student[];
  readonly counts: FeeCounts;
  readonly collected: string;
  readonly toCome: string;
  readonly month: string;
}

export interface Payment {
  readonly id: string;
  readonly amount: string;
  readonly mode: PayMode;
  readonly paidOn: string;
  readonly months: number;
  readonly fromDate: string | null;
  readonly toDate: string | null;
  readonly status: 'live' | 'removed';
  readonly reason: string;
}

export interface FeePreview {
  readonly months: number;
  readonly paidTo: string;
  readonly credit: string;
}

export interface AttendanceRow {
  readonly id: string;
  readonly studentId: string;
  readonly student: string;
  readonly seat: number | null;
  readonly inAt: string;
  readonly outAt: string | null;
}

export interface MessageRow {
  readonly id: string;
  readonly studentId: string;
  readonly student: string;
  readonly kind: MessageKind;
  readonly text: string;
  readonly openedAt: string;
}

export interface MoneyReport {
  readonly from: string;
  readonly to: string;
  readonly fees: string;
  readonly payments: number;
  readonly expenses: string;
  readonly net: string;
  readonly heads: Readonly<Partial<Record<ExpenseHead, string>>>;
}

export interface Expense {
  readonly id: string;
  readonly spentOn: string;
  readonly head: ExpenseHead;
  readonly amount: string;
  readonly note: string;
  readonly status: 'live' | 'removed';
  readonly reason: string;
}

export interface BookOut {
  readonly id: string;
  readonly studentId: string;
  readonly student: string;
  readonly givenOn: string;
}

export interface Book {
  readonly id: string;
  readonly title: string;
  readonly author: string;
  readonly copies: number;
  readonly note: string;
  readonly code: string;
  readonly out: readonly BookOut[];
  readonly left: number;
}

export interface LibrarySettings {
  readonly signAs: string;
  /** The name messages are signed with (the business's name when sign-as is empty). */
  readonly name: string;
  readonly upiId: string;
  readonly dueSoonDays: number;
  readonly seats: number;
  readonly shifts: number;
}

export interface EnrolValues {
  name: string;
  mobile: string;
  shiftId: string;
  seat: string;
  monthlyFee: string;
  joinedOn: string;
  firstPayment: string;
  mode: PayMode;
}

export interface CollectValues {
  amount: string;
  mode: PayMode;
  paidOn: string;
}

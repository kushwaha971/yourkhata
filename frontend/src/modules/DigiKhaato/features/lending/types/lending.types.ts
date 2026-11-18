/** Loans & Collections (docs/revamp/lending/01-model-and-api.md), as the screens hold it. */

export type Frequency = 'daily' | 'weekly' | 'monthly';
export type StopState = 'late' | 'due' | 'done' | 'not';
export type PayMode = 'cash' | 'upi';
export type RemindKind = 'late' | 'due_today' | 'due_tomorrow';
export type ScheduleState = 'collected' | 'late' | 'due' | 'upcoming';

export interface Loan {
  readonly id: string;
  readonly number: string;
  readonly borrowerId: string;
  readonly borrower: string;
  readonly mobile: string;
  readonly work: string;
  readonly routeId: string | null;
  readonly route: string;
  readonly lent: string;
  readonly charges: string;
  readonly frequency: Frequency;
  readonly count: number;
  readonly each: string;
  readonly startsOn: string;
  readonly status: 'active' | 'closed';
  readonly closedOn: string | null;
  readonly closeReason: string;
  readonly total: string;
  readonly collected: string;
  readonly late: string;
  readonly lateDays: number;
  readonly lateSince: string | null;
  readonly dueToday: string;
  readonly left: string;
  readonly paidCount: number;
  readonly nextDue: string | null;
  readonly endsOn: string | null;
  readonly createdOn: string;
}

export interface Stop extends Loan {
  readonly today: string;
  readonly lateAtStart: string;
  readonly collectedToday: string;
  readonly state: StopState;
  readonly reason: string;
  readonly promisedOn: string | null;
}

export interface Round {
  readonly day: string;
  readonly routeId: string | null;
  readonly route: string;
  readonly due: string;
  readonly collected: string;
  readonly short: string;
  readonly stops: readonly Stop[];
  readonly stopsTotal: number;
  readonly stopsDone: number;
  readonly toVisit: number;
  readonly notPaid: number;
  readonly book: { readonly late: string; readonly lateBorrowers: number; readonly lentMonth: string; readonly loansMonth: number };
  readonly routes: readonly { readonly id: string; readonly name: string }[];
  readonly name: string;
}

export interface ScheduleRow {
  readonly seq: number;
  readonly dueOn: string;
  readonly amount: string;
  readonly paid: string;
  readonly state: ScheduleState;
}

export interface CollectionRow {
  readonly id: string;
  readonly amount: string;
  readonly mode: PayMode;
  readonly collectedOn: string;
  readonly status: 'live' | 'removed';
  readonly by: string;
}

export interface LoanDetail extends Loan {
  readonly schedule: readonly ScheduleRow[];
  readonly collections: readonly CollectionRow[];
  readonly visits: readonly { readonly day: string; readonly reason: string; readonly promisedOn: string | null }[];
  readonly daysToGo: number;
}

export interface CollectPreview {
  readonly collected: string;
  readonly late: string;
  readonly lateDays: number;
  readonly dueToday: string;
  readonly left: string;
  readonly daysToGo: number;
}

export interface LoanPreview {
  readonly toCollect: string;
  readonly inHand: string;
  readonly earns: string;
  readonly lastDay: string;
  readonly schedule: readonly { readonly seq: number; readonly dueOn: string; readonly amount: string }[];
}

export interface Borrower {
  readonly id: string;
  readonly name: string;
  readonly mobile: string;
  readonly work: string;
  readonly routeId: string | null;
  readonly route: string;
  readonly note: string;
  readonly loans: number;
  readonly left: string;
  readonly late: string;
}

export interface BorrowerDetail extends Borrower {
  readonly allLoans: readonly Loan[];
}

export interface Route {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
}

export interface LendingSettings {
  readonly signAs: string;
  readonly name: string;
  readonly upiId: string;
}

export interface NewLoanValues {
  borrowerId: string;
  lent: string;
  frequency: Frequency;
  count: string;
  each: string;
  startsOn: string;
  routeId: string;
  charges: string;
}

export interface CollectValues {
  amount: string;
  mode: PayMode;
  collectedOn: string;
}

export interface BorrowerValues {
  name: string;
  mobile: string;
  work: string;
  routeId: string;
}

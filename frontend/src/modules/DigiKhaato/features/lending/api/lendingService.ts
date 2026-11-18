import { api } from 'src/api/AxiosInstances';
import { toQueryString } from 'src/utils/queryString';

import type {
  Borrower,
  BorrowerDetail,
  BorrowerValues,
  CollectPreview,
  CollectValues,
  LendingSettings,
  Loan,
  LoanDetail,
  LoanPreview,
  NewLoanValues,
  RemindKind,
  Round,
  Route,
  Stop,
} from '../types/lending.types';

/** Loans & Collections' own API (`/lending/…`): one function per endpoint. */
type Wire = Readonly<Record<string, unknown>>;

const seg = (id: string): string => encodeURIComponent(id);
export const LENDING_PATHS = {
  TODAY: '/lending/today',
  ROUTES: '/lending/routes',
  ROUTE: (id: string) => `/lending/routes/${seg(id)}`,
  BORROWERS: '/lending/borrowers',
  BORROWER: (id: string) => `/lending/borrowers/${seg(id)}`,
  LOANS: '/lending/loans',
  LOAN: (id: string) => `/lending/loans/${seg(id)}`,
  COLLECT: (id: string) => `/lending/loans/${seg(id)}/collections`,
  NOT_PAID: (id: string) => `/lending/loans/${seg(id)}/not-paid`,
  CLOSE: (id: string) => `/lending/loans/${seg(id)}/close`,
  REMOVE: (id: string) => `/lending/collections/${seg(id)}/remove`,
  REMIND: '/lending/remind',
  MESSAGES: '/lending/messages',
  MESSAGE_TEXT: '/lending/messages/text',
  SETTINGS: '/lending/settings',
} as const;

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const strOrNull = (v: unknown): string | null => (v === null || v === undefined || v === '' ? null : String(v));
const num = (v: unknown): number => Number(v ?? 0) || 0;
const data = <T>(r: { data: { data: T } }): T => r.data.data;
const key = (k?: string) => (k ? { headers: { 'Idempotency-Key': k } } : {});

export const toLoan = (r: Wire): Loan => ({
  id: str(r.id),
  number: str(r.number),
  borrowerId: str(r.borrower_id),
  borrower: str(r.borrower),
  mobile: str(r.mobile),
  work: str(r.work),
  routeId: strOrNull(r.route_id),
  route: str(r.route),
  lent: str(r.lent),
  charges: str(r.charges),
  frequency: str(r.frequency) as Loan['frequency'],
  count: num(r.count),
  each: str(r.each),
  startsOn: str(r.starts_on),
  status: str(r.status) as Loan['status'],
  closedOn: strOrNull(r.closed_on),
  closeReason: str(r.close_reason),
  total: str(r.total),
  collected: str(r.collected),
  late: str(r.late),
  lateDays: num(r.late_days),
  lateSince: strOrNull(r.late_since),
  dueToday: str(r.due_today),
  left: str(r.left),
  paidCount: num(r.paid_count),
  nextDue: strOrNull(r.next_due),
  endsOn: strOrNull(r.ends_on),
  createdOn: str(r.created_on),
});

const toStop = (r: Wire): Stop => ({
  ...toLoan(r),
  today: str(r.today),
  lateAtStart: str(r.late_at_start),
  collectedToday: str(r.collected_today),
  state: str(r.state) as Stop['state'],
  reason: str(r.reason),
  promisedOn: strOrNull(r.promised_on),
});

const toLoanDetail = (r: Wire): LoanDetail => ({
  ...toLoan(r),
  schedule: ((r.schedule as Wire[]) ?? []).map((s) => ({
    seq: num(s.seq),
    dueOn: str(s.due_on),
    amount: str(s.amount),
    paid: str(s.paid),
    state: str(s.state) as LoanDetail['schedule'][number]['state'],
  })),
  collections: ((r.collections as Wire[]) ?? []).map((c) => ({
    id: str(c.id),
    amount: str(c.amount),
    mode: str(c.mode) as 'cash' | 'upi',
    collectedOn: str(c.collected_on),
    status: str(c.status) as 'live' | 'removed',
    by: str(c.by),
  })),
  visits: ((r.visits as Wire[]) ?? []).map((v) => ({ day: str(v.day), reason: str(v.reason), promisedOn: strOrNull(v.promised_on) })),
  daysToGo: num(r.days_to_go),
});

const toBorrower = (r: Wire): Borrower => ({
  id: str(r.id),
  name: str(r.name),
  mobile: str(r.mobile),
  work: str(r.work),
  routeId: strOrNull(r.route_id),
  route: str(r.route),
  note: str(r.note),
  loans: num(r.loans),
  left: str(r.left || '0.00'),
  late: str(r.late || '0.00'),
});

export async function getToday(route: string, signal?: AbortSignal): Promise<Round> {
  const r = data<Wire>(await api.get(`${LENDING_PATHS.TODAY}${toQueryString({ route: route || undefined })}`, { signal }));
  const b = (r.book ?? {}) as Wire;
  return {
    day: str(r.day),
    routeId: strOrNull(r.route_id),
    route: str(r.route),
    due: str(r.due),
    collected: str(r.collected),
    short: str(r.short),
    stops: ((r.stops as Wire[]) ?? []).map(toStop),
    stopsTotal: num(r.stops_total),
    stopsDone: num(r.stops_done),
    toVisit: num(r.to_visit),
    notPaid: num(r.not_paid),
    book: { late: str(b.late), lateBorrowers: num(b.late_borrowers), lentMonth: str(b.lent_month), loansMonth: num(b.loans_month) },
    routes: ((r.routes as Wire[]) ?? []).map((x) => ({ id: str(x.id), name: str(x.name) })),
    name: str(r.name),
  };
}

export async function listRoutes(signal?: AbortSignal): Promise<Route[]> {
  return data<Wire[]>(await api.get(LENDING_PATHS.ROUTES, { signal })).map((r) => ({ id: str(r.id), name: str(r.name), active: Boolean(r.active) }));
}

export async function saveRoute(name: string, id?: string, idempotencyKey?: string): Promise<void> {
  if (id) await api.patch(LENDING_PATHS.ROUTE(id), { name });
  else await api.post(LENDING_PATHS.ROUTES, { name }, key(idempotencyKey));
}

export async function listBorrowers(q: string, signal?: AbortSignal): Promise<Borrower[]> {
  return data<Wire[]>(await api.get(`${LENDING_PATHS.BORROWERS}${toQueryString({ q: q || undefined })}`, { signal })).map(toBorrower);
}

export async function getBorrower(id: string, signal?: AbortSignal): Promise<BorrowerDetail> {
  const r = data<Wire>(await api.get(LENDING_PATHS.BORROWER(id), { signal }));
  return { ...toBorrower(r), allLoans: ((r.all_loans as Wire[]) ?? []).map(toLoan) };
}

export async function saveBorrower(v: BorrowerValues, id: string | null, idempotencyKey: string): Promise<{ id: string; name: string }> {
  const body = { name: v.name, mobile: v.mobile, work: v.work, route_id: v.routeId || null };
  const r = id ? await api.patch(LENDING_PATHS.BORROWER(id), body) : await api.post(LENDING_PATHS.BORROWERS, body, key(idempotencyKey));
  const d = data<Wire>(r);
  return { id: str(d.id), name: str(d.name) };
}

export async function listLoans(q: { status?: string; route?: string; q?: string }, signal?: AbortSignal): Promise<Loan[]> {
  return data<Wire[]>(
    await api.get(`${LENDING_PATHS.LOANS}${toQueryString({ status: q.status, route: q.route || undefined, q: q.q || undefined })}`, { signal })
  ).map(toLoan);
}

export async function getLoan(id: string, signal?: AbortSignal): Promise<LoanDetail> {
  return toLoanDetail(data<Wire>(await api.get(LENDING_PATHS.LOAN(id), { signal })));
}

const loanBody = (v: NewLoanValues): Wire => ({
  borrower_id: v.borrowerId,
  lent: v.lent,
  frequency: v.frequency,
  count: Number(v.count),
  each: v.each,
  starts_on: v.startsOn || undefined,
  route_id: v.routeId || null,
  charges: v.charges || '0',
});

export async function previewLoan(v: NewLoanValues, signal?: AbortSignal): Promise<LoanPreview> {
  const r = data<Wire>(await api.post(`${LENDING_PATHS.LOANS}?preview=true`, loanBody(v), { signal }));
  return {
    toCollect: str(r.to_collect),
    inHand: str(r.in_hand),
    earns: str(r.earns),
    lastDay: str(r.last_day),
    schedule: ((r.schedule as Wire[]) ?? []).map((s) => ({ seq: num(s.seq), dueOn: str(s.due_on), amount: str(s.amount) })),
  };
}

export async function createLoan(v: NewLoanValues, idempotencyKey: string): Promise<LoanDetail> {
  return toLoanDetail(data<Wire>(await api.post(LENDING_PATHS.LOANS, loanBody(v), key(idempotencyKey))));
}

const collectBody = (v: CollectValues): Wire => ({ amount: v.amount, mode: v.mode, ...(v.collectedOn ? { collected_on: v.collectedOn } : {}) });

export async function previewCollect(loanId: string, v: CollectValues, signal?: AbortSignal): Promise<CollectPreview> {
  const r = data<Wire>(await api.post(`${LENDING_PATHS.COLLECT(loanId)}?preview=true`, collectBody(v), { signal }));
  return {
    collected: str(r.collected),
    late: str(r.late),
    lateDays: num(r.late_days),
    dueToday: str(r.due_today),
    left: str(r.left),
    daysToGo: num(r.days_to_go),
  };
}

export async function collect(loanId: string, v: CollectValues, idempotencyKey: string): Promise<{ loan: LoanDetail; receipt: string }> {
  const r = await api.post(LENDING_PATHS.COLLECT(loanId), collectBody(v), key(idempotencyKey));
  const meta = (r.data.meta ?? {}) as Wire;
  return { loan: toLoanDetail(meta.loan as Wire), receipt: str(meta.receipt) };
}

export async function notPaid(loanId: string, v: { reason: string; promisedOn: string }, idempotencyKey: string): Promise<void> {
  await api.post(LENDING_PATHS.NOT_PAID(loanId), { reason: v.reason, promised_on: v.promisedOn || undefined }, key(idempotencyKey));
}

export async function removeCollection(id: string, reason: string, idempotencyKey: string): Promise<LoanDetail> {
  return toLoanDetail(data<Wire>(await api.post(LENDING_PATHS.REMOVE(id), { reason }, key(idempotencyKey))));
}

export async function closeLoan(id: string, reason: 'paid' | 'written_off', idempotencyKey: string): Promise<LoanDetail> {
  return toLoanDetail(data<Wire>(await api.post(LENDING_PATHS.CLOSE(id), { reason }, key(idempotencyKey))));
}

export async function remindList(kind: RemindKind, signal?: AbortSignal): Promise<{ rows: Loan[]; counts: Record<RemindKind, number> }> {
  const r = await api.get(`${LENDING_PATHS.REMIND}${toQueryString({ kind })}`, { signal });
  const c = ((r.data.meta ?? {}) as Wire).counts as Wire | undefined;
  return {
    rows: (r.data.data as Wire[]).map(toLoan),
    counts: { late: num(c?.late), due_today: num(c?.due_today), due_tomorrow: num(c?.due_tomorrow) },
  };
}

export async function messageText(loanId: string, kind: RemindKind, lang: string, signal?: AbortSignal): Promise<{ text: string; mobile: string }> {
  const r = data<Wire>(await api.get(`${LENDING_PATHS.MESSAGE_TEXT}${toQueryString({ loan: loanId, kind, lang })}`, { signal }));
  return { text: str(r.text), mobile: str(r.mobile) };
}

export async function recordMessage(loanId: string, kind: string, text: string, idempotencyKey: string): Promise<void> {
  await api.post(LENDING_PATHS.MESSAGES, { loan_id: loanId, kind, text }, key(idempotencyKey));
}

export async function getSettings(signal?: AbortSignal): Promise<LendingSettings> {
  const r = data<Wire>(await api.get(LENDING_PATHS.SETTINGS, { signal }));
  return { signAs: str(r.sign_as), name: str(r.name), upiId: str(r.upi_id) };
}

export async function saveSettings(v: { signAs: string; upiId: string }): Promise<void> {
  await api.patch(LENDING_PATHS.SETTINGS, { sign_as: v.signAs, upi_id: v.upiId });
}

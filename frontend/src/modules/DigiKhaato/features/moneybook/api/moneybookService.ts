import { api } from 'src/api/AxiosInstances';
import { toQueryString } from 'src/utils/queryString';

import type {
  BalanceFilter,
  Entry,
  EntryValues,
  MoneyBookSettings,
  PeoplePage,
  PeopleSort,
  Person,
  Reminder,
  ReminderChannel,
  ReminderTone,
  ReportPage,
} from '../types/moneybook.types';

/** The Money Book's own API (`/moneybook/…`): one function per endpoint. */
type Wire = Readonly<Record<string, unknown>>;

const seg = (id: string): string => encodeURIComponent(id);
export const MONEYBOOK_PATHS = {
  PEOPLE: '/moneybook/people',
  PERSON: (id: string) => `/moneybook/people/${seg(id)}`,
  ARCHIVE: (id: string) => `/moneybook/people/${seg(id)}/archive`,
  RESTORE: (id: string) => `/moneybook/people/${seg(id)}/restore`,
  ENTRIES: (id: string) => `/moneybook/people/${seg(id)}/entries`,
  REMOVE: (id: string) => `/moneybook/entries/${seg(id)}/remove`,
  REPLACE: (id: string) => `/moneybook/entries/${seg(id)}/replace`,
  REPORT: '/moneybook/report',
  OLD_DUES: '/moneybook/old-dues',
  REMINDERS: '/moneybook/reminders',
  REMINDER_TEXT: '/moneybook/reminders/text',
  SETTINGS: '/moneybook/settings',
} as const;

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const strOrNull = (v: unknown): string | null =>
  v === null || v === undefined || v === '' ? null : String(v);

export const toPerson = (r: Wire): Person => ({
  id: str(r.id),
  name: str(r.name),
  mobile: str(r.mobile),
  balance: str(r.balance || '0.00'),
  lastEntryDate: strOrNull(r.last_entry_date),
  lastEntryNote: str(r.last_entry_note),
  archived: Boolean(r.archived),
  since: str(r.since),
});

export const toEntry = (r: Wire): Entry => ({
  id: str(r.id),
  personId: str(r.person_id),
  kind: str(r.kind) as Entry['kind'],
  amount: str(r.amount),
  note: str(r.note),
  entryDate: str(r.entry_date),
  status: str(r.status) as Entry['status'],
  removesId: strOrNull(r.removes_id),
  replacesId: strOrNull(r.replaces_id),
  reason: str(r.reason),
  createdAt: str(r.created_at),
  balanceAfter: strOrNull(r.balance_after),
  ...(r.person_name !== undefined ? { personName: str(r.person_name) } : {}),
});

const toReminder = (r: Wire): Reminder => ({
  id: str(r.id),
  personId: str(r.person_id),
  personName: str(r.person_name),
  tone: str(r.tone) as ReminderTone,
  channel: str(r.channel) as ReminderChannel,
  text: str(r.text),
  attachedReport: Boolean(r.attached_report),
  openedAt: str(r.opened_at),
});

const entryBody = (v: EntryValues): Wire => ({
  kind: v.kind,
  amount: v.amount,
  note: v.note,
  ...(v.entryDate ? { entry_date: v.entryDate } : {}),
});

export interface PeopleQuery {
  readonly q?: string;
  readonly balance?: BalanceFilter;
  readonly sort?: PeopleSort;
  readonly status?: 'active' | 'archived';
  readonly page?: number;
  readonly pageSize?: number;
}

export async function listPeople(query: PeopleQuery, signal?: AbortSignal): Promise<PeoplePage> {
  const qs = toQueryString({
    q: query.q || undefined,
    balance: query.balance && query.balance !== 'all' ? query.balance : undefined,
    sort: query.sort,
    status: query.status,
    page: query.page,
    page_size: query.pageSize,
  });
  const { data } = await api.get(`${MONEYBOOK_PATHS.PEOPLE}${qs}`, { signal });
  const meta = data.meta as Wire;
  const t = meta.totals as Wire;
  return {
    rows: (data.data as Wire[]).map(toPerson),
    total: Number(meta.total),
    page: Number(meta.page),
    pageSize: Number(meta.page_size),
    totals: {
      toGet: str(t.to_get),
      toGive: str(t.to_give),
      net: str(t.net),
      peopleToGet: Number(t.people_to_get),
      peopleToGive: Number(t.people_to_give),
      people: Number(t.people),
    },
  };
}

export async function addPerson(
  values: { name: string; mobile: string },
  key: string
): Promise<Person> {
  const { data } = await api.post(MONEYBOOK_PATHS.PEOPLE, values, {
    headers: { 'Idempotency-Key': key },
  });
  return toPerson(data.data);
}

export async function getPerson(id: string, signal?: AbortSignal): Promise<Person> {
  const { data } = await api.get(MONEYBOOK_PATHS.PERSON(id), { signal });
  return toPerson(data.data);
}

export async function updatePerson(
  id: string,
  values: { name: string; mobile: string }
): Promise<Person> {
  const { data } = await api.patch(MONEYBOOK_PATHS.PERSON(id), values);
  return toPerson(data.data);
}

export async function archivePerson(id: string, key: string): Promise<Person> {
  const { data } = await api.post(
    MONEYBOOK_PATHS.ARCHIVE(id),
    {},
    { headers: { 'Idempotency-Key': key } }
  );
  return toPerson(data.data);
}

export async function listEntries(
  personId: string,
  options: { includeRemoved?: boolean; page?: number } = {},
  signal?: AbortSignal
): Promise<{ rows: Entry[]; total: number }> {
  const qs = toQueryString({
    include_removed: options.includeRemoved ? 'true' : undefined,
    page: options.page,
    page_size: 100,
  });
  const { data } = await api.get(`${MONEYBOOK_PATHS.ENTRIES(personId)}${qs}`, { signal });
  return { rows: (data.data as Wire[]).map(toEntry), total: Number((data.meta as Wire).total) };
}

/** "After this: ₹8,000 to get" — the server's own rule, nothing saved. */
export async function previewEntry(
  personId: string,
  values: EntryValues,
  signal?: AbortSignal
): Promise<string> {
  const { data } = await api.post(
    `${MONEYBOOK_PATHS.ENTRIES(personId)}?preview=true`,
    entryBody(values),
    { signal }
  );
  return str((data.data as Wire).balance_after);
}

export async function addEntry(
  personId: string,
  values: EntryValues,
  key: string
): Promise<{ entry: Entry; person: Person }> {
  const { data } = await api.post(MONEYBOOK_PATHS.ENTRIES(personId), entryBody(values), {
    headers: { 'Idempotency-Key': key },
  });
  return { entry: toEntry(data.data), person: toPerson((data.meta as Wire).person as Wire) };
}

export async function removeEntry(entryId: string, reason: string, key: string): Promise<Person> {
  const { data } = await api.post(
    MONEYBOOK_PATHS.REMOVE(entryId),
    { reason },
    { headers: { 'Idempotency-Key': key } }
  );
  return toPerson((data.meta as Wire).person as Wire);
}

export async function replaceEntry(
  entryId: string,
  values: EntryValues & { reason: string },
  key: string
): Promise<Person> {
  const { data } = await api.post(
    MONEYBOOK_PATHS.REPLACE(entryId),
    { ...entryBody(values), reason: values.reason },
    { headers: { 'Idempotency-Key': key } }
  );
  return toPerson((data.meta as Wire).person as Wire);
}

export interface ReportQuery {
  readonly person?: string;
  readonly from?: string;
  readonly to?: string;
  readonly page?: number;
}

export async function getReport(query: ReportQuery, signal?: AbortSignal): Promise<ReportPage> {
  const qs = toQueryString({
    person: query.person,
    from: query.from,
    to: query.to,
    page: query.page,
    page_size: 100,
  });
  const { data } = await api.get(`${MONEYBOOK_PATHS.REPORT}${qs}`, { signal });
  const meta = data.meta as Wire;
  const s = meta.summary as Wire;
  return {
    rows: (data.data as Wire[]).map(toEntry),
    total: Number(meta.total),
    summary: {
      youGave: str(s.you_gave),
      youGaveEntries: Number(s.you_gave_entries),
      youGot: str(s.you_got),
      youGotEntries: Number(s.you_got_entries),
      toGetNow: str(s.to_get_now),
      peopleToGet: Number(s.people_to_get),
      toGiveNow: str(s.to_give_now),
      peopleToGive: Number(s.people_to_give),
    },
  };
}

export function reportCsvUrl(query: ReportQuery): string {
  return `${MONEYBOOK_PATHS.REPORT}${toQueryString({ person: query.person, from: query.from, to: query.to, format: 'csv' })}`;
}

export async function listOldDues(signal?: AbortSignal): Promise<{ rows: Person[]; days: number }> {
  const { data } = await api.get(`${MONEYBOOK_PATHS.OLD_DUES}?page_size=100`, { signal });
  return { rows: (data.data as Wire[]).map(toPerson), days: Number((data.meta as Wire).days) };
}

export async function reminderText(
  personId: string,
  tone: ReminderTone,
  lang: string,
  signal?: AbortSignal
): Promise<string> {
  const { data } = await api.get(
    `${MONEYBOOK_PATHS.REMINDER_TEXT}${toQueryString({ person: personId, tone, lang })}`,
    { signal }
  );
  return str((data.data as Wire).text);
}

export async function logReminder(
  values: {
    personId: string;
    tone: ReminderTone;
    channel: ReminderChannel;
    text: string;
    attachedReport: boolean;
  },
  key: string
): Promise<Reminder> {
  const { data } = await api.post(
    MONEYBOOK_PATHS.REMINDERS,
    {
      person_id: values.personId,
      tone: values.tone,
      channel: values.channel,
      text: values.text,
      attached_report: values.attachedReport,
    },
    { headers: { 'Idempotency-Key': key } }
  );
  return toReminder(data.data);
}

export async function listReminders(signal?: AbortSignal): Promise<Reminder[]> {
  const { data } = await api.get(`${MONEYBOOK_PATHS.REMINDERS}?page_size=100`, { signal });
  return (data.data as Wire[]).map(toReminder);
}

export async function getSettings(signal?: AbortSignal): Promise<MoneyBookSettings> {
  const { data } = await api.get(MONEYBOOK_PATHS.SETTINGS, { signal });
  const r = data.data as Wire;
  return { upiId: str(r.upi_id), signAs: str(r.sign_as), oldDuesDays: Number(r.old_dues_days) };
}

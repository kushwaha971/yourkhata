import { createAsyncThunk } from '@reduxjs/toolkit';

import type { ApiErrorShape } from 'src/types/api.types';
import { toApiError } from 'src/utils/apiError';

import type { PeopleQuery, ReportQuery } from '../api/moneybookService';
import type {
  Entry,
  EntryValues,
  PeoplePage,
  Person,
  Reminder,
  ReportPage,
} from '../types/moneybook.types';

/** The Money Book's thunks: one service call each; the service loads with the first. */
const service = () => import('../api/moneybookService');
type Reject = { rejectValue: ApiErrorShape };

const run =
  <A, R>(
    fail: string,
    call: (s: Awaited<ReturnType<typeof service>>, arg: A, signal: AbortSignal) => Promise<R>
  ) =>
  async (
    arg: A,
    {
      signal,
      rejectWithValue,
    }: { signal: AbortSignal; rejectWithValue: (e: ApiErrorShape) => unknown }
  ) => {
    try {
      return await call(await service(), arg, signal);
    } catch (error) {
      return rejectWithValue(toApiError(error, fail)) as never;
    }
  };

export const fetchPeople = createAsyncThunk<PeoplePage, PeopleQuery, Reject>(
  'moneybook/people',
  run('moneybook.people.error', (s, q, signal) => s.listPeople(q, signal))
);

export const fetchPerson = createAsyncThunk<Person, string, Reject>(
  'moneybook/person',
  run('moneybook.person.error', (s, id, signal) => s.getPerson(id, signal))
);

export const fetchEntries = createAsyncThunk<
  { rows: Entry[]; total: number },
  { personId: string; includeRemoved?: boolean },
  Reject
>(
  'moneybook/entries',
  run('moneybook.entries.error', (s, a, signal) =>
    s.listEntries(a.personId, { includeRemoved: a.includeRemoved }, signal)
  )
);

export const saveEntry = createAsyncThunk<
  { entry: Entry; person: Person },
  { personId: string; values: EntryValues; key: string },
  Reject
>(
  'moneybook/saveEntry',
  run('moneybook.entry.error', (s, a) => s.addEntry(a.personId, a.values, a.key))
);

export const removeEntry = createAsyncThunk<
  Person,
  { entryId: string; reason: string; key: string },
  Reject
>(
  'moneybook/removeEntry',
  run('moneybook.entry.error', (s, a) => s.removeEntry(a.entryId, a.reason, a.key))
);

export const replaceEntry = createAsyncThunk<
  Person,
  { entryId: string; values: EntryValues & { reason: string }; key: string },
  Reject
>(
  'moneybook/replaceEntry',
  run('moneybook.entry.error', (s, a) => s.replaceEntry(a.entryId, a.values, a.key))
);

export const savePerson = createAsyncThunk<
  Person,
  { name: string; mobile: string; key: string },
  Reject
>(
  'moneybook/savePerson',
  run('moneybook.person.saveError', (s, a) =>
    s.addPerson({ name: a.name, mobile: a.mobile }, a.key)
  )
);

export const editPerson = createAsyncThunk<
  Person,
  { id: string; name: string; mobile: string },
  Reject
>(
  'moneybook/editPerson',
  run('moneybook.person.saveError', (s, a) =>
    s.updatePerson(a.id, { name: a.name, mobile: a.mobile })
  )
);

export const fetchReport = createAsyncThunk<ReportPage, ReportQuery, Reject>(
  'moneybook/report',
  run('moneybook.report.error', (s, q, signal) => s.getReport(q, signal))
);

export const fetchOldDues = createAsyncThunk<{ rows: Person[]; days: number }, void, Reject>(
  'moneybook/oldDues',
  run('moneybook.oldDues.error', (s, _a, signal) => s.listOldDues(signal))
);

export const fetchReminders = createAsyncThunk<Reminder[], void, Reject>(
  'moneybook/reminders',
  run('moneybook.reminders.error', (s, _a, signal) => s.listReminders(signal))
);

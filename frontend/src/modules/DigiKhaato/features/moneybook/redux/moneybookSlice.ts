import { createSlice, type Draft, type PayloadAction, type WithSlice } from '@reduxjs/toolkit';

import { resetAllFeatureState } from 'src/redux/actions';
import { rootReducer, type RootState } from 'src/redux/store';
import type { ApiErrorShape, RequestStatus } from 'src/types/api.types';

import {
  editPerson,
  fetchEntries,
  fetchOldDues,
  fetchPeople,
  fetchPerson,
  fetchReminders,
  fetchReport,
  removeEntry,
  replaceEntry,
  saveEntry,
} from './moneybookThunks';

import type { PeopleQuery, ReportQuery } from '../api/moneybookService';
import type { Entry, PeoplePage, Person, Reminder, ReportPage } from '../types/moneybook.types';

/** The Money Book on screen. Injected lazily: no other route pays for it. */
export interface MoneyBookState {
  query: PeopleQuery;
  people: PeoplePage | null;
  peopleStatus: RequestStatus;
  peopleError: ApiErrorShape | null;
  /** A write changed a balance: the list refetches next time it is shown. */
  peopleStale: boolean;
  person: Person | null;
  personStatus: RequestStatus;
  personError: ApiErrorShape | null;
  entries: Entry[];
  entriesTotal: number;
  entriesStatus: RequestStatus;
  entriesError: ApiErrorShape | null;
  showRemoved: boolean;
  reportQuery: ReportQuery;
  report: ReportPage | null;
  reportStatus: RequestStatus;
  reportError: ApiErrorShape | null;
  oldDues: Person[];
  oldDuesDays: number;
  oldDuesStatus: RequestStatus;
  reminders: Reminder[];
  remindersStatus: RequestStatus;
}

const initialState: MoneyBookState = {
  query: { balance: 'all', sort: 'last_entry', page: 1 },
  people: null,
  peopleStatus: 'idle',
  peopleError: null,
  peopleStale: false,
  person: null,
  personStatus: 'idle',
  personError: null,
  entries: [],
  entriesTotal: 0,
  entriesStatus: 'idle',
  entriesError: null,
  showRemoved: false,
  reportQuery: {},
  report: null,
  reportStatus: 'idle',
  reportError: null,
  oldDues: [],
  oldDuesDays: 30,
  oldDuesStatus: 'idle',
  reminders: [],
  remindersStatus: 'idle',
};

/** A person changed (an entry, a removal, an edit): every copy of them moves. */
const personChanged = (state: MoneyBookState, person: Person): void => {
  if (state.person?.id === person.id) state.person = person;
  if (state.people) {
    state.people = {
      ...state.people,
      rows: state.people.rows.map((row) => (row.id === person.id ? person : row)),
    };
  }
  // The totals on top and the order are the server's: refetch them.
  state.peopleStale = true;
};

export const moneybookSlice = createSlice({
  name: 'moneybook',
  initialState,
  reducers: {
    setQuery(state, action: PayloadAction<PeopleQuery>) {
      state.query = { ...state.query, ...action.payload };
    },
    setShowRemoved(state, action: PayloadAction<boolean>) {
      state.showRemoved = action.payload;
    },
    setReportQuery(state, action: PayloadAction<ReportQuery>) {
      state.reportQuery = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPeople.pending, (state) => {
        state.peopleStatus = 'loading';
        state.peopleError = null;
      })
      .addCase(fetchPeople.fulfilled, (state, action) => {
        // "Show more" asks for the next page and keeps what is on screen.
        const more = (action.meta.arg.page ?? 1) > 1 && state.people;
        state.people = more
          ? { ...action.payload, rows: [...(state.people?.rows ?? []), ...action.payload.rows] }
          : action.payload;
        state.peopleStatus = 'succeeded';
        state.peopleStale = false;
      })
      .addCase(fetchPeople.rejected, (state, action) => {
        if (action.meta.aborted) return;
        state.peopleStatus = 'failed';
        state.peopleError = (action.payload ?? null) as Draft<ApiErrorShape> | null;
      })
      .addCase(fetchPerson.pending, (state, action) => {
        state.personStatus = 'loading';
        state.personError = null;
        if (state.person?.id !== action.meta.arg) {
          // Paint the row already held at once (from the list) rather than a blank.
          state.person = state.people?.rows.find((row) => row.id === action.meta.arg) ?? null;
          state.entries = [];
          state.entriesStatus = 'idle';
        }
      })
      .addCase(fetchPerson.fulfilled, (state, action) => {
        state.person = action.payload;
        state.personStatus = 'succeeded';
      })
      .addCase(fetchPerson.rejected, (state, action) => {
        if (action.meta.aborted) return;
        state.personStatus = 'failed';
        state.personError = (action.payload ?? null) as Draft<ApiErrorShape> | null;
      })
      .addCase(fetchEntries.pending, (state) => {
        state.entriesStatus = 'loading';
        state.entriesError = null;
      })
      .addCase(fetchEntries.fulfilled, (state, action) => {
        if (action.meta.arg.personId !== state.person?.id) return;
        state.entries = action.payload.rows;
        state.entriesTotal = action.payload.total;
        state.entriesStatus = 'succeeded';
      })
      .addCase(fetchEntries.rejected, (state, action) => {
        if (action.meta.aborted) return;
        state.entriesStatus = 'failed';
        state.entriesError = (action.payload ?? null) as Draft<ApiErrorShape> | null;
      })
      .addCase(saveEntry.fulfilled, (state, action) => personChanged(state, action.payload.person))
      .addCase(removeEntry.fulfilled, (state, action) => personChanged(state, action.payload))
      .addCase(replaceEntry.fulfilled, (state, action) => personChanged(state, action.payload))
      .addCase(editPerson.fulfilled, (state, action) => personChanged(state, action.payload))
      .addCase(fetchReport.pending, (state) => {
        state.reportStatus = 'loading';
        state.reportError = null;
      })
      .addCase(fetchReport.fulfilled, (state, action) => {
        state.report = action.payload;
        state.reportStatus = 'succeeded';
      })
      .addCase(fetchReport.rejected, (state, action) => {
        if (action.meta.aborted) return;
        state.reportStatus = 'failed';
        state.reportError = (action.payload ?? null) as Draft<ApiErrorShape> | null;
      })
      .addCase(fetchOldDues.pending, (state) => {
        state.oldDuesStatus = 'loading';
      })
      .addCase(fetchOldDues.fulfilled, (state, action) => {
        state.oldDues = action.payload.rows;
        state.oldDuesDays = action.payload.days;
        state.oldDuesStatus = 'succeeded';
      })
      .addCase(fetchOldDues.rejected, (state, action) => {
        if (!action.meta.aborted) state.oldDuesStatus = 'failed';
      })
      .addCase(fetchReminders.pending, (state) => {
        state.remindersStatus = 'loading';
      })
      .addCase(fetchReminders.fulfilled, (state, action) => {
        state.reminders = action.payload;
        state.remindersStatus = 'succeeded';
      })
      .addCase(fetchReminders.rejected, (state, action) => {
        if (!action.meta.aborted) state.remindersStatus = 'failed';
      })
      .addCase(resetAllFeatureState, () => initialState);
  },
});

export const { setQuery, setShowRemoved, setReportQuery } = moneybookSlice.actions;

declare module 'src/redux/store' {
  export interface LazyLoadedSlices extends WithSlice<typeof moneybookSlice> {}
}

const injected = moneybookSlice.injectInto(rootReducer);

export const selectMoneyBook = (state: RootState): MoneyBookState => injected.selectSlice(state);

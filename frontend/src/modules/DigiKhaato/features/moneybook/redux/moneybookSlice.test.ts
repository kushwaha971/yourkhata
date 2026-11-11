import { moneybookSlice } from './moneybookSlice';
import { fetchEntries, fetchPerson } from './moneybookThunks';

import type { Entry, Person } from '../types/moneybook.types';

const reducer = moneybookSlice.reducer;
const PERSON: Person = {
  id: 'p2',
  name: 'Anita Pawar',
  mobile: '',
  balance: '8000.00',
  lastEntryDate: null,
  lastEntryNote: '',
  archived: false,
  since: '2026-11-11',
};
const ENTRY = { id: 'e1', personId: 'p2', kind: 'gave', amount: '8000.00' } as Entry;
const start = reducer(undefined, { type: 'init' });

describe('a person page that opens before its person has loaded', () => {
  it('keeps the entries that land first (they were dropped: "0 entries" for ~8 s)', () => {
    /* Money Book monkey, 12 Nov: entries for someone not in the loaded list
       arrived while the person was still null; the old check compared them
       with the person in memory and threw them away. */
    let state = reducer(start, fetchPerson.pending('r-person', 'p2'));
    state = reducer(state, fetchEntries.pending('r-entries', { personId: 'p2' }));
    state = reducer(state, fetchEntries.fulfilled({ rows: [ENTRY], total: 1 }, 'r-entries', { personId: 'p2' }));
    expect(state.entriesFor).toBe('p2');
    expect(state.entries).toHaveLength(1);
    expect(state.entriesStatus).toBe('succeeded');
    state = reducer(state, fetchPerson.fulfilled(PERSON, 'r-person', 'p2'));
    expect(state.entries).toHaveLength(1);
  });

  it('never lets an older answer replace the person or entries asked for since', () => {
    let state = reducer(start, fetchPerson.pending('old', 'p1'));
    state = reducer(state, fetchEntries.pending('old-e', { personId: 'p1' }));
    state = reducer(state, fetchPerson.pending('new', 'p2'));
    state = reducer(state, fetchEntries.pending('new-e', { personId: 'p2' }));
    state = reducer(state, fetchPerson.fulfilled({ ...PERSON, id: 'p1', name: 'Old' }, 'old', 'p1'));
    state = reducer(state, fetchEntries.fulfilled({ rows: [{ ...ENTRY, personId: 'p1' }], total: 1 }, 'old-e', { personId: 'p1' }));
    expect(state.person?.id).not.toBe('p1');
    expect(state.entriesFor).toBe('p2');
    expect(state.entries).toHaveLength(0);
  });
});

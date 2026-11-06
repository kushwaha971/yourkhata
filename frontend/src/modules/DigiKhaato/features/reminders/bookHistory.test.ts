import { api } from 'src/api/AxiosInstances';

import { listReminders } from './api/reminderService';
import { reminderReducer } from './redux/reminderSlice';
import { fetchPartyReminders, fetchReminderHistory } from './redux/reminderThunk';

import type { ReminderPage } from './types/reminder.types';

const page: ReminderPage = { rows: [], page: 1, pageSize: 5, total: 0,
  totals: { sent: 3, failed: 0, lastSentAt: null, lastChannel: null } };

afterEach(() => jest.restoreAllMocks());

/** BP-09: switching the same person between books must not reuse old reminder totals. */
it('rejects a late Shop history response after opening the Udhaar book', () => {
  const shop = { partyId: 'person-1', book: 'shop' as const };
  const main = { partyId: 'person-1', book: 'main' as const };
  let state = reminderReducer(undefined, fetchPartyReminders.pending('shop', shop));
  state = reminderReducer(state, fetchPartyReminders.fulfilled(page, 'shop', shop));
  expect(state.partyTotals?.sent).toBe(3);
  state = reminderReducer(state, fetchPartyReminders.pending('main', main));
  expect(state.partyTotals).toBeNull();
  state = reminderReducer(state, fetchPartyReminders.fulfilled(page, 'shop', shop));
  expect(state.partyTotals).toBeNull();
});

/** The strip must request its book; an unscoped history mixed Shop and Udhaar reminders. */
it('names the book in history reads without changing legacy no-book requests', async () => {
  const get = jest.spyOn(api, 'get').mockResolvedValue({ data: { data: [], meta: {
    page: 1, page_size: 5, total: 0,
    totals: { sent: 0, failed: 0, last_sent_at: null, last_channel: null },
  } } });
  await listReminders({ partyId: 'person-1', book: 'shop', page: 1, pageSize: 5 });
  expect(get.mock.calls[0]?.[0]).toContain('book=shop');
  await listReminders({ partyId: 'person-1', page: 1, pageSize: 5 });
  expect(get.mock.calls[1]?.[0]).not.toContain('book=');
});

/** Shop reminders must not enter the Udhaar Sent tab through its old unscoped query. */
it('scopes the Udhaar Sent-tab read to its own book', async () => {
  const get = jest.spyOn(api, 'get').mockResolvedValue({ data: { data: [], meta: {
    page: 1, page_size: 25, total: 0,
    totals: { sent: 0, failed: 0, last_sent_at: null, last_channel: null },
  } } });
  await fetchReminderHistory({ filter: '', page: 1 })(jest.fn(), jest.fn(), undefined);
  expect(get.mock.calls[0]?.[0]).toContain('book=main');
});

/**
 * The Money Book (rebuilt 11 Nov 2026): one person's own book of money given
 * and got, with no relation to the Shop. Wire shapes are mapped to these in
 * `api/moneybookService.ts`; docs/revamp/moneybook/01-model-and-api.md.
 */

export type EntryKind = 'gave' | 'got';
export type BalanceFilter = 'all' | 'get' | 'give' | 'settled';
export type PeopleSort = 'last_entry' | 'name' | 'amount';
export type ReminderTone = 'polite' | 'due_date' | 'thank_you';
export type ReminderChannel = 'whatsapp' | 'sms';

export interface Person {
  readonly id: string;
  readonly name: string;
  readonly mobile: string;
  /** Signed decimal string: + they owe you (to get), − you owe them (to give). */
  readonly balance: string;
  readonly lastEntryDate: string | null;
  readonly lastEntryNote: string;
  readonly archived: boolean;
  readonly since: string;
}

export interface PeopleTotals {
  readonly toGet: string;
  readonly toGive: string;
  readonly net: string;
  readonly peopleToGet: number;
  readonly peopleToGive: number;
  readonly people: number;
}

export interface PeoplePage {
  readonly rows: Person[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totals: PeopleTotals;
}

export interface Entry {
  readonly id: string;
  readonly personId: string;
  readonly kind: EntryKind;
  readonly amount: string;
  readonly note: string;
  readonly entryDate: string;
  readonly status: 'live' | 'removed';
  readonly removesId: string | null;
  readonly replacesId: string | null;
  readonly reason: string;
  /** When it was typed (ISO); today's entries show the time. */
  readonly createdAt: string;
  /** The person's balance after this entry (computed by the server). */
  readonly balanceAfter: string | null;
  /** Report rows only. */
  readonly personName?: string;
}

export interface EntryValues {
  readonly kind: EntryKind;
  readonly amount: string;
  readonly note: string;
  /** yyyy-mm-dd; empty means today. */
  readonly entryDate: string;
}

export interface ReportSummary {
  readonly youGave: string;
  readonly youGaveEntries: number;
  readonly youGot: string;
  readonly youGotEntries: number;
  readonly toGetNow: string;
  readonly peopleToGet: number;
  readonly toGiveNow: string;
  readonly peopleToGive: number;
}

export interface ReportPage {
  readonly rows: Entry[];
  readonly total: number;
  readonly summary: ReportSummary;
}

export interface Reminder {
  readonly id: string;
  readonly personId: string;
  readonly personName: string;
  readonly tone: ReminderTone;
  readonly channel: ReminderChannel;
  readonly text: string;
  readonly attachedReport: boolean;
  readonly openedAt: string;
}

export interface MoneyBookSettings {
  readonly upiId: string;
  readonly signAs: string;
  readonly oldDuesDays: number;
}

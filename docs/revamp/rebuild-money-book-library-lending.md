# Rebuild from scratch: Money Book, Members & Fees (Library), Loans & Collections (Lending)

Owner, 11 Nov 2026: "delete existing tables … create everything backend and
frontend from scratch … delete old code for these 3 modules", built to the
approved design's Part I (`docs/revamp/design/shop-fixes-and-business-types.html`,
I0–I12) and the plan. This supersedes the earlier "frozen Library/Lending
contracts" and "Library release waits for UAT" rules for these three apps.

## Decided (owner, 11 Nov 2026): every app stands alone

"There should be all these independent and I don't want any relation with shop,
in the same way like one shop should not be related to another one."

So each of the three apps has **its own tables for everything it keeps** —
its people, its money, its payments, its reminders — and reads or writes no
Shop table (`parties_*`, `ledger_*`, `payments_*`, `sales_*`) and no other
app's table. The only things shared are the platform itself: the signed-in
user, the business (tenant), sign-in, the app switcher, settings and the
design system. A person who is in the Shop and in the Money Book is two
records, as they would be in two different shops.

## What exists today (measured 11 Nov)

| App | Backend | Frontend | Own tables | Shared tables it writes |
|---|---|---|---|---|
| Money Book | no app of its own: `parties` + `ledger` in a private "personal tenant" (`apps/ledger/urls_personal.py`, `parties/services/personal_book.py`) | `features/khata` (manifest) + shared `parties`/`ledger` screens | **none** | `parties_party`, `ledger_entry` (the Shop's own tables) |
| Library | `apps/library`, 201 files, 24.4k lines, 11 migrations | `features/library`, 157 files, 23.5k lines | 19 `library_*` | parties, ledger (`library`, `deposit` buckets), payments |
| Lending | `apps/lending`, 79 files, 8.1k lines, 7 migrations | `features/lending`, 45 files, 9.8k lines | 6 `lending_*` | parties, ledger (`loan` bucket), payments, reminders |

Outside users of the old code: `imports` (students and loans import),
`platform_app` (app setup, release gate), `payments` bucket tests, e2e
harnesses, the demo film, onboarding's app list.

## The one thing that cannot be done literally

The Money Book has **no tables of its own**. Its people and entries are rows in
`parties_party` and `ledger_entry`, which are the Shop's customers, suppliers
and khata. Dropping those tables deletes the Shop's books. So "delete the
existing tables" is done like this instead (decision needed, below):

- **Decided:** the Money Book gets its own app `apps/moneybook` and its own
  tables (people, entries, reminders). Its rows are deleted from the Shop's
  tables, and the personal-tenant glue is deleted. The Shop's tables and data
  are untouched.
- Library and Lending: their own tables are dropped and rebuilt, and each new
  app also keeps its own people and money tables instead of the Shop's. Their
  old rows in the shared tables (`library`, `deposit`, `loan` buckets, their
  parties and payments) are deleted, so nothing is left pointing at a table
  that no longer exists.

All of this is local data (QA shops and test students/loans); nothing live is
lost. A database backup (`pg_dump`) is taken before the first drop.

## Order — one app at a time, each to P0 9/10 before the next

1. **Money Book** (I1 People, I2 Person and entry, I3 Reminder and report,
   I12 Start in the Money Book, its Reminders and Old dues menu rows).
2. **Members & Fees** (Library: Home, Students, Seats, Fees, Attendance,
   Messages, Income & expenses, Books…, per the design's `library` menu).
3. **Loans & Collections** (Lending: Today, Loans, Borrowers, Routes, Messages).

For each app:
1. Map every mock to a screen, every screen to the data it needs; write the
   data model and API (one page) — rules carried over by name: money moves
   only by entries, corrections never edit history, nothing is sent by the
   app (DEC-012), each app keeps only its own money (DEC-019), words through
   `useAppWords`, private books stay private.
2. Delete the old code and tables (backup first), in one commit.
3. Build backend (models, migrations, services, API, tests) then frontend
   (design-system components only, Redux slices, the BrandHub pattern).
4. P0: pixel compare with each mock at 390/320/1280, light/dark, EN/HI and
   after an error; money read back by id; monkey 3 seeds × 2 sizes; the
   edge-case catalogue column; a manual pass; score sheet; push.

## Conflicts to settle as they come (listed, not chosen silently)

- The design's entry sheet has "today · change date"; R-DEC-45 built the
  Money Book entry with no date control. The design is followed unless the
  owner says otherwise.
- The design's Money Book menu has Reminders, Report and Old dues; the
  personal-book scope removed them. The design is followed.

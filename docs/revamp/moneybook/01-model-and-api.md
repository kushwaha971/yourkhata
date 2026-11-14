# Money Book — data model and API (rebuild, 11 Nov 2026)

Built from the design's Part I (I1 People, I2 A person and an entry, I3
Reminder and report, I12 Start in the Money Book) and the menu the design
draws for it: **People · Reminders · Report · Old dues**, Settings.
Plan: `../rebuild-money-book-library-lending.md`. Owner: every app stands
alone — no Shop table, no other app's table.

## Who owns a book

A Money Book belongs to **one signed-in person** (the user), not to a business
(R-DEC-45/46: "your own book", private, follows you across businesses). Every
row carries `owner_id` (the user). Nobody else can read it: not staff, not the
business owner, not a support session (impersonation is refused).

## Tables (`apps/moneybook`, all prefixed `moneybook_`)

| Table | Columns | Rules |
|---|---|---|
| `moneybook_person` | id (uuid7), owner_id, name (1–120), mobile (Indian, optional), note_line (last entry's note, cached), balance (decimal 14,2, signed: + to get, − to give), last_entry_at, archived_at, created_at, updated_at | name unique per owner (case-folded) among active people; balance is a cache moved only by entries in the same transaction; `recalc` re-derives it |
| `moneybook_entry` | id, owner_id, person_id, kind (`gave`/`got`), amount (> 0, ≤ 99,99,99,999.99), note (≤ 200), entry_date (default today, IST; not in the future), status (`live`/`removed`), removes_id (the entry a removal undoes), reason, idempotency_key, created_at | **never edited, never deleted** (DB trigger); a mistake is fixed by a removal row (`kind` opposite, `removes_id` set, original marked `removed`) and, for an edit, a new entry; idempotency key unique per owner |
| `moneybook_reminder` | id, owner_id, person_id, tone (`polite`/`due_date`/`thank_you`), channel (`whatsapp`/`sms`), text, attached_report (bool), opened_at | a record that the person OPENED WhatsApp/SMS with this text; nothing is sent by the app (DEC-012) |
| `moneybook_settings` | owner_id (pk), upi_id (optional), sign_as (name used in messages), old_dues_days (default 30) | one row per owner |

Balance after each entry (the "Balance" column on the person and report
screens) is computed by a window function over `(entry_date, created_at, id)`,
never stored — one back-dated entry would otherwise make every stored figure
after it wrong.

## API (`/api/v1/moneybook/…`, JSON, cursor or page paging, Idempotency-Key on writes)

| Method and path | What |
|---|---|
| `GET people?q&balance=all\|get\|give\|settled&sort=last_entry\|name\|amount&page` | the list, plus `meta.totals`: to_get, to_give, people_to_get, people_to_give, net — over the filtered set, not the page |
| `POST people` | name, mobile → 201 (same name active → 409 `person_exists` with the existing id) |
| `GET people/{id}` | person + balance + since |
| `PATCH people/{id}` | name, mobile |
| `POST people/{id}/archive` / `restore` | archive refused unless balance is exactly 0.00 (409 `balance_not_settled`) |
| `GET people/{id}/entries?cursor` | newest first, each with `balance_after`; `include_removed=true` shows removals |
| `POST people/{id}/entries` | kind, amount, note, entry_date → 201 with the new balance; `preview=true` returns "after this" without saving |
| `POST entries/{id}/remove` | reason → the removal row; balance moves back |
| `POST entries/{id}/replace` | new amount/note/date/kind + reason → removal + new entry, one transaction |
| `GET report?person=&from&to` | all people or one: totals (you gave, you got, entries each), to get now, to give now, rows (date, name, entry, amount, note); `format=csv` |
| `GET old-dues?days=` | people with money to get and no entry for N days, oldest first |
| `GET reminders?person=` / `POST reminders` | the log, and recording that one was opened |
| `GET reminders/text?person&tone` | the message in the owner's words (name, amount, last entry date, UPI id) |
| `GET/PATCH settings` | upi_id, sign_as, old_dues_days |

Errors use the platform's `{error:{code,message,details}}`; every code is
registered in `apps/common/error_codes.py`.

## Screens (`features/moneybook`, routes under `/money-book`)

| Route | Mock | Notes |
|---|---|---|
| `/money-book` | pUPeople, dUPeople | title People; To get / To give (+ Net on desktop) with people counts; search + Filters; rows: avatar, name, last entry "Today · Rent share", amount + To get/To give or Settled; Add person (floating on phone); desktop table Name · Mobile · Last entry · Balance · Open, tools All active · Sort: last entry, Report button |
| `/money-book/[id]` | pUEntry, dUPerson | phone: back, name, mobile, call; "To get from Suresh ₹4,500"; dated entries with balance after; dock Gave money (red) / Got money (green). Desktop: people list on the left, the person on the right with Report · Remind · Call and the entries table Date · Entry · Note · Amount · Balance |
| entry sheet | pUEntry | Gave / Got segmented control; Amount; Note (optional); "Today, 30 Oct · change date"; "After this: ₹8,000 to get from Suresh"; Save |
| remind sheet | pURemind | Polite · Due date · Thank you; the message as a WhatsApp bubble (editable); Attach report PDF switch; SMS · WhatsApp |
| `/money-book/report` | dUReport | All people or one; This month · Last month · This year · Pick dates; You gave · You got · To get now · To give now; table Date · Name · Entry · Amount · Note; Share PDF · Print |
| `/money-book/reminders` | menu row | the reminder log, newest first, with "Remind again" |
| `/money-book/old-dues` | menu row | people with money to get and no entry for 30 days |
| first sign-up | pStart / dStart | lands in an empty Money Book ready for the first entry |

## Removed with the old code

`features/khata`, the `/khata` route, the personal-tenant glue
(`apps/ledger/urls_personal.py`, `apps/parties/services/personal_book.py`,
`src/api/personalBookScope.ts` and its interceptor branch), the Money Book
branches in the shared person and statement screens (`PersonalUdhaarPage`,
`personal` props), and the personal-tenant rows in `parties_party` /
`ledger_entry`. The Shop's own screens and data are not touched.

# Members & Fees (Library) — data model and API (rebuild, 12 Nov 2026)

Built from the design's Part I (I4 Home, I5 Seats, I6 Student and collect
fee, I7 Fees and reminders) and the menu the design draws for it:
**Today:** Counter, Home · **Students:** Students, Seats, Fees, Attendance,
Messages · **Money:** Income & expenses, Expenses · **Books:** Books.
Phone bottom bar: Home · Students · Seats · Fees · More.
Plan: `../rebuild-money-book-library-lending.md`. Owner: every app stands
alone — no Shop table, no other app's table, no `parties_*`, `ledger_*`,
`payments_*` or `expenses_*` row.

## What a library is here

A **study library**: students rent a seat for a shift and pay a monthly fee.
That is what every mock shows (seat maps, "paid to 25 Nov", "Seat 14 · Full
day"). The old app was a book-lending library first (catalogue, copies,
holds, fines, deposits); none of that survives. **Books** is kept as the
design's menu row asks, as the plain version a study library needs: a list of
the library's books and who has which one now (give / take back). No fines,
holds or deposits — no mock asks for them, and inventing them is the trap
R-DEC-50 names.

## Who owns it

A library belongs to **the business** (tenant), like the Shop: the owner and
staff with the right role use it. Every row carries `tenant_id`. Permissions:
`library.read`, `library.fee.collect`, `library.student.edit`,
`library.settings.edit` (owner and manager have all; counter staff have read +
collect).

## Tables (`apps/library`, all `library_*`, all new)

| Table | Columns | Rules |
|---|---|---|
| `library_shift` | id, tenant, name (Morning…), starts_at, ends_at, monthly_fee, sort, is_full_day | 1–6 per library; a full-day seat is taken in every shift |
| `library_seat` | id, tenant, number (int ≥ 1), label (optional), active | number unique per tenant |
| `library_student` | id, tenant, name, mobile, seat_id (nullable), shift_id, monthly_fee, joined_on, paid_to (date the fee covers to), credit (part money not yet a whole month), status (`active`/`hold`/`left`), hold_until, note, created_at | one active student per seat × shift (a full-day student blocks the seat in every shift) — checked under `FOR UPDATE`; `paid_to` and `credit` are caches moved only by payments in the same transaction; `recalc_library` re-derives them |
| `library_payment` | id, tenant, student_id, amount (> 0), mode (`cash`/`upi`), paid_on, months (whole months this payment moved `paid_to`), from_date, to_date, status (`live`/`removed`), removes_id, reason, idempotency_key, created_by, created_at | **never edited, never deleted** (DB trigger); a mistake is undone by a removal row that moves `paid_to`/`credit` back |
| `library_attendance` | id, tenant, student_id, day, in_at, out_at | one row per student per day; marked at Counter |
| `library_expense` | id, tenant, spent_on, head (Rent, Electricity, Internet, Salary, Cleaning, Other), amount, note, status, removes_id | the library's own expenses (not the Shop's `expenses_*`) |
| `library_book` | id, tenant, title, author, copies, note, code (barcode: ISBN or a printed label) | code unique per library when set; owner, 12 Nov: "scanner for tracking, just like in libraries" |
| `library_book_issue` | id, tenant, book_id, student_id, given_on, back_on | a copy is out while `back_on` is null; out ≤ copies |
| `library_message` | id, tenant, student_id, kind (`fee_due`/`receipt`/`welcome`), text, opened_at, by | a record that WhatsApp was OPENED with this text; nothing is sent by the app (DEC-012) |
| `library_settings` | tenant (pk), name on messages (defaults to the business name), upi_id, due_soon_days (7), seat count | |

### The fee rule

Collect takes an amount. With `credit + amount`, whole months of
`monthly_fee` move `paid_to` forward one calendar month each (25 Oct → 25 Nov,
end-of-month clamps: 31 Jan → 28 Feb); what is left stays in `credit` and the
student shows **Part paid** with "₹400 left". A first payment for a student
with no `paid_to` starts from `joined_on`. The sheet's "Paid to 25 Nov after
this" is `POST … preview=true`, the same code path without saving.

**Fee status** (one, in this order): `hold` (on hold) → `part` (credit > 0) →
`over` (paid_to < today; "5 days late") → `soon` (paid_to within
`due_soon_days`) → `paid`. A student with no seat is still a student; an empty
seat is a seat with no active student for that shift.

## API (`/api/v1/library/…`, Idempotency-Key on every write)

| Method and path | What |
|---|---|
| `GET home` | seats filled per shift and in all, collected this month (amount, payments), due this week (amount, students), overdue (amount, students), Today list (students who need something: over, soon, part, hold ending) |
| `GET seats?shift=` | every seat with its student for that shift (id, name, mobile, fee status, paid_to, monthly_fee, joined_on), counts per shift |
| `PUT seats` | seat count / labels (owner) |
| `GET/POST/PATCH shifts` | |
| `GET students?q&status&fee=over\|soon\|part\|paid\|hold&shift&page` | list + `meta.counts` per fee status and `meta.totals` (due amount over the filtered set) |
| `POST students` / `PATCH students/{id}` | enrol (name, mobile, shift, seat, monthly_fee, joined_on, first payment optional) — seat taken → 409 `seat_taken` |
| `POST students/{id}/move` | seat, shift → 409 `seat_taken` |
| `POST students/{id}/hold` / `resume` / `leave` | leave frees the seat; refused with money due? no — leaving keeps the due on the record |
| `GET students/{id}` | student + fee due, paid this year, attendance for a month |
| `GET students/{id}/payments` | newest first |
| `POST students/{id}/payments` | amount, mode, paid_on → new paid_to/credit; `preview=true` |
| `POST payments/{id}/remove` | reason |
| `GET fees?fee=&month=` | the Fees screen: rows with late-by and due, counts, collected this month, still to come |
| `GET messages/text?student&kind` | the message in the library's words; `POST messages` records it was opened |
| `GET messages` | the log |
| `GET/POST attendance?day=` | who came; mark in/out |
| `GET money?from&to` | fees in, expenses out, net, by month |
| `GET/POST expenses`, `POST expenses/{id}/remove` | |
| `GET/POST books`, `GET books?code=` (a scan: exact match), `POST books/{id}/give`, `POST issues/{id}/back` | Books screen scans with the phone camera (`UbScanSheet`) or a USB scanner gun (`useScannerListener`), and prints Code 128 labels for books without an ISBN (`utils/code128`) |
| `GET/PATCH settings` | |

## Screens (`features/library`, routes under `/library`)

| Route | Mock | |
|---|---|---|
| `/library` | pLHome, dLHome | Home |
| `/library/seats` | pLSeats, dLSeats | seat map by shift, seat sheet / panel |
| `/library/students`, `/library/students/[id]` | dLStudent, pLStudent | list (no mock: reuse the Money Book People list); student page; collect sheet |
| `/library/fees` | pLFees, dLFees | chips, pick and remind, fee poster |
| `/library/counter` | menu row | find a student by name/mobile/seat: mark present, collect |
| `/library/attendance`, `/messages`, `/money`, `/expenses`, `/books` | menu rows | no mock: built from rated components (memory: reuse rated components) |

## Removed with the old code

All of `apps/library` (11 migrations, 19 tables) and `features/library`, the
public self check-in pages, the students import, the `library`/`deposit`
ledger and payment buckets' library rows, and the library parties.

## Still to build in this rebuild

- **Students from a paper register (import).** The old app had it (QA F10: a
  reading room going live with two hundred students). Its importer wrote old
  tables and is gone with them; it is rebuilt on `library_student` with the
  enrol service, before the round, not deferred.

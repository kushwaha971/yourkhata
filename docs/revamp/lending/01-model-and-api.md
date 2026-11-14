# Loans & Collections (Lending) — data model and API (rebuild, 12 Nov 2026)

Built from the design's Part I (I8 Today, I9 Collect and the loan page, I10 New
loan, I11 Reminders) and its menu: **Today** · **Lending:** Loans, Borrowers,
Routes, Messages. Phone bar: Today · Loans · Borrowers · Messages · More.
Plan: `../rebuild-money-book-library-lending.md`. Every app stands alone: no
`parties_*`, `ledger_*`, `payments_*`, `dues_*` or other app's row.

## What a lender is here

A small daily or weekly lender who goes door to door on a route (the design's
"Shiv Finance", "Route · Market road"). A loan is an amount lent and a fixed
schedule of equal collections ("Daily · 40 days", ₹500 a day, Sundays skipped).
Plain words only: **Lent, Collected, Late, Left** — no EMI, no arrears, no
interest rate on screen. What the lender earns is the schedule's total over the
amount lent, plus any charges taken at the start; both are shown before Save.

## Who owns it

The business (tenant). Permissions: `lending.loan.read` (read everything),
`lending.collection.create` (collect, not paid), `lending.loan.create` (new loan,
borrowers), `lending.settings.manage` (routes, settings, close a loan). Owner and
manager hold all; staff hold read, collect and (owner, 13 Nov 2026) new loan and
borrowers, never routes, settings or closing a loan; an accountant only reads.

## Tables (`apps/lending`, all `lending_*`, all new)

| Table | Columns | Rules |
|---|---|---|
| `lending_route` | id, tenant, name, sort, active | |
| `lending_borrower` | id, tenant, name, mobile, work (Tea stall…), route_id, note, active | mobile unique among active borrowers |
| `lending_loan` | id, tenant, number (L-0001…), borrower_id, route_id, lent (amount handed over before charges), charges (taken at the start), frequency (`daily`/`weekly`/`monthly`), count, each, starts_on, skip_sundays, status (`active`/`closed`), closed_on, close_reason, created_at | one number per tenant; amounts > 0; `count` 1–400 |
| `lending_due` | id, tenant, loan_id, seq, due_on, amount | the schedule, written once with the loan, never edited (the last row carries any rounding) |
| `lending_collection` | id, tenant, loan_id, amount, mode (`cash`/`upi`), collected_on, collected_by, status (`live`/`removed`), removes_id, reason, created_at | **never edited, never deleted** (DB trigger); a mistake is a removal row |
| `lending_visit` | id, tenant, loan_id, day, outcome (`not_paid`), reason, promised_on | a "Not paid" tap; one per loan per day |
| `lending_message` | id, tenant, loan_id, kind (`late`/`due_today`/`due_tomorrow`/`receipt`), text, created_at | WhatsApp was OPENED with this text; nothing is sent (DEC-012) |
| `lending_settings` | tenant, sign_as, upi_id | |

### The money rule

Collections pay the schedule **oldest first**. For a loan on a day:
**collected** = live collections; **late** = unpaid money on dues before today;
**due today** = unpaid money on today's due; **left** = schedule total − collected.
"Today + late" = due today + late. A loan whose left reaches ₹0 closes itself.
Nothing is cached: the figures are computed from the schedule and the
collections every time (a route has tens of loans, a loan at most 400 dues).

## API (`/api/v1/lending/…`, Idempotency-Key on every write)

| Method and path | What |
|---|---|
| `GET today?route=&day=` | the round: collected, due, short, stops done/total, the stops (borrower, loan, today, late, state `due`/`late`/`done`/`not`), figures for the desktop (late across the book, lent this month) |
| `GET/POST/PATCH routes` | |
| `GET/POST borrowers`, `GET/PATCH borrowers/{id}` | with their loans |
| `GET loans?status&route&q`, `POST loans` (`preview=true` returns the schedule), `GET loans/{id}` | the loan page: figures, schedule, collections, visits |
| `POST loans/{id}/collections` (`preview=true` → "after this") | amount, mode, collected_on |
| `POST collections/{id}/remove` | reason |
| `POST loans/{id}/not-paid` | reason, promised_on |
| `POST loans/{id}/close` | reason (only when left is ₹0, or `written_off`) |
| `GET messages?kind=late\|due_today\|due_tomorrow`, `GET messages/text`, `POST messages` | I11 |
| `GET/PATCH settings` | |
| the morning bell | 08:00: "N loans became late today" (as the Library's) |

## Screens (`features/lending`, routes under `/lending`)

| Route | Mock |
|---|---|
| `/lending` | pNToday, dNToday |
| collect sheet | pNCollect |
| `/lending/loans/[id]` | dNLoan |
| `/lending/loans/new` | pNNew, dNNew |
| `/lending/messages` | pNMsg |
| `/lending/loans`, `/lending/borrowers`, `/lending/borrowers/[id]`, `/lending/routes`, `/lending/settings` | menu rows: reuse the rated Library / Money Book parts |

## Removed with the old code

`apps/lending` (7 migrations, 6 tables), `features/lending`, its dues schedules
(13 schedules, 855 dues), its ledger `loan` bucket rows (40) and payments (18),
and the parties only it used.

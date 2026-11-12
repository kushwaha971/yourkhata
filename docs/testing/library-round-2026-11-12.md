# Members & Fees (Library) module round (P0 §9) — 12 Nov 2026

The Library was deleted and rebuilt from scratch (commits bf0b646, 7edfa6e,
aaa8c2a): its own app (`apps/library`, `/api/v1/library`, `/library`), its own
tables, owned by the business, with no relation to the Shop. Design: Part I of
the approved artifact (I4 Home, I5 Seats, I6 Student and collect fee, I7 Fees
and reminders). Model and API: `docs/revamp/library/01-model-and-api.md`.

Owner decisions this round: Books stays simple (a list and who has which copy),
with a barcode scanner for tracking ("just like in libraries").

Local stack: web :3005, API :8000. Room: the design's own students placed
relative to today (`e2e/library_seed.py`), re-seeded before every run.

## §9.1 Every harness

| Harness | Result |
|---|---|
| `e2e/library-round.mjs` (new) | **68/68** at 390 and 1280 |
| Server `apps/library` | 30/30 (+2 import tests) |
| Server suite | green after the rebuild (old Library tests removed or moved to Lending) |
| Frontend unit suite | green (the old Library's own tests went with it; 3 new) |
| Locales | `i18n:check` green, EN and HI in step |

## §9.2 Module-wide monkey

`monkey.mjs --app=library` wanders all 12 Library screens and checks after every
load and return that a student's fee due and Home's Overdue are the server's.
Proved able to fail: `MONKEY_SKEW=1` → FAIL (2).

| Seed | 390 | 1280 |
|---|---|---|
| 111 | PASS · 47 data checks | PASS · 49 |
| 222 | PASS · 36 | PASS · 38 |
| 333 | PASS · 42 | PASS · 40 |

API p95 46–48 ms; no slow page, no console error, no 5xx.

## §9.3 Whole-day journey

`library-round.mjs` is the counter's day: Home's figures, seat 14 on the map
(Overdue, its sheet with Remind and Collect ₹1,200), Collect from the student
page (the sheet's "Paid to" = the date the save made; Home's Collected moves by
exactly the fee; Fees · Overdue drops the student without a reload; the chip
count is the server's), remove the newest payment (paid-to back exactly), enrol
on a free seat (a second student refused, `seat_taken`), a scanner gun's barcode
opening that one book, the Shop never seeing a student, every screen fitting.

## §9.4 Edge cases — `edge-case-catalogue.md`, Library column

| Case | Library |
|---|---|
| E1 double tap | pass (three fast taps on Save = one payment; idempotency test) |
| E2 leave/reload | pass (saved by Save; lists refetch; monkey reload/return data check) |
| E3 address vs screen | pass (student page reads its id from the address; monkey per student) |
| E4 offline | pass (offline Save keeps the sheet and amount, stores nothing; back online stored exactly once) |
| E5 two devices | pass (student row lock on every fee; seat unique index + lock: test_a_seat_is_one_students_per_shift…) |
| E6 totals | pass (Home = Fees = Seats test; Home figures = API on screen) |
| E7 extra zeros | pass (99999999999 refused as "too large", nothing sent; server MAX) |
| E8 qty | n/a (no quantities; copies are whole numbers) |
| E9 stock | n/a |
| E10 wrong book | pass (no Shop table: test_the_library_writes_no_shop_table; the Shop's API has no party for a student) |
| E11 no stock | n/a (a book with every copy out is refused, `no_copy_left`) |
| E12 undo | pass (removal row; only the newest payment, so the caches go back exactly) |
| E13 back-dated | partly: the joining day can be back-dated; Collect is today's (the design's sheet has no date) |
| E14 freezes | pass (monkey 3 × 2) |
| E15 reason shown | pass (seat_taken, not_latest_payment, no_copy_left shown in place; error case on all 12 screens) |
| E16 settings survive | pass (due-soon days set, API restarted, read back) |
| E17 long text | pass (long Hindi name, ₹12,40,378 fee: student page and list fit) |
| E18 slow lists | pass (API p95 ≤ 48 ms under the monkey) |
| E19 finished can't change | pass (database trigger: a payment is never edited or deleted) |
| E20 double remove | pass (a second removal refused, `already_removed`) |
| E21–E22, E25 | n/a |
| E23 overpaying | pass (more than a month moves "paid to" by whole months; the rest is Part paid, said before Save) |
| E24 print vs screen | pass for the fee poster (shifts and fees from the same API); no receipt print (WhatsApp text from the server) |
| E26 red on open | pass (Enrol opens with nothing red) |
| E27 restyle breaks save | pass (every form saves in the harness after the build) |

## Found and fixed in this round

1. **Saving with no mobile hung, in two apps.** The shared mobile rule turns an
   empty box into null, and the Library's Enrol and the Money Book's Add person
   both called `.replace` on it: nothing was sent and the button spun for ever.
   The Money Book's round always typed a mobile, so it passed there. Fixed in
   both, with tests (`librarySchemas.test.tsx`, `personMobile.test.tsx`), and the
   harness now enrols without a mobile.
2. **Counter said "nobody is in" when it could not load** (look sweep, error
   case). A failed load now says so.
3. **Fees chips wrapped mid-word on a phone** ("Due / soon · 1"), seen side by side.
4. **The phone Home listed five Today rows**; the design shows three.
5. **The student page's dock covered the last line** of the attendance card on a phone.
6. Seven guard tests caught convention breaks before anything ran: two lazy
   dialogs without a loading shape, a hand-built `wa.me` link (now
   `utils/share`), money added in floats (now `sumMoney`), a possessive on a
   placeholder, and "Overdue" in a second Hindi word (now समय निकल गया everywhere).

## Design (look sweep and side by side)

`shop-look.mjs --app=library`: 12 screens × 320/390/1280 × light/dark × EN/HI and
after a server error at 390/1280 — 1103/1104 before the Counter fix, **1104/1104** after it. Side by side (`docs/testing/library-shots/compare-library-1.png`): Home, Seats and Fees
at 390 and 1280 match the mocks' composition, figures, colours and actions.

Departures, listed for the owner rather than chosen silently:
- the bottom bar's fifth slot is the app switcher (the owner's call for the Money Book, kept the same);
- shift names are the library's own saved names, so they stay as typed in Hindi;
- screens with no mock (Counter, Students, Attendance, Messages, Income & expenses,
  Expenses, Books, Settings) reuse the rated Money Book parts.

## §8 score

| Points | Earned | Evidence |
|---|---|---|
| Business 2 | 2 | fees, paid-to, Home/Fees figures read back by id after a skewed self-test; payments locked by a trigger |
| Design 1 | 1 | six mocks paired; look sweep across 12 screens |
| Functional 1 | 1 | the whole counter day on screen; other screens update without a reload |
| User 2 | 2 | monkey 3 × 2 with data checks; catalogue column complete; long Hindi text |
| Data and recovery 1 | 1 | offline Save stores nothing, then once; three taps write once |
| Performance 1 | 1 | API p95 ≤ 48 ms; forms load on demand |
| Honesty 1 | 1 | this report, harness defects named |
| Owner 1 | 0 | not yet seen by the owner |

**9/10.**

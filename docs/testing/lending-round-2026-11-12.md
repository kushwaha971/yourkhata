# Loans & Collections (Lending) module round (P0 §9) — 12 Nov 2026

Lending was deleted and rebuilt from scratch (commits c5057bb, 9702690 and the
screens commit): its own app (`apps/lending`, `/api/v1/lending`, `/lending`), its
own tables, owned by the business, no relation to the Shop. Design: Part I of
the approved artifact (I8 Today, I9 Collect and the loan page, I10 New loan,
I11 Reminders). Model and API: `docs/revamp/lending/01-model-and-api.md`.

Local stack: web :3005, API :8000. Book: the design's own round on Market road
placed relative to today (`e2e/lending_seed.py`), re-seeded before every run.

## §9.1 Every harness

| Harness | Result |
|---|---|
| `e2e/lending-round.mjs` (new) | **64/64** at 390 and 1280 |
| `e2e/lending-measure.mjs` (new) | **17/17** parts within 1 px of the design |
| Server `apps/lending` | 22/22, every figure worked out by hand on fixed dates first |
| Server suite | 4,536 passed, 14 skipped (the dues timing test passed this run) |
| Frontend unit suite | 4,347 passed, 1 skipped |
| Look sweep `shop-look.mjs --app=lending` | **828/828** (9 screens × 320/390/1280 × light/dark × EN/HI + error) after one fix |
| `library-round.mjs` re-run | 72/72 (the shared fixes below reached it) |
| Locales | `i18n:check` green, EN and HI in step |

## §9.2 Module-wide monkey

`monkey.mjs --app=lending` wanders all nine Lending screens and checks after
every move that a loan's Left and Today's collected are the server's. Proved
able to fail with `MONKEY_SKEW=1`. Results: see the table below.

| Seed | 390 | 1280 |
|---|---|---|
| 111 | PASS · 53 data checks (after the fix below) | PASS · 55 |
| 222 | PASS · 33 | PASS · 36 |
| 333 | PASS · 39 | PASS · 41 |

API p95 46–51 ms. The first phone runs failed for two reasons: the monkey read
the first row of figures where Left sits in the second on a phone (the
harness's), and seed 111 typed a lone "-" into Collect's amount — the Save
label formatted it and threw (the app's; below).

## §9.3 Whole-day journey

The collector's day in `lending-round.mjs`: Today's card read back; Collect
"today + late" on Sunil (two days late) — the sheet's "After this" is the left
the save makes, nothing late afterwards, the round's collected moves by exactly
the amount and Sunil turns Collected; Not paid on Kavita with its reason; a new
loan whose saved schedule is the one shown before Save; Messages · Late listing
every late loan with the server's amount and the lender's name; the Shop never
seeing a borrower.

## §9.4 Edge cases — Lending column

| Case | Lending |
|---|---|
| E1 double tap | pass (three fast taps = one collection; idempotency test) |
| E2 leave/reload | pass (monkey reload/return data check) |
| E3 address vs screen | pass (loan page reads its id from the address; monkey per loan) |
| E4 offline | pass (offline Save keeps the sheet, stores nothing; back online stored once) |
| E5 two devices | pass (loan row locked on every collection; more than left refused) |
| E6 totals | pass (round = loan pages = Messages lists; test_a_book_with_a_past_adds_up_by_hand) |
| E7 extra zeros | pass (refused, nothing stored) |
| E8–E9, E11 | n/a |
| E10 wrong book | pass (no Shop table; the Shop has no party for a borrower) |
| E12 undo | pass (removal row; a closing collection removed opens the loan again) |
| E13 back-dated | pass (a collection on an earlier day keeps its day) |
| E14 freezes | pass (monkey 3 × 2) |
| E15 reason shown | pass (more_than_left, borrower_exists shown in place; error case on every screen) |
| E16 settings | pass by the Library's check (same settings pattern) — not re-run here |
| E17 long text | pass (long Hindi name, ₹12,40,378 loan: round and loan page fit) |
| E18 slow lists | pass (API p95 under the monkey) |
| E19 finished can't change | pass (triggers: a collection and a schedule are never edited) |
| E20 double remove | pass (`already_removed`) |
| E21–E22, E25 | n/a |
| E23 overpaying | pass (more than left refused naming what is left; the last rupee closes the loan) |
| E24 print vs screen | n/a (no print; the receipt is the server's text) |
| E26 red on open | pass (Add borrower opens with nothing red) |
| E27 restyle breaks save | pass (every form saves in the harness) |

## Calculations by hand (owner, 12 Nov)

`test_lending.py` fixes "today" at Thu 12 Nov and checks against arithmetic in
the comments: a 40-day daily loan from 2 Nov skips Sundays and ends 17 Dec;
₹3,500 paid by 9 Nov leaves ₹1,000 late since 10 Nov and ₹500 due today, ₹16,500
left, 31 days to go; a weekly loan keeps its weekday; a monthly from the 31st
comes back to the 31st; a book of four loans adds up to ₹5,000 due today and
₹3,000 late over two borrowers; the reminder text carries "₹2,000 from 7 Nov".
Two of my own sums were wrong the first time and the code was right — the
comments now carry the corrected working.

## Found and fixed

0. **Typing "-" in an amount crashed the Collect sheet — in Lending AND the
   Library.** The Save label read the amount as typed while the validity check
   read the debounced copy, so for a moment "-" counted as valid and formatting
   it threw. Both sheets check the amount as typed now; both harnesses type "-".
0. **New loan said nothing when the server was down** (look sweep, error case):
   an empty borrower list instead of "could not load". It says so now, with
   Try again.
0. **"All routes  All routes"** by hand: the round card's title repeated the
   route the select beside it showed; the select is the title now.
0. **The morning bell** ("N loans became late today", 08:00, Messages) raised on
   the live stack named exactly the two loans whose first missed day was
   yesterday, in English and Hindi (`lending-shots/bell-*.png`).
1. Side by side: the phone New loan asked for the borrower again when started
   from one (the design names them in the subtitle), pushing the preview off
   the first screen; the desktop Today table filtered by chip where the design
   lists every stop.
2. The measuring tool first read the "Late" column heading as a badge; the
   badge itself measures exactly (9 / 2 px, 11.5 px semibold).

Departures, listed for the owner: the route control is a select where the
design draws "Change ▾"; there is no "Papers" button (nothing stores papers);
Collect has the date line the owner asked for in the Library.

## §8 score

| Points | Earned | Evidence |
|---|---|---|
| Business 2 | 2 | every figure read back by id after a skewed self-test; hand arithmetic in test_lending.py; triggers on schedule and collections |
| Design 1 | 1 | seven mocks paired; 17/17 parts measured; look sweep 828/828 |
| Functional 1 | 1 | the collector's day on screen; the round updates without a reload |
| User 2 | 2 | by hand on a phone (round, Collect arithmetic checked); monkey 3 × 2 with data checks; catalogue column |
| Data and recovery 1 | 1 | offline Save stores nothing then once; three taps write once |
| Performance 1 | 1 | API p95 ≤ 51 ms under the monkey |
| Honesty 1 | 1 | this report; harness and own-arithmetic mistakes named |
| Owner 1 | 0 | not yet seen by the owner |

**9/10.**

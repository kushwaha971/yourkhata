# Money Book module round (P0 §9) — 11–12 Nov 2026

The Money Book was deleted and rebuilt from scratch (commit c0a31e8): its own
app (`apps/moneybook`, `/api/v1/moneybook`, `/money-book`), its own tables,
owned by the signed-in person, with no relation to the Shop (owner: "in the
same way like one shop should not be related to another one"). Design: Part I
of the approved artifact (I1 People, I2 A person and an entry, I3 Reminder and
report). Plan: `docs/revamp/rebuild-money-book-library-lending.md`.

Local stack: web :3005, API :8000. Book: the scale owner's, seeded with the
design's sample people (`e2e/moneybook-seed.mjs`).

## §9.1 Every harness

| Harness | Result |
|---|---|
| `e2e/moneybook-round.mjs` (new; replaces ledger, statement, credit, tags, writeoff and wave1-reminders, which tested the retired shared book) | **97/97** at 390 and 1280 |
| Server `apps/moneybook` | 26/26 |
| Frontend unit suite | 5122/5122 |
| Server suite | green, except `dues test_run_scale` (5 000 schedules in a minute), which failed twice while a frontend build shared the CPU and passed twice alone — recorded as an intermittent timing test, not an app defect |

## §9.2 Module-wide monkey

`monkey.mjs --app=khata` now wanders every Money Book screen (People, a person,
Report for one person and for everyone, Reminders, Old dues) and checks after
every load and return that the person's balance and the book's To get are the
server's. The check was proved able to fail (`MONKEY_SKEW=1` → FAIL).

| Seed | 390 | 1280 |
|---|---|---|
| 111 | PASS · 98 data checks · p95 143 ms · worst 640 ms | PASS · 103 · 148 ms · 649 ms |
| 222 | PASS · 112 · 144 ms · 644 ms | PASS · 104 · 144 ms · 656 ms |
| 333 | PASS · 122 · 142 ms · 643 ms | PASS · 124 · 142 ms · 647 ms |

The first runs failed, and two of the reasons were the app's:

1. **A person's entries stayed on "0 entries" and grey rows for ~8 s.** When
   the entries arrived before the person (anyone not already in the loaded
   list), the slice compared them with the person in memory and dropped them.
   Entries and the person are now keyed to the latest request
   (`moneybookSlice.test.ts`, fails on the old slice).
2. **Every navigation queued behind 31 page prefetches** — one per "Open"
   link on the desktop list. "Open" is now a tap, as the phone rows were.

Two were the harness's: it counted a Back (a client move with no load event)
and a click that timed out under a sheet as page time, and it read the address
before its wait and the balance after it, so a page that moved meanwhile
compared two different people. Both fixed; a failing balance check now saves a
screenshot.

## §9.3 Whole-day journey

`moneybook-round.mjs` is the day: add a person (and one from phone contacts),
gave and got, the sheet's "After this" against the server, change an entry,
remove one, Show removed, the list and its To get, the report with filters,
Share and Print, the refused put-away, and the Shop never seeing the person.
Every figure is read back by id after a skewed self-test.

## §9.4 Edge cases

`edge-case-catalogue.md`, Money Book column: 27 rows, none "not run"
(8 n/a). Found and fixed here: **E7** — 99999999999 was told "Use up to two
decimals" (the shared validator checked shape before size; now size first, for
every amount field in the app, `moneyValidatorsRefuseNegative.test.tsx`); and
the sheet asked the server for an "After this" on every keystroke of an
invalid amount.

## §9.5 Hand pass (phone, Hindi, dark) — `docs/testing/moneybook-shots/hand-*`

1. People: "मेरी मनी बुक" in the header; To get / To give with people counts.
2. Suresh: "Suresh से ₹4,500 लेने हैं"; entries with the balance after each;
   the red and green pair.
3. Gave ₹500: "इसके बाद: Suresh से **₹5,000 लेने हैं**" before Save.
4. Remind: **found — the message was English on a Hindi screen** (the server
   used the account's saved language; H33). It now follows the screen's
   language (`test_the_reminder_is_written_in_the_language_on_screen`).

Owner checks during the round, each fixed and now guarded by a harness check:
the phone report hid the amounts (a five-column table ran off the screen →
a list with the amount on every row); filters moved into one drawer (period,
From/To, person, Apply); Share opens the phone's own share sheet with the
report as text; Filters, Share and Print are icons on the title's line at every
size (the desktop first drew them twice).

## Design (look sweep)

`shop-look.mjs --app=khata`: 5 screens × 320/390/1280 × light/dark × EN/HI and
after a server error at 390/1280: **460/460**.
Against the six mocks: matched; departures, each the owner's call on 11 Nov —
header "My Money Book" (Money Book only), app switcher kept in the bottom bar,
"Pick from contacts" in the scan slot, no "Attach report PDF" switch.

## §8 score

| Points | Earned | Evidence |
|---|---|---|
| Business 2 | 2 | every balance, total and report figure read back by id with a skewed self-test; entries locked by a database trigger |
| Design 1 | 1 | six mocks paired; look sweep EN/HI × light/dark × 3 widths × error |
| Functional 1 | 1 | the whole day on screen; other screens update without a reload; server reasons shown |
| User 2 | 2 | hand pass above; monkey 3 × 2 with its data check; catalogue column complete |
| Data and recovery 1 | 1 | offline Save keeps the sheet and stores nothing; three fast taps write once; reload/Back/return in the monkey |
| Performance 1 | 1 | monkey p95 ≤ 148 ms, worst ≤ 656 ms; forms load on demand |
| Honesty 1 | 1 | this report, harness defects named |
| Owner 1 | 0 | the owner found the hidden report amounts, the doubled icons and asked for the filter drawer during the round |

**9/10.** The owner point is not taken: three things the owner saw first are
exactly what this standard should have caught, and each now has a check.

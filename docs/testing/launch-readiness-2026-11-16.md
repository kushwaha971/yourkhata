# Launch readiness — what was left, and what was done (16 Nov 2026)

Owner, 16 Nov: "proceed all these what need to test or fix before launch".
The owner has tested real WhatsApp sign-in, and takes live hosting and the hands-on check.

## Go-live gate §11: the catalogue

Purchases, Payments and Items/stock had about 60 "not run" cells (the Shop round on 11 Nov filled only the Bill column). Every one now has evidence or a reason:
- `e2e/shop-edges-ppi.mjs`: server side, 59/59; `--skew` fails 5, which proves the read-backs can fail.
- `e2e/shop-edges-ppi-ui.mjs`: screen side at 390 and 1280, 16/16.
- E2, E3, E14 and E18 wait on the monkey set below.

## Defects found and fixed (each with a test that failed first)

| # | What a shopkeeper would hit | Fix |
|---|---|---|
| 1 | The same receipt sent twice at once, when the first was refused: **server 500** | idempotency.py: a key released between the claim and the read answers "try again" (409); `test_idempotency_race.py` |
| 2 | An item could take a price of ₹99,999,999,999, then could never be billed | Item prices keep the bill-line limit of ₹9,99,99,999.99; `test_items_api.py` |
| 3 | Ctrl+S on an empty purchase showed **"Must be a valid UUID."** | Nothing is sent for an untouched purchase; every server id field now says "Choose one from the list." Tests in jest and pytest |
| 4 | **A double tap on a purchase line's bin removed two lines** (desktop) | 400 ms guard in the shared line editor (as sales had); unit test |
| 5 | Receive money: tapping "Received" painted the empty amount **red** before Save | `blurIfTyped` on the first amount; unit test |
| 6 | 320 px: "Paid ₹12,40,378.00 · Record" and "Leave without checking" **ran off the sheet** | Sheet footer buttons wrap inside on phones; re-measured at 320 |
| 7 | Customers/Suppliers chips on a phone: only the 28 px face was tappable, not 44 px | Padding inside the chip scroller; re-measured |
| 8 | Purchases desktop: supplier bill number **cut mid-glyph** ("RKE-ELECTRIC") | The number wraps; re-measured |
| 9 | New loan at 320 px Hindi: start date cut to "17 नव॰ 2…" | The two fields stack below 380 px; LOOKED at 320 and 390 |

## Harnesses brought up to date with the redesigns (none deleted)

These were failing because Part F and later owner decisions changed the screens:
- `payments-register`, `revamp-purchases-register`: the status chips were dropped.
- `stock-reports`: the phone orders the whole list; Adjust stock moved to the item page; the test now uses its own business.
- `revamp-purchase-contracts`:
  - the "Add supplier" button;
  - Return moved into "Something wrong?";
  - a whole unit takes no point (owner, 27 Oct).
- `receive-payment`: now waits for the advance amount instead of a fixed 200 ms.
- `viewport-shop-registers`: chips are 28 px per the design, and chips hidden on desktop are skipped.
- `revamp-customers` measure: responsive screen-reader-only text is skipped.

Before each harness was updated, I checked that the feature still exists somewhere on screen (lesson H90).

## Hindi and dark mode for Library, Lending and Money book

`e2e/apps-look.mjs` checks 22 screens × 320/390/1280 × light/dark × EN/HI: **1452/1452 pass**, with samples LOOKED at.

## Gates on the final code

| Gate | Result |
|---|---|
| Regression | 23 harnesses, all pass (purchases, payments, items, stock, registers, A4 bills, switching/isolation 88/88) |
| Lending | round 64/64, measure 17/17 |
| Backend | full suite passes |
| Frontend unit tests | jest 4427 passed |
| Types | type-check clean |
| Translations | i18n in step |
| Bundle | inside budget |

## Still open

- **Lint:** `npm run lint` fails on 30 *warnings* in Library, Lending and app-switch files from earlier sessions, none from today. It needs its own clean-up.
- **Dues scale test (53–55 s of 60):** not a launch risk. No module registers with the dues engine, so the nightly run posts nothing.
- **Business days:** dormant by design.
- **Purchase line Undo:** removing a purchase line has no Undo, unlike a sales bill. Owner's call.
- **Phone Low stock: done (owner, 16 Nov).** A phone now chooses items too. "Choose items" opens a sheet with a tick per item and Tick all; "Order N items" makes one purchase order with only those items. `stock-reports` 48/48 checks it end to end: the URL and line hold only the ticked item at 17; rows ≥ 44 px; LOOKED at 390 EN and 320 HI dark.
- **Sign-in page error:** the earlier one-off still has no new sighting.
- **Monkeys:** Shop monkeys on Purchases, Payments and Items (3 seeds × 2 sizes) were running at commit time; their results follow.

## Rating

Each area tested here scores **9/10** on what was run:
- Purchases, Payments and Items/stock edge cases.
- Library, Lending and Money book in Hindi and dark mode.

Not 10, because:
- the monkey set is pending;
- the owner's hands-on check and live hosting are the owner's.

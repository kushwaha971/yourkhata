# Purchase registers on a phone · 23 Oct 2026 (R-DEC-33, R-DEC-34)

Scope: `/purchases/bills`, `/purchases/orders`, `/purchases/debit-notes` — one
shared `PurchaseBillsListPageContent`, so the three registers were built and
measured together. Purchase detail (§6), order → bill and returns are the next
piece and are NOT covered here.

## Spec-to-check map

| Requirement | Source | Check | Status |
|---|---|---|---|
| Phone joined cards, scroll-next, no pager on a phone | R-DEC-33, 09 §5 | `mobile-sales-contract.mjs --kinds=purchase-bills,purchase-orders,debit-notes` 390/320, light/dark: `pager:false`, 25 cards | passed |
| Failed next page keeps the cards; Try again 44 px; no auto-retry | R-DEC-33 | contract append-error; slice + page tests that fail on the old code | passed |
| New search resets to page 1; clearing returns | R-DEC-33 | contract new-query / query-reset | passed |
| Cards ≥ 60% of a normal phone | R-DEC-33 | before 47.0% (390, bills); after 64.6% at 390 and 61.5% at 320 (bills, debit notes), 64.6% orders at 320 | passed |
| Compact money strip, totals and counts from the server, kept while appending | 09 §5 | slice test: append keeps rows, totals, tab counts | passed |
| Desktop: bounded table, visible pager | R-DEC-30 | contract 1280 `tables:1, pager:true` | passed |
| EN and HI | owner rule | contract `--locale=hi`: 0 failures, 88 frames | passed |
| Real paging against the local API | gate 9 | `e2e/seed-purchase-flow.mjs` made 60 orders and 60 debit notes through the API so every register has a page 2 | passed |

Contract results: `data/2026-10-23-purchase-registers-phone/contract-pur-{before,en,hi}.json`
— 0 failures in EN and HI across 88 frames each (bills and invoices, 390/320/1280).

## Found by looking, fixed

- **Every debit-note card said "₹241.50 to pay".** A debit note is money the
  supplier owes back; the caption said the opposite. Now "₹241.50 open credit"
  ("बाकी क्रेडिट"), with a test.
- The money strip's figures carried an empty sign slot and pushed the 320 px
  strip to two lines; `RecordTotals compactShort` now uses `UbAmount inline`
  and tighter phone gaps (this also lifted Bills at 320 from 58.5% to 61.5%).

## Performance · old 5714a94 vs new, old/new/old/new × 3 reps

Data `data/2026-10-23-purchase-registers-phone/abp-*.json`. Content-ready ms, median (round medians).

| viewport | profile | case | old → new | rounds old / new |
|---|---|---|---|---|
| 390 | 4x CPU | Home → Purchases | 996 → 938 | 991,1000 / 909,966 |
| 390 | unthrottled | Home → Purchases | 201 → 196 | 186,214 / 202,165 |
| 1280 | 4x CPU | Home → Purchases | 1214 → 1289 | 1141,1260 / 1326,1252 |
| 1280 | 4x CPU | Purchases → New bill | 1044 → 1173 | 1064,1023 / 1171,1175 |
| 1280 | unthrottled | both | within ±25 ms | — |
| 390 | both | Purchases → New bill | **invalid** | the harness reported negative content times (content matched before the tap) on both sides; not used |

Phone open is a little faster in both rounds (−58 ms, small sample). **Open:
desktop at 4x CPU is slower in both rounds — +75 ms opening the register and
+129 ms opening New bill.** The desktop composition did not change in this
piece beyond the shared stack/summary classes, so the cause is not yet known;
recorded, not hidden, and no speed claim is made either way.

## Gates

Type-check, Jest 4,681 passed, lint (0 warnings), build, bundle check
(`/purchases/orders` and `/purchases/debit-notes` raised to measured + 0.3 KB),
i18n split/check (6,686 keys).

## Scores (purchase registers only, provisional)

| Point of view | Score | Evidence | Still weak | Confidence |
|---|---|---|---|---|
| Function | 8.6 | Contract EN/HI, append/failure/reset, real paging on seeded local data | Detail/returns not in scope | Medium-high |
| Busy shop | 8.4 | Cards 61–65% of a phone; status chips one row | — | Medium |
| UI/UX phone | 8.5 | EN/HI light/dark measured, wording fixed | Physical device not tried | Medium |
| UI/UX desktop | 8.2 | 1280 table and pager | Composition not revisited | Medium |
| Performance | 7.6 | Phone slightly faster | Desktop +75/+129 ms at 4x CPU, unexplained; phone New-bill timing invalid | Low |

Competitor comparison: none gathered — unproven. Not above 8.5 overall.

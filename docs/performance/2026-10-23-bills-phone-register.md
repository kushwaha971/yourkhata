# Bills register on a phone · 23 Oct 2026 (R-DEC-33, R-DEC-34)

Scope: `/sales/invoices` only, one feature under R-DEC-34. Customers, Suppliers
and Purchases registers remain PENDING under R-DEC-33. Commits 5a1a97e, 02bbebc
on dev (baseline 7b27948).

## Spec-to-check map

| Requirement | Source | Check | Status |
|---|---|---|---|
| Phone: joined cards, scroll-next, no page arrows | R-DEC-33 | mobile contract `pager:false`, 50 cards after append | passed |
| Sentinel inside the card scroll region, no eager page 2 | R-DEC-33 | contract `secondPages===0` at ready | passed |
| Failed append keeps cards, 44 px Try again, keeps scroll | R-DEC-33 | contract append-error / append-loaded | passed |
| New query / filter / origin resets the batches | R-DEC-33 | contract new-query, query-reset; slice test (origin) | passed |
| Compact header: title + New, one list search + Filters, 44 px global icon | R-DEC-33, 09 §1 | contract `searchFields:1`, 40/40 px, 44 px icon | passed |
| Status chips visible, 32 px face, 44 px phone hit | R-DEC-32 #3, 09 §1 | sweep chipSizes | passed |
| Money strip Billed and Due over the filtered set, count in All chip below md | 09 §1, owner 23 Sep | sweep summary present; RecordTotals `countInMobileChips` | passed |
| Card: party, number · date, status · "₹… due" when due ≠ total, amount right | 09 §1 | LOOK 320/390 EN/HI | passed |
| Cards ≥ 60% of a normal phone viewport | handoff | 390: 62.0%; 320: 58.5% (crore totals wrap to two lines) | **weak at 320** |
| Desktop: table and visible pager, rows scroll inside | R-DEC-30/33 | contract 1280 `tables:1, pager:true` | passed |
| No cut text, contrast, overflow; EN/HI, light/dark | R-DEC-32 #7 | `revamp-bills.mjs --kind=invoice`, 390/320/1024/1280 + Hindi 320/1280 | passed |
| N shortcut, URL filters, origin filter, hasAny first use | 09 §1 must-keep | existing page tests (12) | passed |

## What changed and why

- `invoiceListSlice` appends in a phone's mode (rows and totals kept while the
  next page loads or fails, overlap deduplicated) and replaces on a desktop.
  It also now keeps only the LATEST request's answer — before, a slow earlier
  reply for the same filters could overwrite a newer one — and a change of
  origin alone now clears the previous answer (it was not compared). Five slice
  tests; four fail on the previous slice.
- The page passes `afterRows` `UbLoadMore` on a phone, drops the pager there,
  keeps cards through an append, and resets scroll on a new question. A page
  test fails on the previous page (it found "Page 1 of" and no Show more).
- The phone summary is the one-line filtered total, count in the All chip
  (was count + two stacked money columns, three lines).
- Below 1280 px the table joins the date under the bill number and drops the
  Date column; the sweep had found long numbers cut mid-character at 1024 px.
  A page test fails on the previous columns.

Harness fix: `revamp-bills.mjs` clicked "Unpaid" when asked for "Paid" (substring
match) and then waited for a request that never came; chips are matched from the
start of their label now. The mobile contract now includes Bills.

## Gates

Type-check 0, lint 0, Jest 422 suites / 4,674 tests, build, bundle inside
budget (no raise), i18n check (6,685 keys).

## Performance · old 7b27948 vs new, old/new/old/new, 3 reps × 2 rounds = 6 per cell

`perf-app.mjs --only=nav --cases="shop.customers→bills,shop.bill row→detail"`;
data `data/2026-10-23-bills-phone/nav-ab-*.json`. Content-ready ms.

| viewport | profile | case | p50 old → new | p95 old → new | INP max | rounds old / new |
|---|---|---|---|---|---|---|
| 390 | 4x CPU | Customers → Bills | 1077 → 871 | 1360 → 1297 | 216 → 144 | 1076,1077 / 778,871 |
| 390 | 4x CPU | Bill card → detail | 1160 → 1172 | 1401 → 1424 | 88 → 72 | 1160,1084 / 1172,1128 |
| 390 | unthrottled | Customers → Bills | 170 → 164 | 208 → 461 | 72 → 56 | — |
| 1280 | 4x CPU | Customers → Bills | 907 → 1106 | 1515 → 1397 | 80 → 72 | 907,844 / 825,1106 |
| 1280 | unthrottled | Customers → Bills | 193 → 195 | 458 → 475 | 24 → 16 | — |
| 1280 | 4x CPU | Bill row → detail | 1141 → 1141 | 1489 → 1409 | 72 → 64 | — |

Phone 4x-CPU opening Bills is faster in both rounds (about −200 ms median),
consistent with three summary lines becoming one; the slowest input fell from
216 to 144 ms. Desktop 4x-CPU is mixed between rounds (825 and 1106 new against
907 and 844 old), so no desktop claim is made. Six samples per cell is small.

## Scores (Bills register only, provisional)

| Point of view | Score | Evidence | Still weak | Confidence |
|---|---|---|---|---|
| Function | 8.7 | Live API paging, append failure/retry, query reset, status/origin filters, N, URL filters | No new write workflow in scope | Medium-high |
| Busy shop | 8.4 | Cards 62% at 390; one search; status one tap | 320 px with crore totals 58.5%; 1024 header stacks on three lines | Medium |
| UI/UX phone | 8.5 | Sweep clean EN/HI light/dark | Summary wraps at 320 with crore totals | Medium |
| UI/UX desktop | 8.3 | 1024 numbers whole, 1280 table | 1024 header density | Medium |
| Performance | 8.4 | Phone open faster both rounds, INP lower | n=6; desktop mixed | Medium-low |

Competitor comparison: none gathered this session — any advantage over
Vyapar/myBillBook bill lists is **unproven**. Not above 8.5 overall.

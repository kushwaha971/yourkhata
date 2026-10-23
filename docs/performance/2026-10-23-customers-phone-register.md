# Customers register on a phone · 23 Oct 2026 (R-DEC-33, R-DEC-34)

Scope: `/customers` (Shop book) only, one feature under R-DEC-34. `/suppliers`
renders through the same component and passed the same contract, but its own
acceptance (LOOK of every state, supplier-specific copy, A/B) is the next
feature and is NOT claimed here. Purchases registers remain PENDING. Commit
b6aa7af on dev (baseline e0da36f).

## Spec-to-check map

| Requirement | Source | Check | Status |
|---|---|---|---|
| Phone: joined cards, scroll-next, no pager or pinned Show more | R-DEC-33, 08 §1 | contract `pager:false`, 50 cards after append (25 + page 2 from the response) | passed |
| Sentinel inside the card scroll region, no eager page 2 | R-DEC-33 | contract `secondPages===0` at ready; page test asserts the control is inside `ub-grid-scroll-region` | passed |
| Failed append keeps cards, 44 px Try again, no auto-retry, keeps position | R-DEC-33 | contract append-error / append-loaded; slice test; page test (failed first on the old page) | passed |
| Try again joins page 2 instead of replacing the list | R-DEC-33 | page test: Ramesh (page 1) and Sunita (page 2) both shown after retry; failed before the hook fix | passed |
| New search resets the batches; clearing it returns 25 | R-DEC-33 | contract new-query, query-reset | passed |
| Compact header: title + ⋯ + New, one list search + Filters, 44 px global icon | R-DEC-33, 08 §1 | contract `searchFields:1`, 56 px header, 40/40 px search/filter, 44 px icon; "Shop book" now sr-only below md | passed |
| Pressed chip visible, counts in chips | 08 §1 | contract `activeChipVisible` (harness now accepts `aria-pressed` toggles) | passed |
| One-line summary over the filtered set | R-DEC-33 | measured summary height 36–37 px at 390 and 320, EN and HI, with To pay non-zero (was 64 px at 320 EN) | passed (follow-up below) |
| Cards ≥ 60% of a normal phone viewport | handoff | 390 and 320: 61.5% (was 53% at 390) | passed |
| No-match state usable on a phone | 08 §1 EC | LOOK found both actions off-screen; fixed in `UbEmptyState`; script finds no off-screen empty-state button at 390/320 EN/HI | passed |
| Desktop: table and visible pager | R-DEC-30/33 | contract 1280 `tables:1, pager:true` | passed |
| Cut text, contrast, overflow; light/dark | R-DEC-32 #7 | contract measures every frame: 0 failures (Customers and Suppliers, 390/320/1280, light/dark) | passed |
| Hindi | R-DEC-32 #6 | contract `--locale=hi` at 390/320/1280 light/dark, plus LOOK | passed (follow-up below) |

## What changed and why

- `partyListSlice` records `appendFailed` when a phone's next page fails for the
  same question; the page keeps the cards instead of drawing the error state.
- `usePartyList` sends the first load, a stale refresh and Try again in one
  shape. Try again used to be sent as a replacement, which would have left a
  list holding page two alone.
- The phone grid uses `afterRows` `UbLoadMore` (automatic, retry in place) and
  drops the pinned "Show more (N left)" footer, which sat outside the scroll
  region and took a row's height from every screen.
- `UbEmptyState` actions wrap: "Add <name>" beside Clear filters ran off both
  edges of a 390 px phone. Found by looking; the contract's measures check
  text against its own box and could not see it.

## Gates

Type-check 0, lint 0 (full run 33 min), Jest 422 suites / 4,676 tests, build,
bundle inside budget after raising 77 routes by measured + 0.3 (max 0.3 KB over,
from `UbEmptyState`'s wrap classes and the party list's scroll-next), i18n check
(6,685 keys). Backend untouched.

## Performance · old e0da36f vs new, old/new/old/new, 3 reps × 2 rounds = 6 per cell

`perf-app.mjs --only=nav --cases="shop.home→customers,shop.customer row→person"`;
data `data/2026-10-23-customers-phone/abc-*.json`. Content-ready ms.

| viewport | profile | case | p50 old → new | p95 old → new | rounds old / new |
|---|---|---|---|---|---|
| 390 | 4x CPU | Home → Customers | 1311 → 1234 | 1834 → 1610 | 1357,1261 / 1255,1199 |
| 390 | 4x CPU | Customer card → person | 1322 → 1220 | 1880 → 1806 | 1311,1334 / 1242,1194 |
| 390 | unthrottled | Home → Customers | 800 → 765 | 1010 → 986 | 815,784 / 801,729 |
| 1280 | 4x CPU | Home → Customers | 1670 → 1575 | 2194 → 2386 | 1688,1516 / 1637,1513 |
| 1280 | unthrottled | Home → Customers | 820 → 862 | 1162 → 1087 | 952,796 / 843,880 |
| 1280 | 4x CPU | Customer row → person | 1274 → 1244 | 1876 → 1828 | 1289,1223 / 1264,1223 |

Phone 4x-CPU is faster in both rounds for both cases (about −80 to −100 ms
median), consistent with one footer and one summary line fewer, but the
rounds overlap for Home → Customers, so this is a small, not a proven, gain.
Desktop is mixed and no desktop claim is made. Six samples per cell.

## Scores (Customers register only, provisional)

| Point of view | Score | Evidence | Still weak | Confidence |
|---|---|---|---|---|
| Function | 8.6 | Live API paging, append failure/retry joins, query reset, chips, search | A stale refresh at page N refetches page N only; earlier cards are not refetched (same as Bills) | Medium-high |
| Busy shop | 8.4 | Cards 61.5% at 390 and 320; scroll instead of tap per batch | Remind button on every card takes a third of each card's height | Medium |
| UI/UX phone | 8.4 | Contract clean EN light/dark; HI LOOK | 320 EN summary wraps with To pay; Hindi only looked at, not measured by the contract | Medium |
| UI/UX desktop | 8.2 | 1280 table and pager unchanged | Desktop composition not revisited in this piece | Medium |
| Performance | 8.2 | Phone faster both rounds | n=6, overlapping rounds; desktop mixed | Low-medium |

Competitor comparison: none gathered this session — any advantage over
Khatabook/Vyapar/myBillBook customer lists is **unproven**. Not above 8.5 overall.

## Follow-up the same evening (owner: "fixed and proceed")

The two weak spots above are closed.

- **320 px summary on one line.** It was 22 px too wide, measured piece by piece:
  two empty 0.6em sign slots before each ₹ (only useful in a column of figures)
  and 8 px gaps. `UbAmount` gained `inline`, which drops the slot for an
  unsigned figure, and the summary tightens its gaps below 360 px. The strip now
  ends exactly at the gutter for ₹2,06,31,292.55 + ₹900.00; larger figures wrap
  rather than cut. Cards rose to 65.1% at 320 and 390 (were 61.5%). A
  `UbAmount` test fails without the prop.
- **Hindi measured, not only looked at.** `mobile-sales-contract.mjs --locale=hi`
  reads its button labels from the locale file and sets the locale cookie; 0
  failures for Customers and Suppliers at 390/320/1280 light/dark.
- **One harness race found, not an app defect.** In 1 of 9 runs the reset check
  counted cards a frame before React painted page 1 (re-reading gave 25). The
  check now waits up to 5 s for exactly 25 painted cards and still fails if it
  never gets there; 2 further full runs clean.

Gates: type-check, lint, Jest 4,677, i18n, bundle (one route,
`/library/attendance`, raised to measured + 0.3 for the `inline` prop).

A second timing batch for the Suppliers report re-ran Customer card → person at
4x CPU: 1624 → 1640 ms (rounds 1678,1476 / 1805,1624), so the −100 ms above did
not repeat and that case is **no change**, not a gain.

# Suppliers register on a phone · 23 Oct 2026 (R-DEC-33, R-DEC-34)

Scope: `/suppliers` (Shop book), its own acceptance after Customers. It renders
through the same `PartyListPageContent`, so the R-DEC-33 behaviour arrived in
b6aa7af/b0a1f33; this piece LOOKs at every supplier state, fixes what that
found, and times it. Purchases registers remain PENDING.

## Spec-to-check map

| Requirement | Source | Check | Status |
|---|---|---|---|
| Joined cards, scroll-next, no pager/pinned Show more | R-DEC-33, 08 §2 | mobile contract `--kinds=suppliers` 390/320, EN and HI, light/dark: 0 failures | passed |
| Failed append keeps cards, 44 px Try again, no auto-retry | R-DEC-33 | contract append-error/append-loaded; LOOK 390 dark | passed |
| New search resets; clearing returns page 1 | R-DEC-33 | contract new-query/query-reset | passed |
| Compact header, one search, 44 px global icon | R-DEC-33 | contract 56 px header, 40/40 px search/filter, 44 px icon | passed |
| You owe / Late / Advance with supplier chips; pressed chip scrolled into view | 08 §2 | LOOK script: Advance pressed and inside the strip at 390 EN, 320 HI | passed (seed has 0 suppliers in advance, so the advance list itself is the filtered-empty state) |
| One-line To pay summary | R-DEC-33 | LOOK and summary height 36–37 px at 390/320 EN/HI | passed |
| No match offers Add "name" and Clear filters on screen | 08 §2 EC | LOOK 390 HI: both buttons stacked, inside the viewport | passed |
| Pay on a card opens the pay sheet for that supplier, nothing saved | 08 §2, DEC-019 | LOOK 390 EN, 320 HI, 1280: "Pay supplier · Jain Agency 0", oldest bills first, amount = balance; closed without saving | passed |
| Desktop table and pager | R-DEC-30/33 | contract 1280 `tables:1, pager:true` | passed |

## Found by looking, fixed

- **Hindi pay sheet said "कैसे मिला" (how was it received) for a payment
  the merchant is MAKING.** The label is shared by Receive and Pay; English
  "How it was paid" fits both, Hindi did not. Now "कैसे भुगतान हुआ".
- **"Still due after this ₹0.00" was indented** by the empty sign slot of a
  figure that is not in a column; it uses `UbAmount inline` now.

Still visible, not changed: on a phone that footer label wraps onto two lines
("Still due after / this") inside its 100 px cap, so the Pay button keeps the
row; readable, not cut.

## Performance · old e0da36f vs new, 2 batches × old/new/old/new × 3 reps

Data `data/2026-10-23-suppliers-phone/abs-*.json`, `abs2-*.json`. Content-ready ms, median.

| viewport | profile | case | old → new | round medians old / new |
|---|---|---|---|---|
| 390 | 4x CPU | Home → Suppliers | 1120 → 1218 | 1065,1176 / 1115,1220 |
| 390 | 4x CPU | Supplier card → person | 1456 → 1678 | 1440,1269,1506,1295 / 1519,1717,1719,1639 |
| 390 | unthrottled | Supplier card → person | 597 → 525 | mixed |
| 1280 | 4x CPU | Supplier row → person | 1456 → 1530 | 1524,1469,1391,1444 / 1558,1624,1319,1490 |
| 390 | 4x CPU | Customer card → person (2nd batch) | 1624 → 1640 | 1678,1476 / 1805,1624 |

**Open, not explained: opening a supplier from a card on a 4x-slowed phone is
slower in all four rounds (about +220 ms median), with one or two more long
tasks per tap.** Same API and JS request counts on both sides, the person page
itself is unchanged, and the customer path through the same code was −100 ms
in the first batch and +16 ms in the second, so it is not yet attributable to
this change. Single taps range 1259–2096 ms new and 1291–2073 ms old. Recorded
rather than hidden; it needs a profiled trace before any speed claim either way.

## Gates

Type-check, lint, Jest (parties and payments 431; full 4,677 on b0a1f33), i18n,
bundle (`/library/fees` raised to measured + 0.3 for `UbAmount inline`).

## Scores (Suppliers register only, provisional)

| Point of view | Score | Evidence | Still weak | Confidence |
|---|---|---|---|---|
| Function | 8.6 | Contract EN/HI, chips, Pay sheet opens correctly with oldest-first | No supplier in advance in the seed, so that list was seen only empty | Medium-high |
| Busy shop | 8.4 | Cards 65% of a phone; Pay one tap from the card | Pay footer label wraps | Medium |
| UI/UX phone | 8.4 | EN/HI light/dark measured | — | Medium |
| UI/UX desktop | 8.2 | 1280 table and pager | Desktop composition not revisited | Medium |
| Performance | 7.6 | Unthrottled phone fine | Card → person +220 ms at 4x CPU, unexplained | Low |

Competitor comparison: none gathered — unproven. Not above 8.5 overall.

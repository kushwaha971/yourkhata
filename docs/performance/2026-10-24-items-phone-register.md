# Items list on a phone · 24 Oct 2026 (09 §8.1, R-DEC-33, R-DEC-34)

Scope: `/items` only. Item detail (§8.2), the item form (§8.3), stock
adjustment (§8.4), masters, price lists and the stock summary / low stock
pages (§8.5–8.7) are NOT covered and remain pending.

## Spec-to-check map

| Requirement | Source | Check | Status |
|---|---|---|---|
| Phone: search, then chips All · Low · Out of stock, then cards | 09 §8.1, R-DEC-30 | contract `--kinds=items` 390/320 light/dark EN/HI: one search, active chip visible | passed |
| Page fits the viewport; rows alone scroll; no pager or floating button on a phone | R-DEC-33 | before: page grew 1,689 px, pager, FAB; after: pageY 0, no pager, no FAB | passed |
| Next page joins; failure keeps cards with 44 px Try again, no auto-retry; new search resets | R-DEC-33 | contract append-error / append-loaded / new-query / query-reset; slice tests that fail on the old slice | passed |
| Card: name (wraps) · usual price; stock in words; code | 09 §8.1 | page test; LOOK 390/320 EN/HI | passed |
| Low/out in words, not colour only | 09 §8.1 Accessibility | "Low: 5 NOS left" warning tone, "Out of stock" error tone, both words | passed |
| Cost never on a card | 09 §8.1 Must keep | page test | passed |
| Scan / code + Enter opens the item; unknown code offers Create | FR-6/7 | `e2e/items-phone.mjs` | passed |
| Low chip asks the server and matches its count | gate 9 | harness: `stock=low`, 10 cards = server total 10 | passed |
| Desktop: tabs, bounded table, pager in reach | R-DEC-30 | contract 1280: table, pager visible, pageY 0 | passed (fixed a regression, below) |
| Kind disc on the card | 09 §8.1 | not on the phone: the shared stacked register card has no disc, and at 320 px the disc cost the name | deviation, recorded |
| Category on the card | — | moved to the filter; it was the text cut on every 390 px card | deviation, recorded |

Cards: 69% of a phone at 390 and 320 (contract `cardShare`), EN and HI.

## Found by looking, fixed

- **320 px:** names cut ("Atta 1004 b…", "318 NOS in …"): the inline card with a
  disc and a two-line price left the name about 90 px. Now the stacked shape,
  with the price one line under the name ("₹419.32 usual price").
- **Desktop pager below the screen:** bounding the page to the viewport showed
  that the tab panel did not pass its height to the table, so the pager could
  not be reached. Fixed; contract 1280 shows it.
- Two more header buttons (Low stock, Price lists) wrapped the desktop header
  to two rows; they are phone-⋯ only, as both are in the sidebar.

Seen, not changed: after an unknown code, the cards under the "No item with
barcode" banner are the unfiltered list for a moment.

## Performance · old 925b2b3 vs new, old/new/old/new × 3 reps

Data `data/2026-10-24-items-phone/ab7-*.json`. Content-ready ms, median (round medians).

| viewport | profile | case | old → new | rounds old / new |
|---|---|---|---|---|
| 390 | 4x CPU | More → Items | 792 → 874 | 775,810 / 921,830 |
| 390 | unthrottled | More → Items | 232 → 239 | 233,232 / 259,229 |
| 390 | 4x CPU | Item card → item | 910 → 920 | 943,876 / 960,879 |
| 1280 | 4x CPU | Bills → Items | 966 → 1077 | 976,957 / 1241,1005 |
| 1280 | unthrottled | Bills → Items | 284 → 284 | — |
| 1280 | both | Item row → item | **invalid** | the case looks for a button in the row; desktop rows open by a link |

**Open:** opening Items is slower at 4x CPU — on the phone by 146 ms in round 1
and 20 ms in round 2, on desktop by 265 ms in round 1 and 48 ms in round 2.
Round 1 carries most of it on both sizes, so it is not yet a stable regression,
but nothing here supports a speed claim. Unthrottled is unchanged.

## Gates

Type-check, Jest 4,686 passed (423 suites), lint 0 warnings, build, bundle
inside budgets, i18n (6,713 keys).

## Scores (Items list only, provisional)

| Point of view | Score | Evidence | Still weak | Confidence |
|---|---|---|---|---|
| Function | 8.6 | Contract EN/HI, journeys, slice tests | Unknown-code list not narrowed at once | Medium-high |
| Busy shop | 8.5 | Low/Out one tap; stock and price on every card | 320 px cards are four lines | Medium |
| UI/UX phone | 8.4 | Measured EN/HI light/dark | Disc dropped (deviation) | Medium |
| UI/UX desktop | 8.2 | Pager back on screen | Composition otherwise unchanged | Medium |
| Performance | 7.5 | Unthrottled flat | 4x CPU list open slower, round 1 heavy | Low |

Competitor comparison: none gathered — unproven. Not above 8.5 overall.

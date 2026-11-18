# Item detail · 24 Oct 2026 (09 §8.2, R-DEC-32, R-DEC-34)

Scope: `/items/[id]` only. The item form (§8.3), the stock adjustment drawer
(§8.4), masters, price lists, low stock and the stock summary (§8.5–8.7) are NOT
covered and remain pending. The adjustment drawer was only driven far enough to
post one entry from the new on-page button.

Who needs it: a shopkeeper or staff member asked "how many are left?" at the
counter, and the owner fixing a count after damage or a recount. Before, on a
phone, Adjust stock was hidden behind ⋯, the stock was a bare "318 NOS", and
the history was underline tabs whose rows said "Purchase" with no bill number,
one of them printing the raw id `stock.adjust.reason.void`.

## Spec-to-check map

| Requirement | Source | Check | Status |
|---|---|---|---|
| Order on a phone: stock → Adjust stock · Edit → price → history | 09 §8.2 Phone layout, "What matters most" | `e2e/item-detail.mjs` measures the order at 390/320, EN/HI | passed |
| Stock in words, large: "318 NOS in stock", "Low below 20 NOS"; out / below zero in words | 09 §8.2, Accessibility | page test; LOOK | passed |
| Several locations listed | 09 §8.2 | code path only: the QA tenant has one location | unproven |
| Adjust stock on the page, not in ⋯ | 09 §8.2 Fewer taps | journey: posts −1 Damage from the on-page button; server on-hand fell by exactly 1; the newest row reads "Adjusted: Damage"; the stock block moved | passed |
| ⋯ holds Edit and Archive / Restore and opens its drawer (17 Oct capture-phase defect re-test) | 09 §8.2 States | journey: ⋯ → Edit opens "Edit item" | passed |
| Usual price with GST ("incl. GST 5%" / "+ GST 5%") | 09 §8.2 | page test; LOOK | passed |
| Purchase price and margin only with `reports.financial.read`; margin from the two prices (`itemMargin`, never stored) | 09 §8.2 Must keep | page test with and without the permission | passed |
| Below-cost margin in words and warning tone, not colour only | 09 §8.2 Accessibility | page test "selling below cost" | passed |
| History as chips, each loading on its own tap | 09 §8.2 | journey: Sales chip replaces the movement list with its own panel | passed |
| A tab failing alone | 09 §8.2 States | page test: failed movements show "Couldn't load movements" + Try again, never "No movements yet"; Try again recovers | passed (was a defect) |
| Movement rows: date · words · ±qty · after | 09 §8.2 | LOOK; movementView tests | passed |
| Rows say which bill moved the stock and link to it ("Sold on INV-0418") | 09 §8.2 Navigation | needs BP-19 (the server does not name sale/purchase documents); built and tested on branch `bp-19-movement-sources`, not on `dev` | **awaiting approval** |
| No raw message id on any row | §0.1 | journey and page test, with and without BP-19 | passed |
| Archived banner with Restore | 09 §8.2 States | journey: Restore → active on the server | passed |
| Service: "Services have no stock", no Adjust stock | 09 §8.2 States | page test; journey | passed |
| Desktop: header Adjust stock, Edit, ⋯; stock and price left, history right | 09 §8.2 Desktop | LOOK 1280 | passed, with a deviation below |
| Offline: writes wait | §0.1 | Edit, Adjust, Archive disabled and a caption when the network is impaired | code path; not exercised live |
| No sideways scroll, no text cut, actions ≥ 44 px | R-DEC-30, gate 7 | harness at 390/320/1280 × EN/HI × goods/service/archived | passed |

Deviations, recorded:

- **Desktop Archive is a button, not ⋯.** The header has room for three
  actions; a desktop ⋯ for one action is an extra click.
- **History chips use `UbChoiceChips`, not `UbChipTabs`.** The spec names
  `UbChipTabs`, but that is the landing page's 40 px pill, which is neither the
  32 px chip face nor the 44 px target. `UbChoiceChips` is the register chip used
  everywhere else.
- **The opening-stock caption is gone from the stock block.** The same line is
  the bottom row of the history, with its quantity and cost.

## Found by looking, fixed

- **A raw message id on a movement row.** A purchase void writes `reason: "void"`
  on its reversal, and only the five adjustment reasons have a label, so the row
  read "Reversal · stock.adjust.reason.void". A reason outside that list is now
  never rendered. Without BP-19 the row reads "Reversal"; with it,
  "PB/26-27/1373 cancelled".
- **The title was squeezed on a phone** ("Reversal · stock.adjust.reaso") by the
  running figure beside it; on a phone that figure is now a caption under the date.
- **A failed movement load said "No movements yet"**, a false statement about the
  item. It now says it could not load and offers Try again, and a failed refresh
  with rows already shown says so under them.
- **The "Stock movements" chip pushed "Purchases" off a 320 px screen.** The chip
  is "Movements", as the spec has it.

## Performance · old 0dea7c1 vs new, old/new/old/new × 3 reps

Data `data/2026-10-24-item-detail/ab9-*.json`. Content-ready ms, median (round medians).

| viewport | profile | case | old → new | rounds old / new |
|---|---|---|---|---|
| 390 | 4x CPU | Item row → item page | 933 → **904** | 911,955 / 956,841 |
| 390 | unthrottled | Item row → item page | 182 → **170** | 177,186 / 177,149 |
| 390 | 4x CPU | More → Items (the list, unchanged here) | 807 → 865 | 788,829 / 904,843 |
| 390 | unthrottled | More → Items | 236 → 230 | 227,243 / 227,232 |
| 1280 | both | Item row → item page | **invalid** | the case looks for a button in the row; desktop rows open by a link (same as §8.1) |

The page this piece changed is no slower to open: −29 ms at 4x CPU and −12 ms
unthrottled, both inside the spread between rounds, so this is "unchanged", not
a speed-up. The Items LIST case repeats §8.1's open finding (+58 ms at 4x CPU,
round 1 heavy); nothing in this piece touches that list.

## Competitor comparison

Not done for this piece. Nothing here claims an advantage over another app; it
is unproven.

## Gates

Type-check, Jest **4,700 passed** (424 suites), lint 0 warnings, i18n, build,
bundle inside budgets after a raise, `e2e/item-detail.mjs` **94/94**,
`e2e/items-phone.mjs` 6/6.

Budget raise: `/items/[id]` route 109.9 KB (was 109.6) and first load 351.5 KB
(was 351.2), +0.3 KB each, for the movement words, the chips and the retry
state. `/set-password` first load measured 293.0x against a budget of 293 — the
shell drifted by under 0.05 KB and its own route chunk fell; the cause is not
traced. All three raised to measured + 0.3 KB.

The backend's own suite is green with BP-19 applied, including
`tests/performance/test_list_page_size_queries.py[item-movements]`, which failed
first: the new resolvers are one lookup per document type on the page, as the
khata's are, so the test now nets them out for `item-movements` the same way it
does for the khata. Three unrelated failures on this machine, present before the
change and still present with it stashed: a dues 5,000-schedule run at 70.8 s
against a 60 s ceiling, a library 20,000-copy close, and a parties promise-date
test whose fixture date is now out of range.

## Scores (item detail only, provisional)

| Point of view | Score | Evidence | Still weak | Confidence |
|---|---|---|---|---|
| Function | 8.5 | Journeys read back from the server: adjust, restore, edit opens | Rows name no bill until BP-19 is approved | Medium-high |
| Busy shop | 8.5 | Stock in words first; Adjust stock one tap from the page | History is long on a phone (50 rows a page) | Medium |
| UI/UX phone | 8.4 | Measured EN/HI at 390/320 | Several locations unproven | Medium |
| UI/UX desktop | 8.3 | Two columns, header actions | Archive is a button (deviation) | Medium |
| Performance | 7.8 | see above | | Low |

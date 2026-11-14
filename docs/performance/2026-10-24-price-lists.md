# Price lists · 24 Oct 2026 (09 §8.6, R-DEC-32, R-DEC-34)

Scope: `/items/price-lists` (`PriceListsPageContent`) and
`/items/price-lists/[id]` (`PriceListDetailPageContent`), the copy they and
`PartyPriceListControl` share, and `inventoryGridLabels`, whose signature
changed. The bill editor's list-rate line and the customer page control are
unchanged.

Who needs it: an owner whose wholesale or regular customers pay different
rates. The list is a rule ("5% below the usual price") plus a few exact
exceptions; a customer is put on it from their page, and their new bills start
from the list's rate.

## Spec-to-check map

| Requirement | Source | Check | Status |
|---|---|---|---|
| List, phone: name · rule ("5% below usual price") · "12 customers" | 09 §8.6 Phone | unit test; harness LOOK at 390/320 EN/HI | passed |
| List, desktop: a table of lists | 09 §8.6 Desktop | `UbDataGrid` table at 1280; harness checks a row's link opens its list | passed |
| Detail: rule card with Edit | 09 §8.6 Phone | unit test; harness edits -5 → -10 through the card and reads -10 back | passed |
| Pinned rates list: item · usual ₹450 → list ₹420 | 09 §8.6 Phone | card shows "Usual price ₹200.00" and "₹175.00"; the table adds "By the rule" | passed |
| "Pin a rate" row: item search + rate | 09 §8.6 | harness pins 180 and reads it back; picking an item shows its usual price | passed |
| Pin rate inline (Fewer taps); tap a pin to change it | 09 §8.6 | harness taps the row, changes 180 → 175, server holds one pin at 175 | passed |
| Remove a pin | 09 §8.6 Main actions | harness removes it; server holds none | passed |
| New price list | 09 §8.6 Main actions | harness makes one at -5% through the dialog | passed |
| Desktop detail: rule left, pinned rates table right | 09 §8.6 Desktop | harness measures the rule card left of the pin row at 1280 | passed |
| Customers are put on a list from their page | 09 §8.6 | unchanged `PartyPriceListControl`; unit test | kept |
| Bills for that customer start from the list's rate | 09 §8.6 Navigation, Must keep | harness puts a customer on the list (API) and reads `/price-lists/for-party`: the pinned item 175 (pinned), another item 95 (100 − 5%); the customer is put back afterwards | passed |
| Bill price still editable per line; rates apply to new bills only | 09 §8.6 Must keep | no change to the bill editor; the delete dialog still says "Bills already made keep their rates" | kept, not re-run here |
| First use "Make a list when some customers pay different rates" | 09 §8.6 States | the empty state says it | built |
| No write permission: read only | 09 §8.6 States | unit test: no pin row, no Edit, no remove | passed |
| Rule written as a sentence | 09 §8.6 Accessibility | "5% below usual price" and the explaining sentence; unit test | passed |
| No sideways scroll, no cut text, Pin rate and remove ≥ 44 px on a phone | R-DEC-30, gates 3 and 7 | harness at 390/320/1280 × EN/HI | passed |

## What changed

- **One word for the price.** The app calls an item's own price the "usual
  price" (item page, picker, items list); price lists said "selling price".
  Every price list string, and the customer page's "Usual prices" option, now
  says usual price, in English and Hindi.
- **The list** is a `UbDataGrid`: cards on a phone (name, rule, customers), a
  table on a desktop (adding how many rates are pinned), and no pager, because
  every list arrives at once.
- **The detail** is the rule first and its exceptions after: a rule card with
  Edit and a line saying how many customers are on the list, then "Pin a rate"
  and the pinned rates. Delete stays in the header (a ⋯ on a phone). The list's
  name wraps instead of being cut.
- **Pinned rates** show the usual price beside the list's rate; the table adds
  what the rule alone would charge, which is what the pin overrides. Tapping a
  pinned rate puts it in the pin row to change.

## Deviations and decisions recorded

1. **"Pinned", as the spec words it.** The old screen said "Fixed rate"; the
   spec says Pinned rates, Pin a rate, and Remove a pin, and the English copy
   now follows it. Hindi keeps "तय रेट", which reads naturally there.
2. **The bill line says "Wholesale rate"**, not "Wholesale list rate". The bill
   editor is outside this piece; the wording is close enough that I did not
   reopen it.
3. **Delete stays.** The spec's actions do not list it, but it exists and works,
   and removing a capability needs the owner's word (gate 10).
4. **The phone card's rate sits on the right with the remove button under it**,
   the grid's standard card layout, rather than the spec's inline "→".

## Found by looking

- On a 320 px phone the detail's title read "QA86 Wholesale MVL…": the list's
  name is what the page is, so it wraps now (`wrapTitle`).
- Both grids showed "Page 1 of 1" with two dead arrows under a list that never
  pages; the pager is gone.
- The desktop table's names were plain text, so a row was openable on a phone
  and not on a laptop (PTY-03 met the same thing). The name is a link in the
  table now, and the harness checks its address.
- The first build cost 3 KB more than it needed: `gridLabels.ts` named two
  items-catalogue keys, so every screen using it had to load the whole items
  catalogue. The ids are passed in now (`view-model/itemGridIds.ts`).

## Performance

Opening each page: from navigation until the list's name is visible, at 4x
CPU throttle, against `dcaddbc` (the old price list screens). Each side had 6
opens per page per round, 2 rounds alternating old and new, on a phone
(390×780) and a desktop (1280×900). Scripts and raw numbers:
`data/2026-10-24-price-lists/` (`plab.sh`, `plperf.mjs`; the first run before
the fix below is kept in `first-run/`).

| | old median | new median | n per side | new range |
|---|---|---|---|---|
| Phone, list | 1,004 ms | 939 ms | 12 | 781–1,440 ms |
| Phone, detail | 1,042 ms | 1,188 ms | 12 | 1,050–1,585 ms |
| Desktop, list | 978 ms | 975 ms | 12 | 835–1,039 ms |
| Desktop, detail | 1,175 ms | 1,131 ms | 12 | 976–1,329 ms |

**The first run found a defect in the shared grid, not in this piece.** The
desktop list opened in 1,652 ms against 940. A paint trace
(`data/2026-10-24-price-lists/paint-trace.mjs`) showed the rows arriving at
about 830 ms and the table painting at about 1,150 with nothing in between:
the grid reached its table through a `next/dynamic` wrapper, which suspends on
its first render even when the chunk has already loaded, and React keeps a
Suspense fallback on screen for at least 300 ms. Every desktop register paid
that on a fast list; the old price list was the first comparison that did not
already use the grid, so it was the first to show it. `UbDataGrid` now renders
the table directly once its chunk is here (`GridTable`), and these two routes
start the chunk while hydrating (`preloadGridTable`). After it the trace paints
the table at about 880–970 ms and the desktop list is level with the old
screen. A jest test could not reproduce the hold (the test build's dynamic
import does not suspend), so the evidence is the trace and the A/B, not a unit
test. Other registers should gain the same, but only price lists was measured.

**The phone detail is slower, by about 150 ms at 4x CPU** (both runs: +200,
then +146). The trace puts it before the request: the page's fetch starts
about 180 ms after the shell's own requests instead of about 50–120, which is
the larger route chunk (+6.5 KB, the grid) being loaded and run before the page
mounts. After the data arrives the new page paints faster than the old one
(about 240 ms against 280). Recorded rather than fixed: the grid is the
component the spec names for this list.

Bundle: `/items/price-lists` route +5.7 KB and `/items/price-lists/[id]` +6.5 KB
(the grid). Three other routes moved by 0.0–0.6 KB with the grid change
(`/sales/challans`, `/sales/orders`, `/admin/partners`); each exceeded budget
was raised to the measured size plus 0.3 KB, with a note in
`bundle-budgets.json`.

## Competitor comparison

Not done for this piece; unproven.

## Gates

- Jest: 4,729 of 4,729 passed, before the grid change and again after it.
- Type-check: passed. i18n split and check: passed.
- Lint (`--max-warnings=0`): the full run was clean; the grid and inventory
  files were re-linted clean after the grid change.
- Production build: passed. Bundle check: passed after the raises above.
- `e2e/price-lists.mjs` (new): 49 of 49 against the local QA stack.
- Regression after the grid change: `e2e/stock-reports.mjs` 44 of 44 and
  `e2e/items-phone.mjs` 6 of 6. The stock reports harness first failed on its
  own paging: `networkidle` settled before the next page's request was sent, so
  a tick landed on the previous page's row. It now waits for the response; the
  same lost tick reproduced on the build without the grid change, so the grid
  did not cause it, and a person tapping after the rows change is not affected.

## Scores (price lists only, provisional)

| Point of view | Score | Evidence | Still weak | Confidence |
|---|---|---|---|---|
| Function | 8.7 | Make, pin, change, remove, rule edit, delete, and the for-party rates all read back from the server | Bill line not re-run here | Medium-high |
| Busy shop | 8.2 | An owner's occasional screen; pin inline, tap to change | Not a counter task | Medium |
| UI/UX phone | 8.5 | Measured EN/HI at 320/390; the name wraps | Rate and remove stacked on the card (deviation 4) | Medium |
| UI/UX desktop | 8.6 | Rule left, table right; rows open by link | — | Medium |
| Performance | 7.9 | Desktop list level with old after the grid fix, desktop detail and phone list level or faster; phone detail about 150 ms slower, n=12 a side | +5.7 / +6.5 KB route chunks from the grid | Medium |

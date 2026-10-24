# Sales and Purchase registers · 24 Oct 2026 (09 §10.3/§10.4, R-DEC-32, R-DEC-34)

Scope: `/reports/sales-register` and `/reports/purchase-register`
(`RegisterReport`, `RegisterTotals`, the new `RegisterCards` and
`RegisterRowSheet`), the pieces they now share with the day book
(`ReportCardBands`, `ReportPager`, `view-model/reportBands.ts`), and one
design-system fix in `UbDataGridTable` that the desktop registers needed. The
server is unchanged.

Who needs it: the accountant filing GST each month and the owner checking a
month. What it saves them: the four figures without a tap, a day's total on its
band, and each bill readable on a phone without dragging a twelve-column table
sideways; the tax breakup is one tap away.

## Spec-to-check map

| Requirement | Source | Check | Status |
|---|---|---|---|
| Figure line: Bills · Taxable · GST · Total | 09 §10.3 Phone | page test; harness compares all four with the server's `meta.totals` (both books, 390 and 1280) | passed |
| What is still to collect / pay under Total; ITC under purchase GST | must keep (old tiles carried them) | page tests (sales "To collect", purchase "ITC" and "To pay") | passed |
| Level chip: By bill · By item | 09 §10.3 | existing Show dropdown, relabelled; page test; harness opens By item for both books | passed (deviation 1) |
| Cards by bill: contact · number · date · total; band by date with its total | 09 §10.3 | page test (two bands, cancelled bill not in the total, Quick Sale); harness: one card per server row, a band per date, each band's total equals the server's live bills for that date | passed |
| By item: a card per line titled by the item | 09 §10.3 | page test; harness compares every card's title with the server's `item_name` | passed |
| Row sheet: taxable, CGST, SGST, IGST, cess, round-off, GSTIN, place of supply | 09 §10.3 | page test; harness reads the words and the server's total in the sheet | passed |
| Row → document | 09 §10.3 Navigation | page test (credit note goes to its own route); harness follows Open to the bill page, both books | passed |
| Cancelled bills struck with the word "Cancelled" when included | 09 §10.3 States | page test | passed |
| Credit note negative, error tone, sign in the words | §8 | page test (accessible name and class) | passed |
| No sideways scroll, no cut text, no broken number at 320/360/390 EN/HI | 09 §10.0 | harness, both books | passed |
| Desktop: the existing wide table with totals | 09 §10.3 Desktop | harness at 1024/1280: table, no cards, last column reachable, page not wider than the window | passed (fixed, finding 1) |
| Cards are 44 px targets | R-DEC-32 gate 3 | harness | passed |
| Permissions; Export hidden without `reports.export`; empty book vs quiet period | must keep | existing page tests, unchanged | kept |
| Figures as returned; CSV unchanged | must keep | server untouched; figures compared live | kept |
| Totals as `dl` | 09 §10.3 Accessibility | `FigureBox` is a labelled group of figures, not a `dl` | not met (deviation 3) |
| Print | 09 §10.3 actions | not built | missing (deviation 4) |

## What changed

- **The answer first.** Bills, Taxable value, GST and Total in the ruled box
  the cash book and day book use, each with a caption: credit notes counted
  in the bills, ITC under purchase GST, To collect / To pay under Total. The
  "All totals" panel keeps every other figure (each head, round-off, paid,
  due, B2B/B2C, RCM, not claimable).
- **On a phone, cards under a band per date** with that day's total; a band
  that runs over the page edge says "On this page: Total …". By bill a card is
  the contact (or Quick Sale), the bill number, Credit note or Cancelled when it
  is one, and the total. By item it is the item, its bill and contact, and the
  line total. A pager sits under the cards.
- **The row sheet** has every column of the desktop table as label and value,
  and Open for the bill.
- **Words**: By bill / By item (was Documents / Lines), Cancelled (was Void),
  Show cancelled, Credit note (was CN), Bill (was Document), No bills match.

## Found by looking and by the live run

1. **The desktop registers hid their last columns at 1024 px**, and the
   purchase register did the same at 1280: Round-off, Total and Due sat past
   the edge of the table and could not be scrolled to. The grid gives the table
   `overflow-hidden` for its rounded frame, and tailwind-merge let that remove
   the `overflow-x-auto` the report had opted into. With that fixed, the page
   itself became 250 px wider than the window, because each money cell's
   screen-reader words are absolutely placed and escaped the static scroller.
   The scroller now keeps `overflow-x-auto` last and is `relative`. Both are
   covered by a design-system test that fails without the fix. The one other
   caller that opts in is the GST summary's sections, which get the same fix.
2. **By-item cards read "PB/26-27/1254 · —"** where the bill has no contact
   name. The empty piece is left out.

## Deviations and decisions recorded

1. **The level is the existing Show dropdown, not chips.** It was the
   owner-approved toolbar shape (one row of controls on a phone); only its words
   changed.
2. **The QA purchase bills have no supplier name.** The register reads it from
   the bill's saved contact snapshot, and the seeded purchase bills carry none,
   so their cards and the desktop table read "—". This is source data, not this
   screen; nothing is invented in its place.
3. **Totals are not a `dl`.** They are the shared `FigureBox` (a labelled group
   with each figure's label above it), the same as the cash book and day book,
   so the three read alike. Changing the shared box to a `dl` is a separate
   accessibility piece.
4. **No Print**, as for every report so far. It belongs in `ReportPageShell`
   once. Export (CSV) is unchanged.
5. **A desktop header no longer sticks to the page while scrolling down**, on
   the two registers and the GST sections only: a box that scrolls sideways also
   becomes a vertical scroll box in CSS, so its sticky header sticks inside it.
   Reaching the Total and Due columns was the bigger loss.
6. **Bundle**: both register routes 116.2 → 117.1 KB (first load 358.2 →
   358.9); the cards and bands are what a phone draws first, so they are not
   lazy. The row sheet is its own chunk. Budgets raised by measured + 0.3 with a
   note in `bundle-budgets.json`. The app shell is unchanged (241.9 KB).

## Performance

`data/2026-10-24-registers/rgab.sh` and `rgperf.mjs`: the production build of
dcaddbc (old) against this build (new), alternated over four rounds, six opens
per viewport per round, 4x CPU throttle, `/reports/sales-register?period=thisMonth`
(a page of 100 bills from 945 on the QA book), timed from navigation to the
first bill visible (a phone card or a table row in both versions). n = 24 per
cell.

| | old median (range) | new median (range) | |
|---|---|---|---|
| Phone 390 | 1,481 ms (1,239–2,139) | 1,311 ms (1,166–1,904) | −11.5%, ranges overlap |
| Desktop 1280 | 2,437 ms (2,192–2,921) | 1,935 ms (1,792–2,988) | −20.6%, ranges overlap at the top |

Both medians are lower. The phone ranges overlap almost entirely, so it is
recorded as level to slightly faster. The desktop table code is unchanged apart
from the scroller classes, and why it is faster has not been traced; it is
recorded as measured, not as a proven gain.

## Competitor comparison

Not done for this piece; unproven.

## Gates

| Gate | Result |
|---|---|
| `npx jest` (whole frontend) | 4,781 passed, 430 suites |
| `RegisterPages.test.tsx` | 16 passed; the four new ones (bands, By item, row sheet, pager) use test ids the old page did not have |
| `UbDataGrid` tests | 84 passed; the new scroller test fails without the fix |
| `npm run type-check` | clean |
| `npm run lint` (whole frontend, `--max-warnings=0`) | clean |
| `npm run i18n:split && npm run i18n:check` | pass |
| `npm run build` + `npm run bundle:check` | pass (deviation 6) |
| `node e2e/registers.mjs` (live stack, QA book, final build, read-only) | 139/139 |
| `node e2e/day-book.mjs` (the day book now renders through the shared bands) | 94/94 |
| Backend | not touched |

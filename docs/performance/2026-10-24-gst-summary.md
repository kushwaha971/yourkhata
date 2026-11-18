# GST summary · 24 Oct 2026 (09 §10.5, R-DEC-32, R-DEC-34)

Scope: `/reports/gst-summary` (`GstReport`, `GstSection`/`GstTable`,
`Gstr3bBoxes`, `GstReturnJsonButton`, the new `view-model/gstCards.ts`) and
`ReportCardRow`, split out of the day book's bands so the day book, the
registers and the GST sections share one card row. The server is unchanged.

Who needs it: the owner or accountant once a month before filing. What it
saves them: the one number to keep aside (net GST to pay) first and in view,
each section readable on a phone without a cut label, and the portal file
with what it is for and when it can be made.

## Spec-to-check map

| Requirement | Source | Check | Status |
|---|---|---|---|
| Figure line: Output GST · Input GST · Net payable; net first | 09 §10.5 Phone, Fewer taps | page test (order, figures); harness compares all four with the server at 390 and 1280 | passed (deviation 1) |
| Sections as collapsible panels | 09 §10.5 | `GstSection` folds; screenshots | passed |
| Section totals as label/value rows | 09 §10.5 | Sales by rate, Purchases by rate and HSN show their server totals first on a phone; the other sections have no server total | passed where the server sends one (deviation 2) |
| Section rows as cards: what · count · taxable · tax | 09 §10.5 | page test; harness: no grid cards and no table below 1024; each Sales-by-type card carries the server's taxable value | passed |
| GSTR-3B boxes as a stacked list on a phone, never a scrolling grid | 09 §10.5 Phone | page test; harness at 320/360/390 | passed |
| Desktop: sections as tables; 3B as the official grid | 09 §10.5 Desktop | harness at 1024/1280: tables, the 3B grid (box · taxable · IGST · CGST · SGST · cess), every last column reachable | passed |
| Download GSTR-1 / GSTR-3B JSON with "For the GST offline tool" | 09 §10.5 | page test; harness downloads last month's GSTR-1 file | passed |
| Open month: JSON disabled "Available after the month closes" | 09 §10.5 States | page test; harness on this month | passed |
| Download busy and single-flight | 09 §10.5 States | unchanged (`busy` disables the button) | kept |
| Box codes read with their meaning | 09 §10.5 Accessibility | 3B grid cells read "3.1(a) · Outward taxable supplies"; phone panels are titled by meaning with the code under | passed |
| Rows → documents | 09 §10.5 Navigation | a rate row opens the register lines (harness); an issue row opens its bill (page test) | passed |
| `reports.financial.read` only; figures, JSON shape, month rule untouched | must keep | existing tests; server not touched | kept |
| No sideways scroll, no cut text, no broken figure at 320–1280 EN/HI, all three views | 09 §10.0 | harness | passed (fixed, finding 2) |
| Print | 09 §10.5 actions | not built | missing (deviation 4) |

## What changed

- **Net GST to pay first**, then Output GST, Input GST (ITC) and Taxable
  sales, in the ruled figure box, each with a plain caption ("GST on your
  sales", "GST you paid on purchases", "GSTR-3B due 20/10/2026"). They were
  folded behind "Taxable sales … +3".
- **Section rows are cards on a phone**: what the row is (type of sale, state
  and rate, item and HSN, rate), its return table and bill count, and the
  taxable value with the GST on it underneath. Before, each was a grid card cut
  at "GST5 · 5% · Intra-s…" with one figure. A line that opens nothing is not
  drawn as a button.
- **Sections fold.** On a phone the coordinate badge sits under the title.
- **The file**: a full-width "Download GSTR-1 JSON" / "Download GSTR-3B JSON"
  under its return on a phone with "For the GST offline tool"; for a period that
  has not ended it is disabled and says "Available after the month closes". The
  server still decides and still answers in its own words for anything else.
- **Desktop GSTR-3B** is the portal's grid: one row per box, a column per head.

## Found by looking and by the live run

1. **Grid cards cut the section rows' names** ("GST5 · 5% · Intra-s…",
   "Biscuit 1566 1kg · B2C · 5…"), seen in the before screenshots.
2. **The GSTR-3B box titles were cut at 320 and 360 px** ("Inter-state
   supplies to unregi…") because the coordinate badge shared their row. The
   badge moved under the title on a phone; the harness clamp check caught it.
3. Desktop tables in these sections now really scroll sideways, through the
   grid scroller fix committed with the registers (9418505).

## Deviations and decisions recorded

1. **Four figures, not three.** Taxable sales is the fourth, as on the day book,
   so the 2 × 2 box has no hole and the owner keeps the figure the old tiles
   opened with.
2. **Section totals only where the server sends them** (rate and HSN
   sections). Summing the other sections on the client would be a total the
   server never stated.
3. **The GST on a card is the sum of the server's four heads**, added in exact
   paise (`sumMoney`); the heads themselves stay on the desktop table and the 3B
   boxes.
4. **No Print**, as for every report; it belongs in `ReportPageShell` once.
5. **Plain words**: "Output tax" → "Output GST", "ITC available" → "Input GST
   (ITC)", "Net GST payable" → "Net GST to pay", "in 1,644 documents" → "in
   1,644 bills". Return vocabulary (GSTR-1, 3.1(a), B2B, HSN) stays the
   portal's.
6. **The open-month rule on the client is only "the period runs to today or
   later"**. The server's rule (one whole ended month, no refused document) is
   unchanged and still answers a request the client lets through.
7. **Bundle**: `/reports/gst-summary` route 117.2 → 117.9 KB (first load
   359.0 → 359.8); `/reports/day-book` moved by rounding (+0.1 first load)
   through the shared card row. Raised by measured + 0.3 with a note.

## Performance

See the table below; `data/2026-10-24-gst-summary/gsab.sh` and `gsperf.mjs`:
dcaddbc (old) against this build, four alternating rounds, six opens per
viewport per round, 4x CPU throttle, `/reports/gst-summary?period=lastMonth`
(1,644 documents on the QA book), timed from navigation to the first section
row visible. n = 24 per cell.

| | old median (range) | new median (range) | |
|---|---|---|---|
| Phone 390 | 1,632 ms (1,522–2,413) | 1,591 ms (1,481–1,772) | level (−2.5%) |
| Desktop 1280 | 2,096 ms (1,604–2,738) | 2,144 ms (1,426–2,516) | level (+2.3%) |

Both differences are well inside the ranges; recorded as level. The phone's
slowest open fell from 2.4 s to 1.8 s, which is noted, not claimed.

## Competitor comparison

Not done for this piece; unproven.

## Gates

| Gate | Result |
|---|---|
| `npx jest` (whole frontend) | 4,784 passed, 430 suites |
| `GstSummaryPageContent.test.tsx` | 12 passed; the three new ones (figure order, section cards, phone 3B list) and the open-month assertion fail on the old page |
| `npm run type-check` | clean |
| `npm run lint` (whole frontend, `--max-warnings=0`) | clean |
| `npm run i18n:split && npm run i18n:check` | pass |
| `npm run build` + `npm run bundle:check` | pass (deviation 7) |
| `node e2e/gst-summary.mjs` (live stack, QA book, read-only) | 140/140 |
| Backend | not touched |

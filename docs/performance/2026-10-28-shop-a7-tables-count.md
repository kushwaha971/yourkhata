# A7 — Tables and the count line

> **Status: ready for the owner's check** (score below). Design: §A7 of
> `docs/revamp/design/shop-fixes-and-business-types.html` (mocks `dCustomers`,
> `pCustomers`; CSS `.tf`, `.countline`). Harness: `e2e/a7-measure.mjs`.

## Spec to check (from the design's own CSS)

| # | What | Design value | Check |
|---|---|---|---|
| T1 | Table frame | 12 px corners, 1 px line, `overflow: clip` (grey header follows the corners) | computed style |
| T2 | Header row | 46 px, 13 px / 600, 14 px side padding | computed, visible text element |
| T3 | Cells | 10 px 14 px | computed |
| T4 | Under the table | ONE line (last row none, pager's top line) | borders counted |
| T5 | Count line | 13.5 px, gap 4 px 16 px, ≥ 24 px; desktop "To collect ₹X · To pay ₹Y · Showing N of T customers"; phone "₹X to collect · Showing N of T" | computed + words |
| T6 | While a search loads | line keeps its place, figures are grey bars, "Searching…" (desktop), rows at 50 %, nothing moves | API held 1.5 s, positions measured |
| T7 | No match | "0 of 1,760 customers", line still there | words + position |
| T8 | Figures | from the API (matches, the whole list, to collect), with a skewed self-test | read back |
| T9 | Fit | no cut text, no page wider than the screen | measured |

## Baseline (before, `--tag=before`): 92 failures in 24 views

The header was 49 px at 14 px / 500 with 12 px padding, and the cells were 8 px 12 px.
The pager sat outside the frame with no line above it.
The count line was 14 px with 8 px gaps, and read "351 customers ₹… To collect in total Rows 1–25".
While a search loaded:
- the old numbers stayed up, with no loading look;
- the rows stayed at full strength (opacity 1);
- a 2 px progress bar pushed the rows down.

With no match, it read "0 customers ₹0.00 To collect…".

## What was built

- **The register's frame (design system, all seven Shop registers):**
  - the rows and the pager share one frame (`REGISTER_FRAME`);
  - the header and cells use the design's sizes (`REGISTER_TH` / `REGISTER_TD`);
  - registers have no 2 px busy bar, and rows dim to 50 % while loading.
- **`UbCountLine`** is a new design-system component. It holds translated
  sentences with `{slots}`, so Hindi word order works. While loading, the
  figures become grey bars and the words stay, at ≥ 24 px. The design reuses it
  for stock, items and batches (Part F).
- **The Customers and Suppliers count line** uses the design's words, with
  plurals.
  - "Of T" is the whole list before the search. The chips' counts follow the
    search ("All · 0" for no match), so the total seen with no search typed is
    kept. Opened straight onto a search, the line says "26 customers".
  - The "on this page" note is kept only when the totals are just a page sum.
    That is not in the design, but a page sum shown as the whole book would be
    false.

## Defects found, none by a unit test

1. **"Showing 0 of 0 customers"** with no match, found by looking. The first T7
   accepted "0 of" plus any number, so it passed (H27). T7 now requires the API's
   unfiltered total, and it failed on that build.
2. **The line stayed grey for ever** when the list counts were missing (a
   server without counts). It now says "26 customers".
3. **"1 customers":** the counts use plurals now.
4. **The rows moved 30 px on a phone while loading.** "Searching…" wrapped the
   line to two rows. The note shows on desktop only, as in the mock.
5. **At 1024 px the bill's saved-customer box was 20 px wide.** Its three-column
   row (300 · 1fr · 360) left nothing in a 742 px card, so the name, number and
   Change vanished, and "More details" covered the box. Found by looking in the
   browser pane at its own width; A3's check measured only 320, 390 and 1280.
   Three columns now start at 1280, and the A3 check covers 1024 and 1152.
6. **A box that shrank 20 px** for a contact with no mobile. The empty slot
   stopped line 2 wrapping once loaded. It now says "No mobile number".
7. **At 1024 in Hindi, "भुगतान करें" was cut** in the actions column. The shares
   are now 24 / 20 / 18 / 18 / 20. At 14 % "Last Shop activity" wrapped to three
   lines and made the header 48 px; found by the 1024 run.
8. **A phone number broken mid-number** ("+91 90000 | 00074") at 1280, after
   the share change. The number's spaces are now non-breaking.

## "Owe" replaced with simple words (owner, 28 Oct: "update owe like get/give")

- **84 English strings and the sign-in screen's line:**
  - "To collect / To pay" in the Shop;
  - "You will get / You will give" elsewhere;
  - "I will get / I will give" for an old balance;
  - "still to pay / left to collect" in Library and Lending.
- **Server messages people see:** errors, import help, filter labels, and the
  settlement message a customer receives ("…of what you have to pay us against
  what we have to pay you").
- **Hindi:** the "You will get / give" family rule (`hindiDirection.test`) now
  covers the two aging cards that took those words.
- **Tests:** 49 unit tests and 8 harness lines were updated to the new words.
  `defects2-qa` and `sprint3-qa` still look for words that were gone before
  today; they are stale and listed, not touched.

## Results

- `a7-measure`: **32 views** (390, 320, 1024, 1280 × light/dark × EN/HI) × both
  lists: 0 failures, 0 console errors; `--skew` fails as it should.
- The other Shop registers at 1280 (Bills, Payments, Purchase bills, Expenses):
  T1–T4 pass. Estimates has no rows in the QA shop and is skipped.
- **Side by side:** `compare-a7.png` (dCustomers and pCustomers in the loading
  state) was looked at; the count line matches.
- **Hand-driven** (browser pane, phone):
  - "iyer" read "₹1,68,819.39 to collect · Showing 26 of 353";
  - "To collect" chip: "Showing 21 of 353";
  - opened on `?q=iyer`: "26 customers";
  - the server agrees on both totals;
  - the new chips read "To collect · 231" and "To pay · 38".
- **Unit:** the whole suite passes (4,949 tests; files that timed out under
  load passed on their own).
- **Backend:** the suites whose messages changed pass.
- **Bundle:** inside budget. Twenty-four routes moved 0.0–0.2 KB; `/parties/[id]`
  moved +1.1 KB, which is the parties word catalogue it loads. Raised with a note.

## Conflicts for the owner (listed, not chosen)

1. **Mock layout outside A7's three items:**
   - on desktop the design puts the search inside the frame, with "Show:
     Active / Balance: All" dropdowns and no chip row;
   - the design's columns are Customer, Balance, Due, Mobile, Status; the app
     has Late by, Last Shop activity and Remind;
   - the subtitle "Everyone who buys from you." vs "Shop book";
   - phone rows are more compact in the mock.

   These are the register's whole layout, for Part F.
2. **The other registers' count lines** (Bills, Payments, …) are not built;
   they are Part F's, with `UbCountLine`.
3. **The A8 slow page** (seed 64 and others, about 8 s on a "return" or the
   dashboard) is still open, for A8.

## Final regression (P0 §10), on the last build

a7-measure 32 views · a6-forms 24 · a5-measure · a3-customer-box-look 70 (now incl. 1024/1152) · a3-functional · a4-money · a4-remove-undo · a4-functional · a4-edges 11/11 at 390 and 1280: all pass, 0 console errors. Monkey Customers and Suppliers seeds 111–113 at 390 and 1280: **12 of 12 PASS**.

## Score sheet (P0 §8)

| Points | Earned | Evidence |
|---|---|---|
| Business 2 | 2 | Count-line figures read back (matches, the whole list, to collect) with a skewed self-test; the chip and search cases agree with the server |
| Design 1 | 1 | T1–T9 in 32 views and the other registers; side by side with dCustomers/pCustomers; departures listed |
| Functional 1 | 1 | Loading, no match, missing counts, straight-onto-a-search; nothing moves while loading |
| User 2 | 2 | Hand-driven pass on a phone; monkey 12/12 on the final build |
| Data 1 | 1 | No figure is claimed that the server did not send (page-sum note kept, "of 0" and endless grey fixed) |
| Performance 1 | 1 | Bundle inside budget; +1.1 KB on /parties/[id] traced to its word catalogue |
| Honesty 1 | 1 | This report, eight defects of my own finding included |
| Owner found nothing 1 | 0 | The owner's |
| **Total** | **9.0 / 10** | **Ready for the owner's check** |

# A5 — Spacing inside drawers and sheets

> **Status: READY FOR THE OWNER'S CHECK — 9.0/10** (P0 §8, §10). Not "done"
> until the owner has tried it.
> This file opened with the spec to check, written before any code (P0 gate 1). Every row is
> measured on the running app at 390, 320 and 1280, light and dark, EN and HI,
> including with errors showing.

Design: §A5 of `docs/revamp/design/shop-fixes-and-business-types.html` (the
live artifact is the reference; re-check that the copy is identical before
building). Mocks: `pDrawer` (phone sheet, 90 % high) and `dDrawer` (desktop
right drawer, 480 px), both "Edit customer". CSS: `.sheet`, `.shead`,
`.sbody`, `.sfoot`, `.grp`, `.gt`, `.fld`, `.lbl`, `.inp`, `.hint`, `.swr`,
`.btn`.

## Spec to check (from the design's own CSS)

| # | What | Phone | Desktop | Source |
|---|---|---|---|---|
| S1 | Label → its box | 6 px | 6 px | `.fld{gap:6px}`; table "Label and its box" |
| S2 | Box → its hint or error | 4 px | 4 px | table "Box and its hint or error" |
| S3 | One field → the next, inside a group | 16 px | 16 px | `.grp{gap:16px}` |
| S4 | One group → the next | 24 px | 24 px | `.sbody{gap:24px}` |
| S5 | Group title | 12 px, weight 700, letter-spacing .06em, uppercase, ink-3 | same | `.gt` |
| S6 | Label text | 13 px, weight 600, ink | same | `.lbl` |
| S7 | Field height | 44 px | 40 px | `.inp` / `.dk .inp` |
| S8 | Field font | 15 px | 14 px | same |
| S9 | Field border, radius, padding | 1 px line-strong, 8 px, 0 12 px | same | `.inp` |
| S10 | Switch row | min 48 px, gap 12, no extra margin | same | `.swr` |
| S11 | Edge → content | 16 px | 20 px top, 24 px sides | `.sbody{padding:16px}`; `.drawer .sbody{padding:20px 24px}` |
| S12 | Header | 56 px, padding 0 8 0 16; title 17/600, sub 12.5 ink-3 | 60 px, padding 0 12 0 24 | `.shead`, `.dk .shead` |
| S12b | Close button | 40 × 40, radius 10 | same | `.ib` |
| S13 | Footer | grid 1fr 2fr (Cancel, Save wider), gap 8, padding 12 16 14, top line | flex end, padding 14 24, Save last | `.sfoot` / `.dk .sfoot` |
| S14 | Buttons | 46 px, 15 px (`.btn.lg`); radius 8, weight 600; Save cta, Cancel soft | 40 px, 14 px | `.btn`, `.btn.lg` |
| S14b | Hint / error text | 12.5 px ink-3; an error is red, weight 600 | same | `.hint`, `.hint.err` |
| S14c | Fold-out (More details) | min 52 px, padding 10 16, radius 12; open body 16, gap 16 | same | `.acc`, `.acc-h`, `.acc-b` (A2) |
| S15 | Phone sheet | radius 18 18 0 0, max 92 % (mock 90 %), grab handle 36 × 4 | — | `.sheet`, `.grab` |
| S16 | Desktop drawer width | — | 480 px | §A5 "right drawer, 480 px" |
| S17 | Applies to | `PartyFormDrawer`, `ItemFormDrawer`, `PaymentFormDrawer`, `StockAdjustmentDrawer`, and every `UbDrawer`/`UbSheet` body | | §A5 "What changes" |

## Baseline, measured before any change (`e2e/a5-measure.mjs --tag=before`)

On the live app, Add customer at 390:

| Value | Now | Design |
|---|---|---|
| Header | 100 px tall (with its description), padding 16 all round | 56 px, padding 0 8 0 16 |
| Label → box | 4 px | 6 px |
| Field → next field | 4 px gap, plus a 20 px empty message row always reserved: 24 px | 16 px |
| Field height | 40 px | 44 px |
| Footer | stacked, two full-width buttons (356 px each) | side by side, 1fr : 2fr |
| Desktop drawer | 520 px | 480 px |
| Stock adjust at 1280 | a 900 px centred dialog | — (not a drawer in the design; listed) |

The project's spacing tokens differ from stock Tailwind on a phone, so exact
pixel values are written, never read off class names (H12).

**Conflict for the owner (listed, not chosen silently):** every field
reserves an empty 20 px message row, an earlier deliberate choice so a form
does not jump when an error appears. The design's 16 px between fields
leaves no room for it. The build follows the design (the P0 rule is
pixel-exact), so an error now pushes the fields below it down.

**For A6, not A5:** the design's contact mock groups Name and Mobile under a
"BASIC" group title (`.gt`). Our contact form's content (Tags, GST and address,
the sections) differs from the mock throughout, and rebuilding that content is
A6's piece (separate customer and supplier forms). A5 sets the spacing every
form uses, including the group-title style when A6 adds titles.

**Kept, and listed:** the stock adjustment drawer stays 900 px wide on desktop,
because its seven-column item table needs it (the design itself has a wider
`.drawer.w560`), and its table rows keep compact 32 px boxes. Phone text
fields stay 16 px, against the design's 15, because iOS Safari zooms the page
on any field under 16 px (docs/mobile-redesign 04 §3). Desktop uses the
design's 14 px. Counter mode's payment sheet keeps its "left to pay" footer,
from the separately approved Counter Mode design.

## Edge cases to run (written before building; `e2e/a5-edges.mjs`)

From the habits and catalogue:
- **Text:** long labels and Hindi, with every box's text inside its box (H18).
- **Errors:** an error under EVERY field, each in its own space, never
  squeezed (H4), and S2 measured with the error showing.
- **Phone keyboard and a 600 px tall screen:** the footer stays reachable and
  the focused field is not hidden.
- **Double-tap Save:** one record (H14).
- **Leaving and returning:** open a drawer, leave, come back.
- **Saves still work after the restyle:** each drawer's record is read back
  from the API by its id, with a self-test (H2, H3, H20).
- **Alignment:** labels and boxes on one left edge to within 1 px (H19).
- **Measured as a touch phone:** tap areas 44 px (H13).

## What was built

- **The dialog primitives** (`mlOverlayPrimitives`) carry the standard for
  every drawer, sheet and dialog, at the design's exact pixels:
  - header: a 56 px row on a phone, 60 px on desktop;
  - body: 16 px from the edge on a phone, 20/24 on desktop, 24 between groups;
  - footer: two buttons side by side 1:2 at 46 px on a phone, right-aligned
    at 40 px on desktop. A note takes its own row. Three or more buttons stack
    as before (D-L6 kept);
  - the drawer is 480 px wide; the phone sheet has 18 px top corners and a
    36 × 4 grab handle;
  - the close button is 40 px with 10 px corners and 44 px to tap.
- **Inside a dialog only** (one block in `globals.css`, scoped to
  `[role=dialog]`, so page forms keep their spacing until they have a design):
  - label 6 px above its box, 13/600;
  - hint or error 4 px under the box, 12.5 px, an error at weight 600;
  - field to field 16 px, a field to a fold-out 24 px;
  - boxes 44/40 px; switch rows 48 px.

  Marker attributes (`data-ub-field`, `data-part`, `data-ub-form`,
  `data-ub-switch-row`, `data-ub-disclosure`, `data-ub-dialog-header`) are what
  the rules target.
- **The four form drawers take the standard instead of their own margins:**
  - Receive payment (list view) gets Cancel and Save as its footer;
  - Adjust stock's summary takes its own row;
  - the retired "compact overlay" density had padded every panel child 16 px
    (it overrode the desktop values and made the grab handle 32 px tall), as
    had the filters sheet's copy of it.

## Defects found while building, none by a unit test

| # | Found by | Defect | Fix |
|---|---|---|---|
| 1 | measuring the baseline | The spacing tokens differ from stock Tailwind on these panels: `p-6` measured 16 px, so class names misread the spacing | the real cause was #3; exact pixels are written now |
| 2 | LOOK at the phone sheet | The grab handle showed as a grey 36 × 32 block | #3 |
| 3 | CDP matched-styles on the handle | `COMPACT_OVERLAY_CLASSNAME` (`[&>div]:p-4`), on about a dozen drawers and dialogs, padded EVERY panel child 16 px, overriding the design's desktop padding | retired to an empty class, and the filters sheet's copy removed; a test fails if it returns |
| 4 | side-by-side with pDrawer | Hint text stayed 14 px: the size was set on its row, and the hint's own style beat it | set on the hint itself; the hint size and the label's size and weight are now measured |
| 5 | my harness | sr-only labels (1 px) read as "0 px" gaps and a second left edge; the party search matched loosely, so a count could pass wrongly | visible labels only; exact-name counts with a self-test |

## Results so far

- **`e2e/a5-measure.mjs`, the spec checks:** PASS in all 48 views (4 drawers
  × 390/320/1280 × light/dark × EN/HI). Listed, not passed: the stock
  drawer's 900 px and its 32 px table boxes.
- **Behaviour:** a double-tapped Save makes one contact (exact-name read-back,
  with a self-test); a tap outside a half-filled drawer keeps it and its text;
  on a 600 px-tall phone the footer stays on screen with the last field
  focused (390 and 320).
- **Unit tests:** the drawer width, corners and grab handle; the footer
  layout; the header and close button; the retired compact class. Each fails
  on the old code.
- **LOOKED at:** every drawer on a phone, Hindi dark at 320, desktop, and the
  side-by-side with pDrawer and dDrawer.

## Regression of every delivered feature (P0 §10)

On this build:
- A1 look (10 views) and A2 look (50 views) pass.
- A4: look 10 views; remove and Undo, 8 views; limits and snackbar; edges
  11/11 at 1280 and 390; money and the functional journey at both sizes. All
  pass, including the bill's payment sheet, which uses the dialog primitives
  A5 changed.
- **A3: two harnesses had been broken since A4, and were found only now:**
  - `a3-functional` (phone) opened the next bill through the app header's
    search, which A4's phone bar (R-DEC-55) removed from the bill screen. It
    now goes the way a merchant does: ×, then Customers, search and open.
  - `a3-customer-box-look` (1280) still expected 300 · 1fr · 360, the layout
    before R-DEC-53 moved More details to the side column. It now expects
    dBill's 300 · 1fr.

  Both pass now, 40 views and both sizes. Neither was a product defect; both
  went unnoticed because A4 shipped before §10 existed (learning-log H22).

## Monkey (`e2e/monkey.mjs`, 300 steps, drawers open by chance)

Customers at seeds 501, 4401 and 7713 × 390 and 1280, and Items at seed 501
× 390 and 1280: 8 of 8 pass, with no page or console errors, no refused
saves and no freeze.

## Found by the hand-driven pass

| # | Defect | Fix |
|---|---|---|
| 6 | Add item: flipping "Selling price includes GST" painted the untouched, auto-focused name red ("Enter an item name.") before any Save. The contact drawer had the same trap (the LED-01 class of "a drawer opened in a red state") | `blurIfTyped`: an empty name never typed is checked on Save, not on the way out; a typed one is still checked as the merchant leaves. Unit test, plus a live check that failed on the old build and passes now |

## Saves still work after the restyle (read back from the API)

At 390, 320 and 1280:
- **Add customer:** a double-tapped Save makes one contact, matched by exact
  name, with a self-test that the count can be 0.
- **Add item:** one item at ₹25.00.
- **Adjust stock:** "Damaged −1" takes on hand down by exactly 1 each run
  (170 → 169 → 168 → 167).
- **Receive payment:** covered by A4's money and journey harnesses, which
  pass.
- **A reload with a half-filled drawer** saves nothing.

## Speed

Measured against a real baseline: the commit before A5 (9206d9718) was
built in a temporary worktree, served on :3001 beside the A5 build on :3000,
and timed alternately, 5 samples each, at 390, from the tap to the drawer's
first field visible.

| | First open (median) | Warm reopen (median) |
|---|---|---|
| Before A5 | 839 ms | 49 ms |
| A5 | 845 ms | 54 ms |

Both builds' first opens vary between ~390 and ~850 ms as the drawer's code
loads, and the difference is inside that noise: no cost added. How long a
first tap takes is A8's piece. The bundle is within budget after raising the
editors 0.3 KB for the footer's new classes.

## Regression note (P0 §10)

A3's look check now reports one failure, and it is not caused by A5. A
five-figure balance ("₹10,306.75 to collect") wraps the customer box to three
lines on a 390 px phone, so the box grows 20 px when the balance arrives.
Today's data changed which customer the check picks. Listed for the owner as
**FB-022**, with three options; every fix changes the design.

## Score sheet (P0 §8)

| Points | Earned | Evidence |
|---|---|---|
| Business 2 | 2 | Every form drawer saves after the restyle, read back by its record (exact-name and per-id, with a self-test); a double Save makes one; a reload saves nothing half-done |
| Design 1 | 1 | `a5-measure` passes S1–S16 in 48 views (4 drawers × 3 sizes × light/dark × EN/HI); side-by-side with pDrawer and dDrawer; departures listed (stock 900 px and its table boxes, 16 px phone fields for iOS, the "BASIC" title for A6, the reserved message row) |
| Functional 1 | 1 | Errors in their own space, Cancel asks before losing typing, the footer stays reachable on a 600 px phone, and no false red on an untouched name |
| User 2 | 2 | Manual pass by hand on a phone (8 steps, screenshots looked at); monkey 8 of 8 (Customers 3 seeds × 2 sizes, Items × 2) |
| Data 1 | 1 | A tap outside keeps a half-filled drawer; Cancel asks; a reload leaves nothing half-saved |
| Performance 1 | 1 | Open time against a built pre-A5 baseline, alternating samples: 845 vs 839 ms first, 54 vs 49 ms warm; bundle within budget |
| Honesty 1 | 1 | This report, including the harness defects, the FB-022 finding and the listed departures |
| Owner found nothing 1 | 0 | The owner's to give, after trying it |
| **Total** | **9.0 / 10** | **Ready for the owner's check.** The last point is the owner's to give |

**Open for the owner:**
1. The reserved message row: follow the design (an error now pushes the
   fields below it down), as built, or keep the old no-jump row.
2. Stock adjust stays 900 px wide.
3. FB-022.

# A4 — Adding items to a bill (FB-014) and line limits (FB-020), 26–27 Oct 2026

Design: https://claude.ai/artifact/RsYjPpq2t3zCTMu5iUSvNm §A4, copied at
`docs/revamp/design/shop-fixes-and-business-types.html`. Mocks: `M.pBill`,
`M.pBillEmpty`, `M.dBill`; CSS `.tf`, `.totals`, `.kv`, `.phead`, `.pdock`.
Owner decisions: R-DEC-53 (340 px column at 1280), R-DEC-54 (the design's
words), R-DEC-55 (rate typed in the row, five-row totals card, paise kept, the
phone bar) and R-DEC-56 (the three asks of 27 Oct, under "Owner's asks" below).

Commits: dea426d02, f755a40a4, 1f34a231f, 8833c10ad, and the closing commit
that carries this report.

## What a merchant gets

- **One search** ("Search or scan item") adds a line. The same item again
  raises its Qty, with no second line. A scanned code adds on Enter.
- **Phone:** a list of line cards with a − Qty + stepper, the price, and Edit
  for the line's details. Picking an item opens that line's sheet.
- **Desktop (1280):** the design's table: #, Item, Qty, Unit, Rate, Disc. %,
  GST, Amount and a trash button. Qty, rate and discount are typed in the
  row. F2 brings the caret back to the search, and "Scanner ready" shows
  beside it. More details and the totals sit in a 340 px column beside the
  lines.
- **Totals card:** the design's read-only rows (Subtotal, Discount, CGST +
  SGST, Round off, Total). The bill discount and round-off are set under
  More details.
- **Empty bill:** "No items yet", the pay buttons are off, and the line above
  them says "Add an item to finish the bill".
- **A wrong field is named and focused.** For example, "Check line 1: Qty"
  puts the caret in that box, and on a phone opens that line's sheet.
- **Phone bar:** × · New bill / kind of bill · ⋯, with Hold, Save draft and
  Discard draft behind the ⋯.
- **Line limits (FB-020):** qty ≤ 999,999.999, rate and line amount
  ≤ ₹9,99,99,999.99, on screen and on the server. The ₹880-quadrillion draft
  can no longer be made.

## Owner's asks, 27 Oct 2026 (during this check)

1. **"Don't allow the float"** on a whole-number unit.
   - `UbQuantityInput` with `decimals={0}` keeps what is before a point and
     drops the digits typed straight after it, so typed "3.141" stays **3**
     (refusing only the point would have made it 3141). A paste of "12.5"
     gives 12.
   - Deleting, leaving the field or coming back to it ends the drop.
   - Trade-off, for the owner: typing 1, ., 5 gives 1, not 15 and not an
     error. The old rule had kept "1.5" so validation could refuse it; that
     is the case the owner asked to stop.
   - **Conflict listed, not chosen silently:** a purchase-bill test from an
     earlier review said 1.5 on NOS must never become a different whole
     number. Under R-DEC-56 it becomes 1, visibly. The test now asserts the new
     rule (1, never 15); the −5 case is unchanged. The owner should confirm.
2. **The server's exact reason, not "Please check the highlighted fields".**
   - `serverReason` reads the first field message from the 400's `details`,
     with its line number. Live, the dock reads "Couldn't save: Line 1:
     Quantity must be a whole number for NOS." (refusal simulated with a
     routed 400, as no real refusal is reachable now).
   - The same reason feeds the Issue refusal banner.
3. **"Why does the UI look like this after an error."** The message had
   wrapped down the 76 px Qty cell, one word per line.
   - A line's messages now get their own full-width line under the row
     (`invoice-line-errors`); the cell keeps only the red box.
   - The box's `aria-describedby` names that message, which it had never
     done in the table.
   - Measured: the table is 642 px in a 642 px frame with the message
     showing.

## Spec to check (measured on the running app)

| Design value | Built | Result |
|---|---|---|
| `.tf` font 14, th 46 px / 13 semibold, td 10/14 | `UbEditTable` | measured equal |
| Columns in order: #, Item, Qty, Unit, Rate, Disc. %, GST, Amount | as drawn, plus a trash icon | equal |
| Table inside its frame at 1280 | tight cells, qty 76 / rate 92 / disc 56 | 642 px in 642 px, also with an error showing |
| 1280: lines · 340 px column | `xl:grid-cols-[minmax(0,1fr)_340px]` | measured equal |
| `.totals` gap 8, 14 px; `.grand` border-top, pt 10, 16 px | `InvoiceTotalsPanel` | measured equal |
| `.phead` h58, px14, gap10, `.ib` 40 px radius 10, title 16/600, sub 12 | `UbTaskBar` | measured equal |
| pdock: message above the Grand total | `UbTotalDock` note `order-first` | equal |
| Words: "New bill", "Search or scan item", "Walk-in customer. No name needed.", "No items yet", "Total" | locale keys (R-DEC-54) | equal, EN and HI |

### Where the build departs from the drawing, and why

- **Dock caption** "3 items · includes GST ₹288.47" comes from the Counter
  Mode design; the A4 mock has "3 items" on the right.
- **Held strip** ("On hold · n") is kept above the bill; the A4 mock has none.
  It is Counter Mode's Hold, kept one tap away by R-DEC-55.
- **No camera scan button**: it is unbuilt, and unbuilt features stay hidden.
- **A draft shows no bill number** under "New bill"; the number is assigned on
  issue.
- **Totals card at 1280** also shows "Invoice details: 9/9 complete" (B20's
  checklist, kept from QA) under Total. It is not in the mock.
- **The purchase bill still uses the old line editor** (D6, later piece).

## Defects found — none by a unit test

| # | Found by | Defect | Fix |
|---|---|---|---|
| 1 | Monkey, seed 4401 at 1280 | **"3.141 NOS" was autosaved and refused (400) every 3 s.** The dock printed "Couldn't save: Please check the highlighted fields." under the field's own message. | The autosave waits while a whole-number line holds a fraction, and the input no longer takes one (owner's ask 1). Tests fail on the old code. |
| 2 | LOOK, same run | **The Qty message pushed Amount and the trash button out of the 1280 table.** | The message moves under the row (owner's ask 3). Measured 642/642. |
| 3 | LOOK, dark Hindi 1280 | **Round off read "-₹0.47"** (Intl's hyphen) one row under Discount's "— ₹x". | A rounding down reads "— ₹0.47". Test fails on the old code. |
| 4 | Owner's screenshot | **Error reason hidden** behind "highlighted fields". | `serverReason` (owner's ask 2). Tests. |
| 5 | Earlier in A4 (8833c10ad) | Rate/discount inputs overflowed (683 px in 644); the phone bar was inset by page padding; the dock floated mid-screen on a short bill. | Tight cells, `-mx-4 -mt-4`, `mt-auto`. |

## Data — read back from the API (`e2e/a4-functional.mjs`)

The journey is a cash Quick sale. Atta 102 5kg is added twice, so its qty is
2 and there is no second line; Atta 103 box is added once. Paid cash is then
double-tapped.

| Check | 1280 | 390 |
|---|---|---|
| Issue requests from a double tap | 1 | 1 |
| Issued bills before → after | 803 → 804 | 804 → 805 |
| Bill | INV/26-27/0465, paid, due ₹0.00 | INV/26-27/0466, paid, due ₹0.00 |
| API total vs screen total | 2047.00 = 2047 | 2047.00 = 2047 |
| Stock Atta 102 5kg (sold 2) | 216 → 214 | 214 → 212 |
| Stock Atta 103 box (sold 1) | 79 → 78 | 78 → 77 |
| Bills list shows the number, without a reload | yes, sidebar link, 0 page loads | yes |

- **Self-test:** the same read-back checker, given the screen total + ₹1, must
  report "API total … screen showed …", and it does. A missing `meta.total`
  fails the run.
- **Seed data:** the local QA shop was re-seeded today (`seed_scale`, 300
  customers, 400 items, 800 bills). Someone had rebuilt the database since 26
  Oct and left the QA owner with no business. Fourteen pending migrations
  were applied first.

## Behaviour and busy counter

- **Typing during a slow reply:** 12 keys with a 1.2 s item search sent
  **1** request (debounced), and the pick still landed on the right item.
- **Double-tap Paid cash:** one issue request (above).
- **Fast Quick sale ↔ Saved customer**, 8 taps: ends on the last pressed.
- **Reload mid-bill**, after the 3 s autosave: the lines are back.
- **Fraction on a whole-number unit:** no write is sent while it shows.
  Correcting it saves (PATCH 200).
- **React commits:** the hook-based counter is not reliable in a production
  build (no devtools hook), so the request count is the measurement here.
  Commits were not counted. Not verified.

## Monkey runs (`e2e/monkey.mjs`, 300 actions each)

| Seed | 390 | 1280 |
|---|---|---|
| 4401 | 0 failures | 0 failures; found defects 1–2 before the fix |
| 4401 after the fixes | 0 failures, no 4xx/5xx | 0 failures, no 4xx/5xx |
| 7713 after the fixes | 0 failures, no 4xx/5xx | 0 failures, no 4xx/5xx |

## Looked at (`e2e/a4-lines-look.mjs`, 10 views)

Run again after the fixes, with the same result. Shots: 390, 320 and 1280 in light and dark (EN), and 320 and 1280 in light
and dark (HI), each empty and with three items. There were 0 failures and 0
console errors. I looked at every pair. Hindi wraps "Atta 102 5kg" in the
Item column at 1280 and the words fit. Dark uses the dark tokens throughout.

## Not verified

- React commit counts while typing (above).
- A real server refusal of a line: the screen now blocks every one it knows,
  so the server-reason path was shown with a routed 400.
- Purchase bill lines (D6) are not part of A4.
- The whole-number rule's trade-off (1.5 → 1) needs the owner's eye at a real
  counter.

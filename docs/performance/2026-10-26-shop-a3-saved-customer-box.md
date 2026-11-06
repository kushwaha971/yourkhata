# A3 — Saved customer box on a new bill (FB-013), 26 Oct 2026

Design: https://claude.ai/artifact/RsYjPpq2t3zCTMu5iUSvNm §A3, copied at
`docs/revamp/design/shop-fixes-and-business-types.html`. The copy was verified
identical to the live page today, apart from the hosting wrapper. Mocks:
`M.pBillTop`, `M.dBillTop`; CSS `.cbox`, `.segc`.

## What a merchant gets

- **Quick sale | Saved customer** is one two-part switch the full width of the
  card, not two loose chips. "Saved customer" goes through `useAppWords().w`,
  so a business with its own word for customers gets it once BP-22 sends it.
- **The box:**
  - line 1 is the avatar, the name and Change;
  - line 2 is the mobile, and the Shop balance in its own right-aligned
    column: "Nothing due" in grey, "₹1,240.00 to collect" in green, "₹600.00
    you owe" in red, with tabular digits;
  - the extra "Saved customer" caption is gone.
- **Desktop:** switch (300 px), the box, and More details (360 px) on one row.
- **Switching to Saved customer** puts focus on the customer search, so a
  merchant who taps and types keeps the letters.

## Spec to check (measured on the running app, all 40 views)

| Design value | Built | Result |
|---|---|---|
| `.cbox` padding 12/14, radius 10, gap 2/12 | `px-3.5 py-3`, `rounded-[10px]`, `gap-y-0.5 gap-x-3` | measured equal |
| avatar 36, spans both lines | `h-9 w-9 row-span-2` | 36×36 |
| name 15/600 cut with "…"; Change 14/600 teal, aligned to the name | as drawn | measured equal; same line |
| line 2: mobile 13 px; balance 13/600 tabular, right column | as drawn | measured equal; right edge shared with Change |
| `.segc` radius 10, padding 3, halves 36, 14/600, chosen half card + shadow | `UbSegmentedControl` | measured equal |
| desktop 300 · 1fr · 360 | `lg:grid-cols-[300px_minmax(0,1fr)_360px]` | measured equal |

### Where the build departs from the drawing, and why

- **Each line is its own row.** In the drawing's single grid, the right column
  is as wide as the widest figure, so "₹7,203.70 to collect" cut "Sharma Mart
  45" at 390 px with room to spare. Short names look identical to the
  drawing.
- **Line 2 wraps instead of cutting the mobile.** "+91 90000 000…" is no phone
  number at all. A five-figure balance therefore takes its own line on narrow
  phones; a short one keeps the drawn two lines.
- **Out of A3's scope but visible in the same mock:** the page title ("New Tax
  Invoice" against the drawing's "New bill" with its number under it) and the
  items area. Both are A4.

## Defects found — none by a unit test

| # | Found by | Defect | Fix |
|---|---|---|---|
| 1 | API read-back | **Wrong book's money (P0, FB-018).** The box printed `summary.balance`, the main Udhaar book, on a Shop bill: "Advance in Shop ₹27,983.54" for a customer the Shop owes nothing. | Reads `party.shop.customerBalance`. Test fails on the old code. |
| 2 | Functional run | **Autosave racing Issue.** An autosave queued behind Issue's own save started in the same tick as `/issue` and was refused with 409 `document_not_draft`. | Draft saves do nothing while `issuing`. Test fails on the old code; live timeline clean. |
| 3 | Monkey (seeds 3033, 202; phone and desktop) | **Every save failed after a discount was deleted.** The type was sent without a value; the server refused it as "Please check the highlighted fields" with nothing highlighted, so the draft stopped saving. Same in the purchase editor. | One owner, `utils/discountWire`, for both editors; shared-owners guard; tests for both. |
| 4 | Owner's question, checked live | **150 % off showed no message,** and both 150 % and ₹ over the subtotal were autosaved every 3 s and refused. | The discount field gets the form's blur, so its rule runs and shows. The autosave waits while the bill discount is out of range (percent ≤ 100, rupees ≤ subtotal, line rupees ≤ qty × rate). |
| 5 | Monkey (stacks captured) | **React warning: "flushSync was called from inside a lifecycle method".** Radix checkbox and switch fire a synthetic click from an effect; an open popover closed on it mid-effect. | `useHiddenInputClickGuard` moves that echo out of the effect: stopped, then sent again in a microtask, so the popover still closes on an outside tap. Test fails without it. |
| 6 | Manual pass | **Tap Saved customer, type: letters lost.** Focus stayed on the switch. | The picker takes focus. Test fails without it; checked by hand. |
| 7 | Manual pass | **The same mobile written two ways:** "9000000021" in the picker, "+91 90000 00021" in the box. | The shared picker formats it. Test fails without it. |
| 8 | Measuring | Change was 15 px (design 14); the box grew 3–20 px when the balance arrived. | Explicit size; placeholders sized to the line they stand for. |

## Data — read back from the API

- Every view compares the box's balance and mobile with
  `GET /parties/{id}?book=shop` (`shop.customer_balance`). Result: **40 views,
  0 mismatches.**
- **Functional, through the UI.** Steps: pick a customer who owes, add an item,
  Issue on credit (payment sheet: Full credit), then New bill.
  - The invoice exists, and the Shop balance moved by exactly its total, read
    from the API.
  - With no reload, the next bill's box and the customer's page both show the
    new figure.
  - Passes at 390, 320 and 1280.

## Behaviour and busy counter

- **Double-tap Change:** the customer clears once.
- **Fast Quick sale ↔ Saved customer** (8 taps): ends on the last pressed.
- **Slow balance reply:** the box keeps its height.
- **Reload with a customer chosen:** same customer and figure.
- **Seeded monkey runs:** 300 random actions, seeds 11, 202 and 3033, at 390
  and 1280.

## Discount limits (owner's question)

Verified on phone and desktop:
- 150 % shows "This cannot be more than 100." and nothing is sent.
- More rupees than the subtotal shows "Discount cannot exceed the subtotal."
  and nothing is sent.
- 10 % saves (201).

The server enforces the same limits for bills and lines, in sales and
purchases alike.

## Filed, not fixed here

- **FB-020 (P1):** quantity and rate of 99999999 accepted, a ₹880 quadrillion draft saved; goes to A4.
- **FB-019 (P2):** the bill page asks for a UPI QR on every open even when no
  UPI ID is set, and is refused every time (found by the monkey).
- **For A4:** ₹0.00 bills can be held; the dock lets half-cut text show
  beneath its buttons.
- **The detail API's `summary` ignores `book`.** The client no longer reads it
  for Shop money, but the server shape is misleading; recorded for BP review.

## Not verified

- Physical phones.
- An advance customer in the live book: the seed has none, so "you owe" is
  covered by the unit test only.
- **Known open (FB-021, P2):** a five-figure balance at 390 px makes the box grow 20 px once when it arrives; fix by filling the box from the picked row.
- One `TimeoutError` in the functional run, seen once and not reproduced in
  five later runs.

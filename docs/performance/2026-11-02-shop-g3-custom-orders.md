# G3 — Custom orders and karigars (Jewellery)

Split: **G3a custom orders** (done), G3b karigars (gold issued, received,
wastage against each karigar's limit), G3c receiving makes tags (D6).

## G3a (2 Nov)

| Design (G3 `pJOrder`, `dJOrders`) | Built | Verified by |
|---|---|---|
| Customer, What to make, Approx. weight, Purity, Deliver on, Advance | `CustomOrderDrawer` | g3a O1 + LOOK |
| Fix the rate now (locks today's rate against the advance) | `fixed_rate` from G1; refused without an advance or a rate | pytest, g3a O1 (+ `--skew`) |
| Save / Save and give receipt | receipt is a real payment; opens `/payments/<id>` | pytest, g3a O1/O5 |
| List: Order, Customer, What, Due, Advance, Status; Open · Advance held | `CustomOrdersPageContent` | g3a O2 read back from the API |
| Status: Ready · call customer, Due tomorrow, N days late | computed from status and date | LOOK; not all driven live |

Design choices worth knowing: the advance is earmarked to its order, so no other
bill can use it automatically. Delivering or cancelling releases it to the
customer's open advances, which a bill can apply. A double-tapped Save is one
order and one receipt (`client_key`).

Added beyond the mock, listed for the owner: **Paid by** (the cashbook must
know where the advance went); **Mark ready, Delivered, Cancel** (an order must
be able to finish); **In 7 days / In 15 days** on the date.

Found running it: the screen called `/custom-orders` while the routes live under
`/sales/`; every server test passed because they resolve the URL by name.

**Not built:** design photo (only branding images can be uploaded today; needs a
general upload); Karigar field, "Issue gold to karigar", "Gold with karigars",
Karigars panel (G3b); the delivered order does not yet make its bill, and the
fixed rate is shown but not carried onto a bill automatically; no order detail
or edit screen; the 'jewellery' feature gates it, not a separate custom-orders
switch. Monkey runs and the score sheet are not done.

Live: `e2e/g3a-orders.mjs` 16/16, 0 console errors; `--skew` fails on the rate.
Server: 5 tests in `test_custom_orders.py`.

## G3a follow-on — a custom order becomes its bill (2 Nov)

"Make bill" on an order opens a new bill for its customer, linked in
`meta.custom_order`. A scanned tag of the order's purity takes the rate fixed
against the advance, even if today's rate has moved. The totals show "Advance
ORD-…" and To pay. Issuing refuses another customer or a finished order (409),
applies the advance to the bill, and marks the order delivered with the bill's
id; an advance bigger than the bill leaves the rest usable by that customer.

Limits, listed: voiding that bill keeps the order delivered and leaves the
advance as the customer's credit. The fixed rate is applied when the tag is
scanned, so a tag already on the bill keeps its rate, and the rate can still be
changed on the line. Issuing through the payment sheet on screen was not driven
live; the live check issues through the API.

Found: the issue path crashed (a missing `Decimal` import), caught by the new
server tests. Two guards caught G3a's own misses: its day-counting did not use
`utils/calendarDays`, and the menu test did not know the new entry.

Live: `e2e/g3o-order-bill.mjs` 9/9, `--skew` fails on the rate; g3a 16/16; g2c
13/13. Server: 8 tests in `test_custom_orders.py`.

## G3b — karigars (2 Nov)

| Design (G3 `dJOrders`) | Built | Verified by |
|---|---|---|
| Karigars panel: Issued, Received, weight with the karigar, Wastage | `KarigarsPanel` (rows, same on a phone) | g3b I1/R2 read back |
| Wastage "1.4% · within 1.5%" | issued − received on lots that are back | pytest with the design's 37.400 / 36.880; g3b R2 (+ `--skew`) |
| Issue gold to karigar; Gold with karigars | `IssueGoldDialog`; count line | g3b I1 |
| Order status "With Raju · 18.2 g issued" | from the order's lots still out | pytest, g3b I1 |

Listed for the owner:
- Going over a karigar's limit is shown, never refused (the business decides).
  A weight back heavier than given is refused, as a typing mistake.
- The mock's row is inconsistent: 37.400 given, 36.880 back, yet 18.200 "with
  him". Here with the karigar = lots not yet back.
- The mock's "with him" reads "With karigar", which assumes nobody's gender.
- New order's Karigar field is not built: a karigar joins an order by issuing
  gold for it.
- A lot comes back once, whole. Part-receipts are not built.
- Recording only: there is no raw-gold stock for issuing to reduce. Receiving
  does not make tags yet (G3c, D6).
- No edit or delete of a karigar or a lot, so a mistyped lot cannot be corrected.

Live: `e2e/g3b-karigars.mjs` 19/19 (390, 320, 1280; light, dark; EN, HI), g3a
16/16, 0 console errors; `--skew` fails on the wastage. Server: 14 tests in
`test_custom_orders.py`; the full suite on a fresh database fails only where it
failed before G2. Monkey runs and the score sheet are not done.

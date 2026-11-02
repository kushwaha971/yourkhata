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

# C3 — Stock count

> **Status: DECIDED (R-DEC-68), building** (30 Oct 2026). Design: §C3 of
> `docs/revamp/design/shop-fixes-and-business-types.html` (v7), mocks `pCount`
> (phone) and `dCount` (desktop); plan `docs/revamp/13-business-types-and-scanning-plan.md`
> §2.3 ("New: Stock count, under Items › Stock; camera continuous; posts as
> `stocktake_in/out`").

## Who needs it and why (gate 10)

A shopkeeper's book stock drifts from the shelf: breakage, theft, a bill typed
with the wrong item, goods taken home. Today the only fix is a stock
adjustment typed one item at a time with a reason. A count walks the shelves,
scans each item, types what is there, and saves all the differences in one go.
It replaces paper and a calculator, and it is the only way to trust "Low stock"
and the stock value again.

## Spec to check

| # | What | Source | Check |
|---|---|---|---|
| S1 | New screen "Stock count" under Items & stock; phone header "Stock count / Started 4:10 pm · all items" with Save | pCount | screenshot vs mock 390/320 |
| S2 | Search "Scan or type an item" + teal camera button (`addbar`); desktop "Scanner ready" | pCount, dCount | live |
| S3 | Count line: "Counted 18 items · 4 differ · Value change −₹1,240"; desktop "Counted 18 of 248 items" | `.countline` | figures read back from the server |
| S4 | Rows: item, "In books 24 · Counted 21", the difference (−3 red, +2 green, "Same"), "Count" for an item not yet counted | pCount `.li` | live |
| S5 | Desktop table: Item, In books, Counted (input), Difference, Value; the scanned row flashes | dCount | live |
| S6 | "Saving adds a stock correction for each difference. Nothing changes until you press Save." | pCount | text |
| S7 | Phone dock: "Scan with camera" + "Save count"; desktop actions "Pause" + "Save count" | pCount, dCount | live |
| S8 | Scan = continuous camera (C1's sheet), each code finds the item and adds 1 to its count | plan §2.3 | live, read back |
| S9 | Save posts one correction per difference as `stocktake_in` / `stocktake_out`; stock and value read back | plan §2.3 | API + Stock summary |

## Decisions (owner said "yes" to all four recommendations, R-DEC-68)

1. **Where an unfinished count lives.** The design shows "Started 4:10 pm" and a
   desktop "Pause": a count of a whole shop takes an hour and is interrupted.
   - *A (recommended):* a saved count on the server (a new `inventory_stock_count`
     table with its lines). It survives closing the app, a dead phone, and
     moving to the laptop. Needs a migration.
   - *B:* kept on the device only. No migration, but a cleared browser or a
     second device loses the count.
2. **Sales during a count.** If an item is counted at 4:15 and sold at 4:20,
   the books drop by one but the count does not. Recommended: keep the book
   figure *at the moment the item was counted*, and post
   `counted − books at that moment`. A sale after counting then stays correct.
3. **More than 100 differences.** A stock adjustment allows 100 lines. A full
   count of 248 items can differ on more. Recommended: one count saves as one
   count record whose movements are posted together (no 100-line cap), not as
   several adjustments.
4. **Value change and cost privacy.** "Value change −₹1,240" is a cost figure.
   Recommended: only people allowed to see costs (`reports.financial.read`)
   see it; staff see counts only.
5. **Who may count and save.** Saving changes stock, so it needs
   `inventory.stock.adjust` (off by default for staff). Recommended: anyone with
   `inventory.stock.read` may count; only `inventory.stock.adjust` may save.

## Edge cases to cover (from the catalogue)

The same item scanned twice in a row (count +1 each); an unknown code (the C2
sheet); counting a service or a non-stock item (refused, says why); a count
left open for a day; two people counting at once on two phones; saving twice
(double tap: one set of corrections); offline while counting; an item archived
during the count; decimals for loose goods (kg) and whole numbers for pieces.

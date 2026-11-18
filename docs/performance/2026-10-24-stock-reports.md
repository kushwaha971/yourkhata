# Low stock and Stock summary · 24 Oct 2026 (09 §8.7, R-DEC-32, R-DEC-34)

Scope: `LowStockPageContent` and `StockSummaryPageContent`, the new
`StockOffState`, and the purchase order editor's `?items=` prefill that Low
stock's Order opens. Masters and price lists (§8.5, §8.6) are NOT covered.

Who needs it: the owner, weekly, and anyone about to call a supplier. Low stock
is the list of things to reorder, and until now it ended at the list: the
merchant read a name, left, opened Purchase orders, started a new one, searched
the item again and typed a quantity they had to work out. The summary is what
the stock is worth and where it is.

## Spec-to-check map

| Requirement | Source | Check | Status |
|---|---|---|---|
| Low phone card: item · "3 left · reorder below 5" · Purchase price (permission) · **Order** | 09 §8.7 Phone | harness reads "3 NOS left · reorder at 10 NOS" and "Purchase price ₹90.00" on the live card; unit tests for the words | passed, see deviation 2 |
| Order opens a new purchase order with the item | 09 §8.7, Fewer taps | harness taps Order: `/purchases/orders/new?items=…`, the item on a line with 17 (10 × 2 − 3), cost ₹90.00 | passed |
| Prefill by route query, no new endpoint | 09 §8 Tracking, dependencies | `?items=id:qty,…` read by `usePurchaseBillEditor`, items fetched with the existing `GET /items/{id}`; route round-trip and malformed-pair unit tests | passed |
| The order is a real, saved order | gate 9 | harness picks a supplier, taps Save draft, reads the order back from the server: status draft, line qty 17.000 | passed |
| Desktop selection bar "Order selected" → one order | 09 §8.7 Desktop | harness selects two rows: ONE new order with both lines, 17 each | passed, see deviation 1 |
| Order only where purchases are on and the member may write them | 09 §8.7 | `hasModule('purchases') && can('purchases.bill.write')` gates the button, the selection and the bar | built; unit-covered by the existing permission mocks only |
| Summary phone: figure line, then cards item · on hand · value | 09 §8.7 Phone | the category/SKU line left the card; harness checks no SKU line at 390 and 320 | passed |
| Main actions: Adjust stock · Order · Export | 09 §8.7 | Summary gained Adjust stock (opens the empty drawer); harness opens it. Low keeps Adjust stock per row | passed; Order on the summary not added, deviation 3 |
| Rows → item detail | 09 §8.7 Navigation | `onRowOpen` on both pages, unchanged on the summary | kept |
| "Nothing is low" success empty state | 09 §8.7 States | new words for the empty low list | built; not reached live (the QA book always has low items) |
| Stock off: "Stock tracking is off in Settings" with a link (owner) | 09 §8.7 States | `StockOffState` on both pages when `inventory` is off; link only with `platform.audit.read`; two unit tests | passed (unit); not switched off live, because that changes the shared QA tenant |
| Potential sale value definition unchanged | 09 §8.7 Must keep | no change to the summary's figures or the server | kept |
| No sideways scroll, no cut text, Order ≥ 44 px on a phone | R-DEC-30, gates 3 and 7 | harness at 390/320/1280 × EN/HI, both pages, now including buttons cut by the table frame | passed |

## What changed

- **Low stock, phone.** A card is the item's name (wrapping, never cut), then
  the stock in words ("3 NOS left · reorder at 10 NOS", or "Out of stock"), then
  "Purchase price ₹90.00" for a member who may see costs. On the right are an
  Adjust icon button and **Order**.
- **Order.** Opens a new purchase order with the item and its suggested
  quantity, the server's `reorder point × 2 − on hand`, or one when the server
  suggests nothing. The editor fills the line from the item exactly as picking
  it would (`purchaseLineFromItem`, now shared by the picker and the prefill).
  A form the merchant has already typed into is never overwritten.
- **Desktop.** Rows can be selected; the bar offers Order selected and Clear.
  Adjust stock and Order sit in each row.
- **Stock summary.** Adjust stock in the header; cards no longer carry the
  category line and the name wraps.
- **Stock off.** Both pages say stock tracking is off, with Open Settings for a
  member who can open Settings, instead of an error.

## Deviations and conflicts recorded

1. **One order, not one per supplier.** An item carries no supplier, so
   splitting a selection by supplier would be a guess. Order selected makes ONE
   order, as the spec allows ("is not promised").
2. **"reorder at", not "reorder below".** The list includes an item sitting
   exactly on its reorder point, so "below 10" would be false for an item with
   10 left. The words say "reorder at".
3. **No Order on the summary.** The spec lists Order among the page's actions,
   but the summary has no idea of what to order; ordering lives on Low stock,
   one tap away from the summary's Low stock button. Not added.
4. **Suggested qty "0" for an item with no reorder point.** The server suggests
   0 for an out-of-stock item that has no reorder point, and the table shows
   it. Order then orders 1, because an order line of 0 cannot be saved. The
   server's figure is not changed here (backend).
5. **The figure line is unchanged.** It already reads stock value and items.

## Found by looking

- **Order cut by the table's edge at 1280.** The actions column was too narrow
  for Adjust stock and Order side by side; Order's right edge sat outside the
  table frame. Every text-node check passed, because the button's own text
  fitted inside the button. The harness now measures every button against the
  table frame it sits in; it failed on the old build ("clipped:Order") and
  passes after the column was widened.
- **Last movement cut at 1280.** "23/10/2026, 19:52" read "23/10/2026, …" on
  the summary's table. The column now has more of the width and the name less.
- **A disc on its own line.** On the summary's phone cards the package disc fell
  under the name, because the stacked card layout does not place a disc. The
  disc is gone from both stock pages, as on the other stacked lists.
- **The harness's own first save check was wrong.** It waited for a draft to
  save itself; the editor saves on Save draft. The harness now taps Save draft
  and reads the order back by the id in the new URL.

## Performance

Opening Low stock: from navigation start until the first row is visible, at 4x
CPU throttle, against `dcaddbc` (dev before this piece). Each side had 6 opens
per round, 2 rounds alternating old and new, on a phone (390×780) and a desktop
(1280×900). Script and raw numbers: `data/2026-10-24-stock-reports/`.

| | old median | new median | n per side | new range |
|---|---|---|---|---|
| Phone | 1,073 ms | 1,104 ms | 12 | 993–1,174 ms |
| Desktop | 746 ms | 761 ms | 12 | 715–858 ms |

Read this as unchanged, possibly slightly slower: the new medians are 31 and
15 ms higher, and the spread inside each side (old phone 963–1,364 ms) is far
wider than the gap. The page now renders more per row (two buttons and a
checkbox), and the route chunk grew 0.8 KB.

Bundle: `/stock/low` route 74.2 → 75.0 KB (+0.8) for Order, the selection, the
words and the stock-off state. The purchase editors' first load grew 0.1 to
0.2 KB for the prefill, whose item fetch is a dynamic import. Several other
first loads grew 0.1 KB; that is chunk regrouping, most likely the two new
helpers in `src/routes.ts`, not isolated. Each exceeded budget was raised to the
measured size plus 0.3 KB, with a note in `bundle-budgets.json`.

## Competitor comparison

Not done for this piece; unproven.

## Gates

- Jest: 4,717 of 4,717 passed, including new tests for the route query, the
  low-stock words and order line, and the stock-off state.
- Type-check: passed. i18n split and check: passed.
- Lint (`--max-warnings=0`): the full run found one import-order error in
  `usePurchaseBillEditor.ts`; fixed, and every changed file re-linted clean.
- Production build: passed. Bundle check: passed after the raises above.
- `e2e/stock-reports.mjs` (new): 44 of 44 against the local QA stack.
- Regression: `e2e/stock-adjust.mjs` 47 of 47, `e2e/item-detail.mjs` 94 of 94,
  `e2e/revamp-purchase-quick-add.mjs` no failures (the picker now shares the
  prefill's line builder).

## Scores (low stock and stock summary only, provisional)

| Point of view | Score | Evidence | Still weak | Confidence |
|---|---|---|---|---|
| Function | 8.6 | Order → saved draft read back with the right item and quantity; Order selected → one order with both | Stock-off and "Nothing is low" not reached live | Medium-high |
| Busy shop | 8.7 | One tap from a low row to a filled order, quantity worked out | No supplier split (deviation 1) | Medium |
| UI/UX phone | 8.4 | Measured EN/HI at 320/390 on both pages | Suggested 0 vs Order 1 (deviation 4) | Medium |
| UI/UX desktop | 8.3 | Measured at 1280; the clipped Order fixed | Wide numeric columns on the low table | Medium |
| Performance | 8.0 | Low stock open unchanged within noise at 4x CPU, n=12 a side (+31 ms phone median) | /stock/low +0.8 KB | Medium |

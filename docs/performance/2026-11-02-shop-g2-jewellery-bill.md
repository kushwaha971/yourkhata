# G2 — Bill by weight, old gold and PAN (Jewellery)

> **Status: design review written; G2a being built.** Design: §G2 of
> `docs/revamp/design/shop-fixes-and-business-types.html` (mocks `M.pOldGold`,
> `M.dJewelBill`), plus the Jewellery versions of D1 (bill lines), D2 (line
> sheet, `lineBody`), D3 (item form, `itemTypeGroup`), D4 (items list,
> `typeChip`), D5 (item tab "Weight and rate", `itemTab`) and D14 (print,
> `a4` "Net wt · Purity" column).

## Who needs it, and why (gate 10)

A jeweller prices every piece by weight: net weight × today's rate, plus making
(a percentage or ₹ per gram), wastage and any stone. Generic billing apps
price by quantity, so jewellers either work the sum out on a calculator and
type a total (errors, no record of the weight) or pay for an ERP. Two legal
rules sit on every bill:
- a PAN is needed from ₹2 lakh;
- cash of ₹2 lakh or more cannot be taken in one transaction (Income Tax
  s.269ST).

Old gold taken in against a new piece is how most jewellery bills are paid.

## Split into four pieces (one at a time, each tested before the next)

| Piece | Scope | Design source |
|---|---|---|
| **G2a** | A tag per piece: tag no., metal and purity, gross / stone / net weight, making (% or ₹/g), wastage %, stone charge, HUID. The item form's "Tag details" group, the item page's "Weight and rate" tab, the items list's "Tags in stock" chip | D3, D4, D5 (Jewellery) |
| **G2b** | A bill line by tag: scan or pick a tag, and the line is net wt × the day's 22K/24K/18K/silver rate (G1) + making + wastage + stone. The rate is copied onto the line when the bill is issued. Line sheet with the breakdown. Print column "Net wt · Purity" | D1, D2, D14, `M.dJewelBill` |
| **G2c** | Old gold taken in: weight, tested purity, rate, melting less %. It comes off the bill and goes into its own old-gold stock | `M.pOldGold`, `M.dJewelBill` |
| **G2d** | PAN asked by itself when the bill is ₹2 lakh or more; cash of ₹2 lakh or more on one bill refused, server and screen | `M.dJewelBill`, BT.jewel `billX` |

## Data model (G2a), reusing what exists (gate 5)

A tag is one physical piece. The existing serial engine (D P3, IMEI) already
does everything a tag needs:
- `in_stock` / `sold` / `returned`;
- sold on a bill, with the document kept;
- stock equals the in-stock count;
- find by code.

So a tag is a `Serial` (its `serial` is the tag no.) on an item with tracking
`serial`, plus a one-to-one `TagDetail`:
- `purity` (one of the G1 four: gold_24k / gold_22k / gold_18k / silver);
- `gross_g`, `stone_g`, `net_g` (3 decimals; net = gross − stone, checked);
- `making_type` (`pct` / `per_g`), `making_value`, `wastage_pct`;
- `stone_charge` (money);
- `huid` (6 characters, BIS).

Feature key `jewellery` (Part H's name), on for the jewellery preset.

## Spec to check (G2a)

| # | What | Source | Check |
|---|---|---|---|
| T1 | Item form group "Tag details": Tag no. (print icon), Metal · purity select, Gross / Stone / Net g, Making segmented "%" / "₹ per g", Wastage %, HUID with hint "6 characters from the hallmark. Printed on the bill." | `itemTypeGroup` jewel | words, order, rows of 2/3 |
| T2 | Net = gross − stone; a net that disagrees is refused | design arithmetic | API refusal, unit test |
| T3 | Tag no. unique in the business; HUID 6 letters/digits | BIS / design hint | API refusal |
| T4 | Item page tab "Weight and rate": Tag, Net wt, Purity, HUID, Status ("In stock" / "Sold 21 Oct") | `itemTab` jewel | rows read back |
| T5 | Items list chip "Tags in stock · N" | `typeChip` jewel | N = API count |
| T6 | Only a business with `jewellery` on sees any of it | Part G / H | other kind: no group, 404 |

## Conflicts / questions listed (not chosen silently)

1. **Item vs tag.** D3 draws the tag fields on the Add item form, while D5
   lists many tags under one item. Read as: adding an item with "Tag details"
   creates its first tag, and the item page adds more. The karigar receipt
   that makes several tags at once is G3/D6.
2. **Purities.** The four from G1 (24K, 22K, 18K, silver). The design's silver
   payal is "925"; G1 has only "Silver (999)". Listed: either add "Silver 925"
   to G1's rates or price 925 pieces from the 999 rate.

3. **Cost of a piece already in the shop.** The design's tag form asks no
   cost, but stock needs one. Built: its metal value at today's G1 rate (net g
   × the rate for its purity), or ₹0 before a rate is set. A piece BOUGHT comes
   in through a purchase at its price. The owner may prefer a cost field.

## G2a backend (2 Nov), done

- `inventory.TagDetail` (one-to-one on `Serial`), migration 0016.
- `GET/POST /api/v1/items/<id>/tags` and `GET /api/v1/jewel-tags/summary`.
- Feature `jewellery`, on for the jewellery preset; any other kind gets 404.
- Read: `inventory.item.read`. Add: `inventory.stock.adjust`, because adding a
  tag puts a piece into stock (a stock adjustment, reason Other, "Tag … added").
- Tests: `apps/inventory/tests/test_jewellery_tags.py`, 13. The kind-gate test
  was proved to fail without the gate.

## Next steps

G2a backend: `TagDetail`, the tag create/list API on an item, the feature key,
tests. Then the form group, the tab and the chip, the harness, LOOK, monkey,
regression, report. Then G2b.

## D3/D5 rebuild (2 Nov), pushed 2184b6def and 59877a880

The Add item form and the item page follow D3/D5 for every kind. Live:
item-form 29/29, item-detail 124/124, ad-certify 77/77, d1/d2/d6 passing,
g2a 0 failures (skew fails as it must). Kept against the design, listed for
the owner: no "Sold this month" (no figure behind it); Sales and Purchases
tabs instead of "Price history"; Archive in the desktop header; "More
details" does not say photo (items have none).

## G2b — the bill by weight (2 Nov)

**Spec to check** (design G2 `dJewelBill`, D2 jewellery `lineBody`, D14 print):

| Design | Source | Built | Verified by |
|---|---|---|---|
| "Scan tag or search" adds the piece | G2 lede, `pOldGold` addbar | `scanFirst` on quick-add → `/jewel-tags/lookup` | g2b S1 (network + caption) |
| Same tag twice is not added | busy-counter rule | snackbar "Tag … is already on this bill." | g2b S2 |
| Price = net × rate + making + wastage + stone | D2 `wb` rows | `tags.price_piece`, mirrored in `jewelPrice.ts` (half-even BigInt) | pytest design example; jest same figures + half-paisa cases; g2b S1/S3 read back |
| Sheet: Gross · Stone · Net, Rate · 22K 916 "Today's rate · locked on issue", Making % / ₹ per g, parts, HUID line | D2 jewel `lineBody` | `JewelLineFields` | g2b S3 + LOOK 390/320 |
| Rate locked on issue | D2 hint | the rate is written on the line snapshot (`jewel`), never re-read | pytest + g2b S4 (rate changed after issue) |
| GST 3% on the bill, not in the line | D2 last row | line is tax-exclusive at the item's GST code | pytest taxable = total |
| Print: "Net wt · Purity", HUID per line, "Rates used: …" | D14 `a4()` | `businessColumn('jewel')`, `jewelRatesLine` | g2b P |
| Tag sold once | serial engine (D P3) | the tag is the line's serial | pytest + g2b S4 lookup 404 |

**Defects found on the running app and fixed:** the desktop row kept Qty,
Rate and Disc. boxes on a tag line — a typed rate would be silently replaced
by the server, and ₹1,61,012 was cut in its box; they are fixed text now
("1", "₹11,650.00/g", "—") and the phone stepper stops at one piece. The
sheet's making box and the three weight boxes were cut at 390/320; those rows
stack below 640/360 px. The weight dropped out of the line caption (a shell
expansion while editing) and the live check caught it.

**Not built yet, listed (not chosen silently):**
1. The design's desktop table for a jeweller has its own columns (Tag · item,
   Net wt, Rate, Making, Amount); the built table keeps the shared columns
   with the weight in the caption. Next step if wanted.
2. A jeweller's item does not default to GST 3%: an item saved at GST 0 bills
   with "No GST is charged". Proposed: the jewellery preset's default tax code
   is GST3 (owner to confirm; 5% only for job work).
3. Old gold (G2c) and PAN / the cash limit (G2d) are the next pieces.

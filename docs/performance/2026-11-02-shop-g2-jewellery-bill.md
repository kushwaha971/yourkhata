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

## Next steps

G2a backend: `TagDetail`, the tag create/list API on an item, the feature key,
tests. Then the form group, the tab and the chip, the harness, LOOK, monkey,
regression, report. Then G2b.

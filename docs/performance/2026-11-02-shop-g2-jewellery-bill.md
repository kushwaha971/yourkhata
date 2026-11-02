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

**Gaps closed (2 Nov, owner "Gaps first"):**
1. Desktop: a bill of tag pieces reads Tag · item | Net wt | Rate (per g) |
   Making | Amount, as dJewelBill; a bill mixing in a plain item keeps the
   shared columns. Live: g2b S1 reads the header and the row.
2. GST — owner decision: no GST default by kind anywhere; the business picks
   the rate on every line, 0% included (a 3% jewellery default was built and
   taken back). The tag line's sheet got its GST picker back (it follows the
   bill: hidden on a business that charges no GST, as every line) and no longer
   prints "GST 3%" as a fact. Unit test for both cases; live S3 checks the
   unregistered case and that no fixed rate is stated.

**Next:** G2c old gold taken in, then G2d PAN and the cash limit.

## G2c — old gold taken in (2 Nov)

| Design (G2 `pOldGold`, `dJewelBill`, D14) | Built | Verified by |
|---|---|---|
| Sheet: Weight, Purity (tested) "22K · 91.6%", Rate, Less (melting) %, the three rows, the note, "Take ₹… off" | `OldGoldSection` sheet; rate defaults to today's for the purity | g2c O1 + LOOK 390/320 |
| value = weight × rate − less %, to the paisa | `old_gold.price` (server), `priceOldGold` (screen, same rounding) | pytest design example (₹93,619.40); jest same; g2c O2 read-back with `--skew` |
| "Old gold taken in · Edit" card, "− ₹…" | card under the lines (jeweller's bills only) | g2c O2 |
| Totals: Old gold −, To pay | `InvoiceTotalsPanel` rows; dock and "Paid cash" use To pay | g2c O2/O3 |
| Comes off the bill; a purchase from the customer, own old-gold stock, never mixed with tags | `inventory_old_gold` row per bill; value settled at issue as a no-money adjustment allocated to the bill (cashbook never counts it); GST stays on the full bill | pytest (party: paid/due split, adjustment mode; quick sale: cash = rest exactly) |
| Print: "Old gold taken in: ₹93,619 (8.200 g)" | appended to the rates line | g2c P |

Rules decided in code, listed for the owner:
- Old gold worth more than the bill is refused (`old_gold_over_bill`); paying
  the customer the difference is not built.
- A voided quick sale hands the old gold back (its row leaves the stock, its
  settlement is voided with the counter receipt). A voided party bill keeps
  the gold and leaves its value as the customer's credit, as every party
  payment is kept on a void (BR-4).
- The design rounds "₹93,619"; the bill keeps paise (₹93,619.40), like every
  other money figure in the app.
- `test_registry_is_closed_and_complete` was already failing (228 vs 223);
  `old_gold_over_bill` makes it 229. Its count needs refreshing in a separate fix.

Live: `e2e/g2c-old-gold.mjs` 13/13, 0 console errors; `--skew` fails on the
read-back as it must. Server: 10 jewellery-bill tests; full suite's failures are
the ones already failing before G2.

**Next:** G2d — PAN at ₹2 lakh and the cash limit.

## G2d — PAN at ₹2 lakh and the cash limit (2 Nov)

| Design (G2 `dJewelBill` side column) | Built | Verified by |
|---|---|---|
| PAN box (design hint "Needed because…" reworded "Optional. For a bill of ₹2 lakh or more.") | `JewelPanField`, shown on a jeweller's bill from ₹2,00,000; kept in `meta.pan` | g2d N1/N2 (+ `--skew`) |
| A wrong PAN is said under the box | server: "Enter the 10-character PAN, like ABCPK1234L." | pytest + g2d N2 |
| Issue refused without PAN (Rule 114B) | **Not enforced, owner's decision (2 Nov): PAN is optional.** A blank PAN never stops a bill; a saved customer's GSTIN fills it (`jewel_rules.fill_pan_from_gstin`) | pytest |
| "Cash over ₹1,99,999 can't be taken…" | **Not built, owner's decision (2 Nov): no cash limit anywhere; how a bill is paid is up to the business.** Built, then removed: no notice, "Paid cash" stays on, the server takes it | pytest (whole ₹2 lakh-plus bill in cash issues) + g2d N1/N3 |
| Only for a jeweller | `features` gate | pytest (a non-jeweller's ₹2.5 lakh cash bill issues) |

Found on the running app and fixed: a tag line's phone caption read
"NOS · ₹2,07,3…" — the piece price, cut. It now reads "12.340 g · ₹15,000/g"
and wraps rather than cut; the check measures it at 320.

Listed, not chosen silently:
1. Design conflict, decided by the owner: the design's cash limit (s.269ST) is
   not applied to any kind of shop. Legal responsibility for cash stays with
   the business.
2. The PAN is kept on the bill, not on the customer: the customer record has
   no PAN field (one with a GSTIN carries it). The A4 print does not show the
   PAN yet.

Live: g2d 19/19, g2c 13/13, g2b 21/21, all 0 console errors.

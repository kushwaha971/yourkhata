# D · P1a — Box and piece (a second unit on an item)

> **Status: DESIGN REVIEW, building** (31 Oct 2026). Design: D1 (bill lines)
> and D3 (add item form) of `docs/revamp/design/shop-fixes-and-business-types.html`
> for kinds **hardware** and **wholesale** (`f: ['units', …]`); plan
> `docs/revamp/13-business-types-and-scanning-plan.md` §P1 "Box ↔ piece units".
> Feature key `shop.features.alt_units` (already set by sign-up, B1).

## Who needs it and why (gate 10)

A hardware shop buys switches by the box of 20 and sells them one at a time; a
wholesaler sells soap by the case of 72 and by the piece. Today an item has one
unit, so the shop keeps two items ("Anchor switch box", "Anchor switch") and
their stock never agrees, or types 20 every time a box goes out. One item with
"Also sold as Box = 20 PCS" sells either way and keeps one stock figure, always
in the smallest unit.

## Spec to check

| # | What | Source | Check |
|---|---|---|---|
| U1 | Item form: "ALSO SOLD AS" group with Unit, Has (N base units), Box price; "Add another unit" | D3 pAddItem/dAddItem | screenshot vs mock 390/1280 |
| U2 | The group shows only when `alt_units` is on for the business | plan §P1 | live, both settings |
| U3 | Bill line caption: "Sold in pieces · Box of 20", "1 Coil = 90 m"; the line's unit shown ("PCS × ₹28", "Coil × ₹1,450") | D1 pBillType/dBillType | live |
| U4 | Unit chip on the bill line only for items with two units; changing it re-prices from the unit's price or base price × factor | plan §P1 | live, read back |
| U5 | Stock always posts in the base unit: 1 box sold = −20 pcs | plan §P1 | API: movement qty |
| U6 | A unit's own barcode adds 1 of that unit ("box" barcode adds 1 box) | plan §P1 | live scan, read back |
| U7 | Return of 1 box puts 20 back; void restores; `recalc_stock` parity | plan §P1 tests | API |
| U8 | Single-unit items: counter entry timing unchanged | plan §P1 speed | timing harness |

## Decisions taken (reversible; listed for the owner)

1. A second unit is always a **multiple** of the base unit (1 Box = 20 PCS),
   as D3's "Has 20 PCS" reads. Base stays the smallest; stock never shows "1.35 box".
2. A unit with no price of its own sells at base price × factor.
3. Purchases use the same units (a box bought adds 20 pcs at cost ÷ 20).

## Questions for the owner (queued, not blocking)

- D1's sample "Havells wire, 1 Coil = 90 m" sells the coil as the item's base
  unit and also states its length. Is "length per coil" just a caption, or must
  wire also sell by the metre (base = m, Coil = 90 m)? Built as the second.

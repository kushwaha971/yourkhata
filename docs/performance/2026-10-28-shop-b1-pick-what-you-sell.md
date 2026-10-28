# B1 — Pick what you sell (sign-up step 2)

> **Status: NOT STARTED — spec only** (28 Oct 2026). Design: §B1 of
> `docs/revamp/design/shop-fixes-and-business-types.html`, mocks `pPick`
> (phone, sign-up step 2) and its desktop twin; tiles from `const TILES` and
> `tileHtml` in the same file.

## Spec to check (from the design; verify the CSS before building)

| # | What | Design |
|---|---|---|
| S1 | Replaces today's business-type dropdown at sign-up | one tap on a picture (tile) |
| S2 | Ten tiles, 3 columns on a phone | Kirana · General store; Medical · Pharmacy; Mobile · and electronics; Clothes · and shoes; Hardware · paint, sanitary; Auto parts · and spares; Wholesale · distributor; Sweets · bakery, café; Jewellery · own app, later (shown at 60 % opacity); Other · anything else |
| S3 | Header | back, "Set up your shop", "Step 2 of 4"; title "What do you sell?"; line "Tap one. This sets your menus and item fields. You can change it later." |
| S4 | Mixed shop | "+ I also sell…" adds a second type (e.g. kirana and medical under one GST number) |
| S5 | Dock | "Continue" (wide, primary) |
| S6 | Business rules | the choice sets menus and item fields (B2/B3); the server's catalogue decides what exists (DEC-016, BP-22, `docs/platform/17-business-model-map.md`); R-DEC-51 has the owner's 8 answers |

## Next steps (for whoever continues)
1. Read the mock source (`grep -n "^M.pPick\|^M.dPick\|tileHtml\|const TILES"`) and its CSS (`.tiles`, `.tile`), and the current onboarding step (`features/onboarding`, `GET /onboarding/apps`, `business_type`).
2. Write `e2e/b1-pick.mjs` (look + API read-back of the saved business type(s), 390/320/1024/1280, light/dark, EN/HI) and measure the baseline.
3. Then build, per `docs/team/CONTINUE-SHOP-REVAMP.md` §3.

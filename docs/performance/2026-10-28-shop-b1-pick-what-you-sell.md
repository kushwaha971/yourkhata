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

## Found so far (28 Oct, before any code)

- **Mocks:** `M.pPick` (line ~1227) and `M.dPick` (line ~1230, `deskPlain`, a centred card).
- **The design's CSS:**
  - `.tiles`: grid, 3 columns, `minmax(0,1fr)`, gap 10px.
  - `.tile`: 1px line border, radius 12, card background, padding 12 8, centred
    content, gap 6, 13px / 600, line-height 1.2, min-height 96.
  - `.tile svg`: 34 px, teal.
  - `.tile.on`: 2px teal border, teal-wash background, teal-ink text.
  - `.tile small`: 11.5px / 500, ink-3.
- **What exists today:** a tile grid is ALREADY built:
  - `features/onboarding/components/BusinessTypeGrid.tsx`;
  - `OnboardingBusinessStep.tsx`;
  - `constants/onboardingSteps.ts`;
  - the `business_type` field in `onboarding.types.ts`.

  So B1 is probably a revamp of an existing step, not a new one. Measure the
  current grid against the numbers above first. "+ I also sell…" (S4) needs a
  second type: check whether the server can store more than one
  `business_type` before building it. If it can't, that's a backend change for
  the owner to approve.
- **Checked:** the server stores ONE business type,
  `apps/platform_app/models/tenant.py:32` (`business_type = CharField(max_length=32,
  choices=BusinessType.choices)`). So S4 ("+ I also sell…") needs a backend
  change: a second field or a list, plus a migration. First look in R-DEC-51
  (`docs/revamp/12-decision-log.md`, and the business-model memory) to see
  whether the owner already decided it. If not, ask before building S4. S1–S3
  and S5 need no backend change.
- **Checked R-DEC-51:**
  - its answers cover words, rows, starter categories and Hardware first,
    but not the second type;
  - the business-model map (`docs/platform/17-business-model-map.md` §2.1,
    around line 63, approved as BP-22 per R-DEC-51) proposes the tiles and
    "+ I also sell…", and says old types stay valid;
  - it does NOT say how the second type is stored. Propose a shape to the
    owner and ask before migrating: for example a `business_types` list, or a
    `secondary_business_type`.

## Next steps (for whoever continues)
1. Read the mock source (`grep -n "^M.pPick\|^M.dPick\|tileHtml\|const TILES"`) and its CSS (`.tiles`, `.tile`), and the current onboarding step (`features/onboarding`, `GET /onboarding/apps`, `business_type`).
2. Write `e2e/b1-pick.mjs` (look + API read-back of the saved business type(s), 390/320/1024/1280, light/dark, EN/HI) and measure the baseline.
3. Then build, per `docs/team/CONTINUE-SHOP-REVAMP.md` §3.

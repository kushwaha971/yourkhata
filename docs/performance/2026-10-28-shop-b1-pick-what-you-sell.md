# B1 — Pick what you sell (sign-up step 2)

> **Status: STARTED, in test** (28 Oct 2026). The tile LOOK only (step 1 below) is in; nothing has been looked at or measured live yet. Design: §B1 of
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

## The existing grid against the design (read from the code, not yet measured live)

| | Today (`BusinessTypeGrid.tsx`, `constants/businessTypes.ts`) | Design |
|---|---|---|
| Types | 9 broad ones: retail, wholesale, distribution, services, trader, manufacturer, professional, food, other | 10 shop kinds: Kirana, Medical, Mobile, Clothes, Hardware, Auto parts, Wholesale, Sweets, Jewellery (later), Other |
| Tile | `min-h-[88px]`, items-start (left-aligned), gap-1, rounded-card, p-3 | min-height 96, centred, gap 6, radius 12, padding 12 8 |
| Icon | 20 px (`h-5 w-5`), tertiary / accent | 34 px, teal |
| Columns | to measure | 3 on a phone |

**This is a conflict to list for the owner.** The 9 stored values are
the server's `BusinessType` choices, and the design's 10 are finer kinds. The
business-model map says the finer types "map to presets and to a default
feature set" and that "old types stay valid". So the new tiles need a mapping
to presets, or new choices, which is a backend change. Confirm the mapping with
the owner (or the map's §5) before changing stored values.

## Step 1 done (28 Oct): the tile look, code only

`BusinessTypeGrid.tsx` tiles are now drawn to the design's `.tile` / `.tile.on`:
- centred, at least 96 px tall, radius 12, padding 12 × 8, 6 px gaps;
- 34 px accent icon;
- the name at 13 px / 600, the hint at 11.5 px / 500;
- a 2 px accent border when picked;
- 10 px between tiles.

The onboarding tests pass (147), with the 88 → 96 px test updated.

**Not done, on purpose:**
- **Three columns on a phone:** they wait for the design's ten short kinds,
  because today's nine longer labels wrap badly at 360 px (the wizard test
  says why). It's listed as a conflict.
- **Not yet checked on screen.** The next session must build, screenshot step 2
  at 390, 320, 1024 and 1280 in light and dark, English and Hindi, and compare
  with `pPick` / `dPick` using `e2e/design-compare.mjs`.

## Next steps (for whoever continues)
1. Read the mock source (`grep -n "^M.pPick\|^M.dPick\|tileHtml\|const TILES"`) and its CSS (`.tiles`, `.tile`), and the current onboarding step (`features/onboarding`, `GET /onboarding/apps`, `business_type`).
2. Write `e2e/b1-pick.mjs` (look + API read-back of the saved business type(s), 390/320/1024/1280, light/dark, EN/HI) and measure the baseline.
3. Then build, per `docs/team/CONTINUE-SHOP-REVAMP.md` §3.

## Correction (28 Oct, later): the second type's storage IS decided

`docs/platform/17-business-model-map.md` §5, approved as BP-22 (§7, R-DEC-51):
- "**More than one type, one GSTIN: `shop.extra_types`**; features = union of
  the presets";
- defaults come from the business type(s) preset, and are "off for every
  existing business";
- one check: `features.on(tenant, key, category=None)`. No code compares a
  business type.

So "+ I also sell…" is stored as the Shop setting `shop.extra_types`, with no
second column on the tenant and no owner question needed (it is approved).
The earlier lines above that say "propose a storage shape" are superseded by
this.

Still to confirm in code: whether `shop.extra_types` already exists as a
setting key, and how the design's ten kinds map onto today's nine stored
`BusinessType` values (the map says the finer kinds "map to presets and to a
default feature set"). R-DEC-51 #4 says build **Hardware & electrical first**.

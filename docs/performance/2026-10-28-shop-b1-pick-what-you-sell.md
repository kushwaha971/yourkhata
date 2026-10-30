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

## Step 1 checked on screen (30 Oct 2026) — `e2e/b1-pick.mjs --tag=before`

Built and served on :3005; 16 cases (390/320/1024/1280 × light/dark × EN/HI),
80/88 checks pass. Shots and the side-by-side sheet: `/tmp/e2e-shots/b1/`.

**Passes:** tile radius 12, icon 34, name 13/600, hint 11.5/500, picked border
2 px, centred, gap 10, min-height ≥ 96, no text cut, no page overflow, targets ≥ 44,
in every case.

**Fails / differs from pPick and dPick (looked at, not only measured):**
1. 9 tiles, design 10 (the stored types, not the shop kinds).
2. Columns: 1 on a phone (design 3), 3 on desktop (design 5).
3. Composition: the design gives the type its own screen ("Step 2 of 4",
   "What do you sell?", "+ I also sell…", Continue in the dock). Today the tiles
   sit at the bottom of wizard step 1 under name, state and the apps choice,
   with no "I also sell".
4. **Defect:** on a phone the sticky Continue bar is drawn over the tile list
   (between "Professional" and "Food") in every phone shot.
5. Step 1 opens with "Enter a name" in red before anything is touched (seen
   in the 390/320 shots; not yet reproduced by a check).

## The 10 shop kinds against the 9 stored types — conflicts for the owner

| Design tile | Nearest stored type | Conflict |
|---|---|---|
| Hardware · paint, sanitary | retail | R-DEC-51 #4 says "Hardware & electrical"; the tile says "paint, sanitary". No hardware type or preset exists. |
| Kirana · General store | retail | — |
| Medical · Pharmacy | retail | Needs batches/Schedule H later; collapses into retail. |
| Mobile · and electronics | retail | Needs serials/IMEI later; collapses into retail. |
| Clothes · and shoes | retail | Needs variants later; collapses into retail. |
| Auto parts · and spares | retail | Needs part numbers later; collapses into retail. |
| Wholesale · distributor | wholesale **or** distribution | Two stored types (different words: Retailer/Company) behind one tile. |
| Sweets · bakery, café | food | — |
| Jewellery · own app, later | none | Shown at 60 %: tappable or not? |
| Other | other | — |
| (none) | services, trader, manufacturer, professional | Four stored types have no tile: no way to pick them at sign-up. |

Six tiles land on `retail`, so the server could not tell them apart for B2/B3
(words, features). Options: (A) add the finer kinds as new `BusinessType`
choices with their own presets, old values staying valid (reads closest to
the map §2.1, but is a backend change); (B) keep the 9 and store the kind
separately. Not chosen; waiting for the owner. `shop.extra_types` holds the
same values, so it waits on this too.

## Built (30 Oct 2026) — R-DEC-63 and R-DEC-64

- **Server:** seven stored kinds (hardware, kirana, medical, electronics,
  garments, auto_parts, jewellery), each with a preset whose units are checked
  against the seeded unit list; migration 0020. One business is ONE kind
  (R-DEC-64): `shop.extra_types` withdrawn. Wholesale is stored as the kind plus
  `shop.wholesale` = on, saved in the same `POST /tenants`; defaults are
  `presets.combined(kind, wholesale=True)`.
- **Client:** the design's ten tiles in its order with its own pictures
  (`UbShopKindIcon`, copied path for path), 3 columns on a phone and 5 from md.
  Wholesale lights its tile and opens "Wholesale of what?" (the same grid
  without it). No "+ I also sell…".
- **`e2e/b1-pick.mjs --tag=after`: 124/124** over 390/320/1024/1280 × light/dark
  × EN/HI: 10 tiles, 3/5 columns, gap 10, ≥ 96 high, radius 12, icon 34, type
  13/600 and 11.5/500, 2 px picked border, centred, no text cut, no overflow,
  targets ≥ 44, Wholesale opens 9 kinds, the last tile clears the Continue bar.
- **Not a defect after all:** the "Continue drawn over the tiles" in the
  before shots is how a full-page screenshot paints a sticky bar; at the end of
  the page the last tile sits above it (now measured, not eyeballed).

## Conflicts / still open (listed, not chosen)

1. The design draws "What do you sell?" as its own step ("Step 2 of 4"); it is
   still a section of wizard step 1. Waiting for the owner.
2. The design's "+ I also sell…" button is removed by R-DEC-64.
3. Jewellery: design says "own app, later" at 60 %; the owner made it a normal
   kind, hint "gold, silver".
4. The electronics tile reads "Mobile · and electronics" (design words) for the
   owner's "electrical/electronic/mobile" kind.
5. A resumed wizard does not read `shop.wholesale` back: the Wholesale tile is
   not re-lit after a reload mid-setup (the kind is). Not yet fixed.
6. Not yet run for B1: monkey (3 seeds × 2 sizes), the §10 regression of A3–A8
   harnesses, bundle:check, a live sign-up read-back through the real API, and
   the hand-driven pass. Score not given; the piece is in test.

## Final round (30 Oct 2026, later) — ready for the owner's check

- **Wholesale (owner, twice):** first a card lit beside the kind, then, at the
  owner's word, back to one choice with a separate "Wholesale of what?" list
  below (f96e561cf). Stored as kind + `shop.wholesale` = on.
- **`e2e/b1-pick.mjs --tag=after3`: 124/124.**
- **`e2e/b1-signup.mjs`: 10/10** on a real sign-up through the live API:
  Hardware → `hardware`, wholesale off, units NOS/PCS/BOX/KGS/MTR/LTR, 15 days;
  Wholesale → Kirana → `kirana`, wholesale on, units NOS/KGS/GMS/LTR/PAC/BOX/
  BAG/QTL, 15 days; no `shop.extra_types`. `--skew`: 0/10 (every check fails).
- **Monkey** `/onboarding/step/1`, seeds 1–3 × 390/1280: 3 passed; 3 failed
  on 5–9 s API calls while other work ran on the machine; all 3 PASS when
  replayed alone.
- **§10 regression:** a3-customer-box-look 70/0, a3-functional 0 failures,
  a4-money/remove-undo/functional PASS, a4-edges 11/11 at 390 and 1280,
  a5-measure PASS, a6-forms 24/0, a8-first-tap 38/0. **a7-measure 31/32:**
  `/sales/estimates` shows "No estimates yet" — the QA shop has 0 estimates
  now (API total 0), so the grid never appears. A data state, not B1 code;
  not investigated further.
- **Gates:** onboarding jest 156/156; platform backend tests pass except the
  4 failures that predate this work (personal Udhaar, `apps/.claude`);
  tsc, eslint, i18n clean; bundle +0.7 KB on sign-up, budgets raised with a note.
- **Not done:** the hand-driven pass in the browser pane; competitor
  comparison for this screen (moved to the design thread); score — the owner's.

## Gaps closed before the owner's rating (30 Oct 2026, evening)

- **Reload mid-setup** re-lights Wholesale and its kind: the tenant read sends
  `sells_wholesale`, the draft and the form keep it (151a5c859; test fails on
  the old form default).
- **Hand-driven pass** (browser pane, phone 375 and desktop): Shop tick shows
  the tiles; Hardware picks; Wholesale lights and opens "Wholesale of what?";
  Kirana there; tapping Hardware again closes the list and clears wholesale;
  Wholesale with no kind and Continue shows the error under "Wholesale of
  what?"; no page overflow; no red error on open. Found and fixed two
  (a45a56006): arrow keys changed the choice but left focus on the first tile
  (test fails before); the empty-kind error said "Choose a business type" —
  now "Tap what you sell." (EN/HI, onboarding only).
- **Estimates check (A7):** the QA shop has never had an estimate (0 of 30 in
  the whole database; it has 1,612 bills), so `/sales/estimates` shows its
  empty state and the grid check cannot pass there. Not B1; A7's harness needs
  to create one first.
- **Still open:** the competitor comparison for this screen (being researched
  in the design thread); "What do you sell?" as its own step (the design) —
  the owner kept it in step 1 for now.

## Competitor comparison (gate 11), 30 Oct 2026

Full table: `docs/research/b1-pick-what-you-sell-competitors.md` (from the
design thread; primary sources only, no hands-on use; unproven cells marked).
- **Better (proposed, not hands-on tested):** Vyapar, myBillBook and BUSY do
  not change features by business type; Vyapar's own guide turns on batch
  tracking in about 9 steps on a paid plan. B1 turns a medical shop's batch and
  expiry on from one picture tap.
- **Equal:** Square POS does the same pattern (a mode that sets features,
  changeable later).
- **Worse / at risk:** Square suggests a mode instead of asking; Square allows
  several modes per business while R-DEC-64 allows one kind; changing the kind
  later must be easy to find (B3).
- **Unproven:** no hands-on sign-up recordings of Vyapar, myBillBook,
  Khatabook or OkCredit yet.

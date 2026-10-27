# A5 — Spacing inside drawers and sheets

> **Status: IN TEST, not started building.** This file opens with the spec
> to check, written before any code (P0 standard, gate 1). Every row is
> measured on the running app at 390, 320 and 1280, light and dark, EN and HI,
> including with errors showing.

Design: §A5 of `docs/revamp/design/shop-fixes-and-business-types.html` (the
live artifact is the reference; re-check that the copy is identical before
building). Mocks: `pDrawer` (phone sheet, 90 % high) and `dDrawer` (desktop
right drawer, 480 px), both "Edit customer". CSS: `.sheet`, `.shead`,
`.sbody`, `.sfoot`, `.grp`, `.gt`, `.fld`, `.lbl`, `.inp`, `.hint`, `.swr`,
`.btn`.

## Spec to check (from the design's own CSS)

| # | What | Phone | Desktop | Source |
|---|---|---|---|---|
| S1 | Label → its box | 6 px | 6 px | `.fld{gap:6px}`; table "Label and its box" |
| S2 | Box → its hint or error | 4 px | 4 px | table "Box and its hint or error" |
| S3 | One field → the next, inside a group | 16 px | 16 px | `.grp{gap:16px}` |
| S4 | One group → the next | 24 px | 24 px | `.sbody{gap:24px}` |
| S5 | Group title | 12 px, weight 700, letter-spacing .06em, uppercase, ink-3 | same | `.gt` |
| S6 | Label text | 13 px, weight 600, ink | same | `.lbl` |
| S7 | Field height | 44 px | 40 px | `.inp` / `.dk .inp` |
| S8 | Field font | 15 px | 14 px | same |
| S9 | Field border, radius, padding | 1 px line-strong, 8 px, 0 12 px | same | `.inp` |
| S10 | Switch row | min 48 px, gap 12, no extra margin | same | `.swr` |
| S11 | Edge → content | 16 px | 24 px | `.sbody{padding:16px}`; table "Drawer edge and content" |
| S12 | Header | 56 px, title 17/600, sub 12.5 ink-3, padding 0 8 0 16 | the drawer's own | `.shead` |
| S13 | Footer | grid 1fr 2fr (Cancel, Save wider), gap 8, padding 12 16 14, top line | flex end, padding 14 24, Save last | `.sfoot` / `.dk .sfoot` |
| S14 | Buttons | 40 px (lg on phone), radius 8, 600 14 px; Save is cta, Cancel soft | same | `.btn` |
| S15 | Phone sheet | radius 18 18 0 0, max 92 % (mock 90 %), grab handle 36 × 4 | — | `.sheet`, `.grab` |
| S16 | Desktop drawer width | — | 480 px | §A5 "right drawer, 480 px" |
| S17 | Applies to | `PartyFormDrawer`, `ItemFormDrawer`, `PaymentFormDrawer`, `StockAdjustmentDrawer`, and every `UbDrawer`/`UbSheet` body | | §A5 "What changes" |

## Edge cases to run (written before building; `e2e/a5-edges.mjs`)

From the habits and catalogue:
- **Text:** long labels and Hindi, with every box's text inside its box (H18).
- **Errors:** an error under EVERY field, each in its own space, never
  squeezed (H4), and S2 measured with the error showing.
- **Phone keyboard and a 600 px tall screen:** the footer stays reachable and
  the focused field is not hidden.
- **Double-tap Save:** one record (H14).
- **Leaving and returning:** open a drawer, leave, come back.
- **Saves still work after the restyle:** each drawer's record is read back
  from the API by its id, with a self-test (H2, H3, H20).
- **Alignment:** labels and boxes on one left edge to within 1 px (H19).
- **Measured as a touch phone:** tap areas 44 px (H13).

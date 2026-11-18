# A2 — Folding sections (FB-012), 26 Oct 2026

Design: `docs/revamp/design/shop-fixes-and-business-types.html` §A2 (`.acc`,
`.acc-h`, `.acc-b`, `.acc-b.flush > .blk`). Base: `dev` at c690e6300.

The `a2-folding-sections.patch` named in the handoff was not on disk anywhere,
so A2 was rebuilt from its written description.

## Spec to check

| Design value (source) | Built | Verified by |
|---|---|---|
| `.acc` 1 px line, 12 px radius, card background, `overflow:clip` | root `rounded-card border bg-surface-card overflow-clip` | computed style, live |
| `.acc-h` min-height 52, padding 10/16, gap 12 | `min-h-[52px] px-4 py-2.5 gap-3` | measured 52 px (one line); 59–61 px with the summary line (EN/HI) |
| `.acc-h b` 14 px / 600 | `ds-body-s-semibold` | computed weight 600 (was 400: `ds-body-sm-semibold` does not exist, found by measuring) |
| `.acc-h small` 13 px ink-3 | hint at 0.8125 rem, tertiary | screenshot |
| header has no own corners; focus ring on the box | trigger square; `has-[>button:focus-visible]:shadow-focus` on root | unit test + computed radius 0 px |
| open: rule under header | panel `border-t` | screenshot |
| `.acc-b` 16 padding, 16 gap | unchanged default | measured 16 px |
| `.acc-b.flush` 0 / 0; `.blk` 14×16, gap 8, rule between | `flush` prop; `PartyInfoPanel bare` sections `px-4 py-3.5 gap-2`; `UbPanel bare` | measured 14/16/8, live |
| summary under the title, closed and open ("25/10/2026 · Maharashtra (27)") | existing `hint`, already passed by the bill and purchase editors | screenshot, both states |

## Defects found by looking, not by tests

1. **Doubled rule** under the Details header (152/153 px) and between Business
   and Terms (231/232 px). The first section (Contact) renders nothing, yet
   `UbPanel` drew a divider before it because it counts React children rather
   than DOM. It affected the boxed desktop panel too. Now an orphaned divider
   (first, last, or next to another divider) is hidden by CSS. Re-measured: one
   visible rule per boundary.
2. **Title weight 400.** The class name did not exist. Fixed and measured at 600.
3. **Details had no summary.** The design's closed Details reads "Price list,
   notes, record". It now carries `parties.detail.detailsHint` (en/hi).
4. **The summary joined the accessible name** ("Details Address, GST, …").
   That was found by a failing page test, not by looking. The button is now
   labelled by its title and described by the summary, which is pinned by a
   test.
5. **"Terms" heading over an empty row** while the price-list row was still
   loading. A heading-only section and its divider are now hidden in the info
   panel.

## Callers reviewed

There are 18 other `UbDisclosure` callers. None passes a grey header class.
Changes, by caller:

- Shop callers (PaymentFormDrawer, ItemFormDrawer, ItemPriceFields,
  StockAdjustmentDrawer, PartyFormDrawer, InvoicePartySection,
  PurchaseBillHeaderSection, InvoiceProfitCard, CashbookDayCard,
  ImportReviewStep, ShopPromiseControl) inherit the new root and header
  automatically.
- Their contents are form fields or text rows, not bordered panels, so `flush`
  is not appropriate for any of them.
- ShopHomeWorkspace's "More reports" holds chart cards. Drawing them bare is a
  composition change not drawn in A2, so it was left as is.
- Library callers are untouched (frozen contract).
- The bill's card-around-More-details is A3's composition.

The "grey header" seen in the first bill screenshot was the hover fill. The
harness left the pointer on the header after clicking it. `hover:` is limited
to `(hover: hover)` devices, so a phone tap does not keep it.

## Evidence

- `e2e/a2-disclosure-look.mjs`: 50 views (390/320/1280, light and dark, EN;
  320/1280 HI), covering customer Details, the new bill's More details and the
  item form. Result: 0 measured failures, no page overflow, 0 console errors or
  React warnings after sign-in. Every view was looked at.
- Tests: new UbDisclosure tests (2) fail on the old component and pass on the
  new one. The new UbPanel test checks the class only, because jsdom applies
  no CSS; the browser measurement is the proof.
- Gates: type-check clean; changed-file eslint/prettier clean; jest 4876/4876;
  build OK; bundle:check OK after the budget note (shared app 114.9 → 115.0 KB
  gz; /parties/[id] route 117.3); contrast and i18n checks pass.

## Not verified

- Re-render counts: not needed for this change, which is classes only, with no
  new state or effects.
- Busy-counter abuse: A2 changes no data flow, so there is nothing new to
  stress.
- Physical phones and keyboard focus-ring visuals: checked only through the
  unit test and computed classes; no screenshot of the ring was taken.
- Performance timing: not measured. The change is CSS and props only, so no
  speed claim is made.

| Point of view | Score | Evidence | Still weak | Confidence |
|---|---|---|---|---|
| Function (phone / desktop) | 8.5 / 8.5 | open/close, forced-open on error unchanged, tests | Item form section not opened by the harness | medium |
| UI/UX (phone / desktop) | 8.5 / 8.5 | measured against `.acc`; 50 frames | Focus ring not photographed; Home charts still boxed | medium |
| Busy use | n/a | no data flow changed | — | — |
| Performance | not measured | CSS-only | — | — |

## Backend gate: four failures already on dev (not A2)

This piece changes no backend file. On c690e6300, `pytest` reports:

- `test_every_tenant_table_is_registered_for_export_and_deletion`:
  `parties.PersonalBook` is not registered.
- `test_app_only_imports_allowed_apps[parties]`: `parties/urls_personal.py`
  imports `apps.ledger`.
- `test_services_never_import_the_http_layer`:
  `parties/services/personal_book.py` imports DRF.
- `test_close_over_twenty_thousand_copies_takes_under_five_seconds`: a Library
  timing test, run while a build was competing for the CPU.

The first three come from the personal Udhaar work, which the owner placed out
of scope for this Shop programme. They are reported here, not fixed.

# Purchase detail §6 · 23 Oct 2026 (R-DEC-27/29, R-DEC-34)

Scope: `/purchases/bills/[id]`, `/purchases/orders/[id]`, `/purchases/debit-notes/[id]`
— one `PurchaseBillDetailPageContent`. Covers order → bill and the return
(debit note) entry from a bill. The debit-note drawer and void dialog
themselves are the existing ones; only the void dialog's refusals changed.

## Spec-to-check map (09 §6)

| Requirement | Check | Status |
|---|---|---|
| Phone: number + supplier (wraps), status; Total · Paid · **To pay** first | unit test (DOM order) + harness: money above actions above lines at 390/320, EN/HI | passed |
| Pay supplier (marigold), allocated to this bill | harness: paid ₹100 from the page, server To pay fell by exactly ₹100, payment listed | passed |
| "Something's wrong…" chooser, supplier words: entered wrongly → void; goods went back → debit note | unit tests; LOOK 390/320 EN/HI | passed |
| "Supplier gave money back" | hidden: the page has no supplier-advance figure to gate it on (§6 risk note says hide if not verified) | deferred, reason recorded |
| Void keeps number, payments become advance | harness: status void, amount paid 0, due = total, toast "₹100.00 stays as advance" | passed |
| Debit note stands → "Cancel debit note DN-… first" with link | harness: real 409, link to that note, bill unchanged on server | passed |
| Supplier archived → restore message with link | unit test (server 409 mocked); not exercised live | passed (unit only) |
| Goods sold → per-line refusal in dialog | existing unit test kept | passed (unit only) |
| Order billed once; Create bill from order | harness: order → billed, lands on the new draft's editor | passed |
| Cancel order, Delete draft | Cancel: unit test; Delete draft: harness (server 404 after) | passed |
| Offline: writes disabled with the reason | unit test | passed |
| Lines with cost, links, payments; two columns from 1280 | LOOK 1280 EN/HI | passed |
| Average cost never promised unchanged | existing unit test kept | passed |

Deviation, recorded: §6 puts Cancel order / Delete draft behind ⋯ and the
desktop actions in the header. They sit in the same two-up action row as the
bill page (§2) because no kind ever has more than two acts; one row on both
sizes is fewer taps and one place to look.

## Found by looking, fixed

- **"Less debit notes ₹126.00" lost its minus** — a deduction read as money
  added to the bill. Now "−₹126.00", with a test.
- To pay / totals carried an empty sign slot (indented ₹); now `inline`.
- An order's and a debit note's lines were titled "Items on this bill"; now
  "Items on this order" / "Items sent back".

Seen, not changed (not this piece): "Round off -₹0.27" uses a hyphen from
`formatInr`; the void time on the banner is formatted in the browser's zone.

## Harness

`e2e/purchase-detail.mjs` — 118/118 on the final build
(`data/2026-10-23-purchase-detail/purchase-detail-harness.log`): five pages ×
390/320/1280 × EN/HI for overflow, cut text and ≥44 px actions, plus the
five real journeys above against the local API.

## Performance · old 216d456 vs new, old/new/old/new × 3 reps

Case `shop.purchase row→detail` (new in `e2e/perf-app.mjs`). Content-ready ms, median.

| viewport | profile | old → new | rounds old / new |
|---|---|---|---|
| 390 | 4x CPU | 1437 → 1344 | 1440,1434 / 1346,1338 |
| 390 | unthrottled | 318 → 268 | 338,297 / 257,279 |
| 1280 | 4x CPU | 1245 → 1292 | 1326,1164 / 1303,1247 (mixed, within noise) |
| 1280 | unthrottled | 282 → 276 | mixed |

Phone is faster in both rounds (−93 ms at 4x CPU, n=6 per side); desktop is
mixed. Route +0.5 KB (chooser sheet, delete confirm, drawer launcher).

## Gates

Type-check, Jest 4,686 passed, lint 0 warnings, build, bundle (purchase detail
routes and `/onboarding/step/[n]` raised to measured + 0.3; onboarding's +0.5 KB
has no source change of its own — shared-chunk regrouping, not isolated),
i18n check.

## Scores (purchase detail only, provisional)

| Point of view | Score | Evidence | Still weak | Confidence |
|---|---|---|---|---|
| Function | 8.7 | Five real journeys read back from the server | Archived-supplier refusal seen only in a unit test | Medium-high |
| Busy shop | 8.5 | To pay and Pay supplier above the fold at 390/320 | "Supplier gave money back" absent | Medium |
| UI/UX phone | 8.5 | EN/HI 390/320 measured, deduction sign fixed | Physical device not tried | Medium |
| UI/UX desktop | 8.2 | 1280 two columns | "Something's wrong…" wraps to two lines in the 360 px column | Medium |
| Performance | 8.2 | Phone −93 ms both rounds | Desktop mixed | Medium |

Competitor comparison: none gathered — unproven. Not above 8.5 overall.

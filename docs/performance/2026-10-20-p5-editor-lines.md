# Billing editor: compact line editing and readable totals

20 October 2026. R-DEC-27 next source-workflow piece. **Component checkpoint verified locally; whole editor remains in progress.**

Review:07-screens/09 §3 and committed Counter Mode HTML #footer. Existing
shared controls, field array, pricing defaults, tax preview, document issue and
recovery services remain the owners. Add an opt-in compact card summary to
UbLineItemsEditor; sales opts in, existing inventory and purchases callers keep
their full forms until separately reviewed. One expanded line at a time, stable
field IDs when removing a row, quantities retained across collapse, newly added
row opened/focused, validation opens the invalid row. Long selected labels gain
an opt-in wrapping trigger. Shared sales/purchase total dock stacks actions below
the total on phones, with full money and wrapping action labels.

Old-build browser evidence at320 light/dark:338px full item card; long selected
name and even₹1,180 total clipped. Large stress amount clipped too. The baseline
harness fails compact-row and geometry checks. QA setup creates one electrical
item and an unissued50-line local draft only; visual states intercept the draft
read for1/10/50 lines and large price. No documents issued or stock/money moved.

Final regression tests cover quantity persistence, one expanded form, newly
added focus, and reopening/focusing errors on collapsed rows. Existing keyboard,
default full-card and table ownership tests remain green.


Native-size LOOK found an additional defect after the first76 label-based
checks passed: the320px Hindi large rate clipped inside its input. A new canvas
font/value-width measurement fails both old themes (`12,40,378.00` in Rate).
Opt-in compact fields now stack below360px; default purchase/inventory full-card
layout remains unchanged. Final acceptance includes numeric input values,
not only DOM text nodes. Do not use the earlier76 passes as final sign-off.

The new input check also fails the desktop1280 Rate field in both themes and
locales. Increase only that column's minimum from6.25rem to9.5rem; the existing
own-width `tableWhen=fits` calculation still decides table vs cards. No smaller
font or ellipsis substitutes for readable prices. Narrow-phone fields stack only
for compact opt-in callers; standard shared card callers retain their layout.


## Final acceptance

- Changed-file ESLint `--fix --max-warnings=0`, type check, **408 suites/4,550
  tests** (103.775s), standard production build, bundle check and174 contrast
  pairs pass. Jest and build ran sequentially. No locale changes, new package,
  API/model/migration, pricing formula, stock or ledger service changes.
  Full cloud lint exceeds25 minutes; changed-file lint used as prescribed.
- The first restricted Turbopack worker error remained in the generated cache.
  Backing up `.next/cache/turbopack` allowed the standard build to pass; no
  webpack fallback or application/config workaround. Standalone frontend was
  restarted and assets copied after every successful build used for acceptance.
- **84 measured frames**:58 English at390/320/1024/1280 light/dark,26 Hindi
  at320/1280 light/dark.1/10/50 lines, empty lines, all collapsed, second row
  expanded, invalid collapsed row and large price. All pass text, computed-label
  contrast, page width and numeric-input font/value-width checks. Twelve final
  contact sheets plus native phone/desktop captures were inspected.
- Old320 full forms measured338px per row. Long test names now use90px collapsed
  English summaries (70px where the name fits on one line at1024). With one row
  open at320, measured row-height sum for10 lines falls3380→1417px (58.1%);
  for50 lines16900→5017px (70.3%). These are row-height measurements, not page
  height, loading speed or merchant task-time claims. Narrow expanded forms are
  taller so full rate/quantity fields remain readable.
- Only sales opts into compact summaries. Purchases/inventory keep their full
  cards; sales/purchase total docks share the phone stack. Long selected-label
  wrapping is an opt-in primitive, not a duplicated picker. Stock-short warnings
  remain visible when their row collapses. Default item pricing and historical
  invoices are not edited by these presentation changes.
- Bundle cost:24 exceeded scalars across12 sales/purchase editor routes raised to
  measured gzip+0.3KB, reason written in bundle-budgets.json. Added code costs
  0.3KB on purchase editor routes and0.5–0.6KB on sales routes; framework127.3KB
  and shared app113.7KB unchanged. No general shared or unrelated route ceilings
  raised. Final gate passes.

Artifacts: chat workspace `artifacts/shop-editor-lines-2026-10-20/`, including
final mobile/desktop/Hindi captures, states and contact sheets. Raw results in
`docs/performance/data/2026-10-20-editor-lines-*.json`; failing numeric-input
proof in `2026-10-20-editor-input-before-hi.json`.

## Scoped review and next

Provisional component self-review **8.73/10** (09 weighted rubric) for scanning/editing lines and
readable totals. This is not independent merchant research or a whole POS score.
Physical phones, keyboards, OS text scaling, installed PWA and scanner/printer
hardware remain unproven. These visual fixtures do not replace real issue,
autosave/recovery, payment/stock/ledger end-to-end acceptance for the editor.

Continue the same billing/POS family: always-visible item search, compact customer
context, full editor composition, save/offline/keyboard states and actual issue/
recovery/business flows. Then purchases/returns, inventory, money/expenses/reports,
and only then remaining Home features (R-DEC-27). No routine permission question.


|Mobile20%|Ease15%|Visual15%|Feedback15%|A11y10%|Desktop10%|Safety10%|Reuse5%|Weighted|
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
|8.5|8.8|8.8|8.7|8.6|8.8|8.9|9.0|8.73|

Mobile/assistive-device confidence is lower than the reusable component score;
the physical keyboard/screen-reader proof and whole editor business acceptance
above remain required. This score cannot certify the Shop module pass mark.

## Quiet navigation

12 final-build Home→Customers samples, three per profile/viewport, with no browser
matrix/test/build competing. First-change p50/p95, content p95 in milliseconds:

|Viewport/profile|Before first change|After first change|Before/after content p95|
|---|---:|---:|---:|
|390 unthrottled|31/32|32/34|240/244|
|390 throttled|30/32|31/33|773/774|
|1280 unthrottled|29/33|29/29|566/562|
|1280 throttled|28/29|28/29|1132/1127|

Before is the prior Home source-facts build's quiet same-route run; final editor
changes were absent. F4's broader48-route sample p95 was168ms without Lending
Today, baseline156ms. These narrow local results do not imply an app-wide speed
gain or faster billing. Measured row density is the benefit proved here.

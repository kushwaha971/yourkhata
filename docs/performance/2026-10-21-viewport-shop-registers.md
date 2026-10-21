# Viewport rollout group1 — Customers, Suppliers and Bills

21 October2026, starts from a15ac914. R-DEC-31 authorizes this shared layout
migration; it is not a second full redesign of these already-reviewed screens.

## Pre-implementation acceptance mapping (R-DEC-32)

| Requirement/source | Implementation target | Verification | Status |
|---|---|---|---|
| R-DEC-31 rows-only scroll/pinned paging | Shared viewport wrapper and DataGrid fillHeight | Document height, scroll movement, footer position/hit tests | Verified below |
|08 §1/2 customer/supplier composition | Preserve toolbar, role summaries and row actions |390/320/1024/1280 en/hi/themes and long data | Verified below |
|09 §1 Bills register composition | Preserve search/status/period/server totals | Same viewport/visual sweep and actual paging | Verified below |
| Existing mobile Show more | Keep manual loading and preserve row offset when appending | Actual second-page request; no eager fetch-all loop | Verified below |
| Separate customer/supplier/Udhaar roles | Opt in only existing compactShop branch | Route/permission tests and unchanged APIs/figures | Verified below |
|32px chip face/44px mobile target | Preserve component defaults; do not add min-height overrides | Computed size and hit-test | Verified below |
| Global errors do not block paging | Reuse existing bottom clearance | Error/retry footer button hit tests | Verified below |
| No duplicate code/business logic | Reuse existing viewport/grid; extend one scroll-reset option if needed | Code review and regressions | Verified below |

User value: find the next record or page without losing search/actions above the
fold. The Shop mobile customer/supplier footer is a manual Show more button,
not an automatic sentinel. Other modules' UbLoadMore usages still need individual
review. Do not infer that this group already covers them. Preserve API paging,
source totals and append behavior. Comparative superiority remains unproven;
existing reference/Customer/Supplier reports establish composition, not a claim
of being faster than another product. Full module/financial workflows remain
under their existing acceptance and frozen-contract boundaries.

## Delivered scope and reason

Customers, Suppliers and Bills now opt into the same bounded viewport/grid
used by Purchases. The toolbar and manual/paged footer stay outside the row
scroll region. No copied viewport offsets or new business engine. The existing
approved Customer/Supplier/Bill composition remains the acceptance reference.
This is the shared behavior rollout, not a second whole-module certification.

Mobile Show more remains manual. Appending preserves row position; changing the
result-set filters resets it. Ordinary paged grids still reset on page changes.
The shared optional scrollResetKey/resetScrollOnPageChange behavior has two
fail-before assertions in one regression test. Only the existing Shop kind-specific branch opts in;
Udhaar is not silently migrated or mixed with Shop.

The short-phone/offline sweep initially found a zero-height row region. Removed
redundant short-height captions and reduced viewport-only/footer gaps. All money
figures remain visible; counts remain in the status chips/assistive text. The
320x600 row region now has at least43px (44px with1px layout tolerance), with
real footer hit testing above navigation. This extreme case still shows only
part of a record at once; internal scrolling is necessary.32px visible chips
retain44px mobile hit areas rather than becoming44px faces.

## Evidence and gates

- Full frontend:416 suites /4,648 tests pass,103.697s. Changed-file lint,
  type check, locale split/check, production build, bundle gate and174 contrast
  pairs pass. Full cloud lint exceeds25minutes; it was not substituted for the
  documented changed-file gate. Existing test act/network/worker-teardown
  warnings remain in raw logs; this is not a warning-free claim.
-522 final frames:174 live viewport/paging/append/search/offline/short-height;
  108 Customer states;120 Supplier states;102 Bills states;18 Purchases
  regression frames.390/320/1024/1280, light/dark, Hindi320/1280 in the main
  families. Loading/empty/filtered/error/busy/refreshed/long names/large money
  use the existing state harness. Supplier Pay is opened/read/closed, not saved.
- All11 contact sheets and selected native frames inspected. Computed label
  contrast>=4.5:1, own-box text checks, page width, document height, actual row
  scroll and footer hit targets pass. Native short-phone frames additionally
  inspected. Existing shell business-name ellipsis is a documented separate
  shell limitation, not a new claim of whole-app text compliance.
- Fail-before logs retain append/context reset failures, original document
  growth (390px: Customers2242px, Suppliers2214px, Bills2069px), and the short
  viewport failure. Final green runs do not relabel those original runs.
- No backend code/schema/API/calculation changes. No fresh backend financial
  write certification claimed; this group uses read-only local seeded QA.
  Existing role/source fences and financial tests remain in the full frontend
  suite. No Railway/production data or external messages touched.
- Bundle ceilings changed only for measured rounding-sized route growth: one
  Library-copy first-load ceiling and five route-byte ceilings, each documented
  in bundle-budgets.json; no framework/shared/default cap raised. Library's
  list behavior itself is not migrated by that shared optional-code change.

Raw checks: data/2026-10-21-viewport-shop/. Screenshots/contact sheets remain in
artifacts/viewport-shop-2026-10-21 under the chat workspace, outside Git.

## User value, necessity and competitive claims

Keeping paging reachable removes the need to scroll through25 records just to
change page; append preserves the merchant's place. Short-height reduction keeps
source money and actions rather than spending height on duplicate labels.
No new menu, workflow or financial feature was introduced solely for appearance.
These are necessary usability requirements, not evidence of unique competitive
superiority. Existing official competitor capability comparisons remain in the
purchase-register report; no competitor task-time/user study was run here.
Whole-app requirement coverage is explicitly pending in11's rollout matrix.
Physical phones/PWA, keyboards, OS scaling, assistive technology, hardware and
merchant research remain unproved by desktop Chromium emulation.

## Next scope review

The other sales lists use SalesFlowListPageContent, not InvoicesListPageContent.
Their older stat-card/status-in-sheet composition must be checked against09 §1
before the next rollout. Do not infer Estimates/Orders/Challans/Credit Notes are
complete merely because Bills passes. Continue the approved composition with
existing components and existing document-kind permissions, not a blind global
grid default. Purchase-detail/full financial journeys remain in R-DEC-27's
order after the shared-list rollout; remaining Home work stays last.

## Scoped review (provisional self-assessment)

This rates the implemented viewport/paging behavior only. It does not raise
whole-module feature coverage scores, certify all APIs, or replace merchant
research. Functional requirements remain separate pass/fail gates above.

| Point of view | Score | Evidence | Still weak | Confidence |
|---|---:|---|---|---|
| Function / phone |8.8|Actual API paging, append offset and new-search reset; full suite|No new financial-write journey in this layout piece|High for checked reads|
| Function / desktop |8.8|Actual paging and source totals; controls/links retained|No all-API certificate|High for checked scope|
| Busy shop / phone |8.7|Show more stays reachable,44px targets; no document-length trip|320x600 plus banner leaves only part of a row visible; hardware unproved|Medium|
| Busy shop / desktop |8.8|Rows scroll separately, pager stays in reach; keyboard region retained|No timed merchant task study|Medium|
| UI/UX / phone |8.7|Final English/Hindi/light/dark frames,32px faces, short/offline sweep|Physical text scaling/keyboard unproved|Medium|
| UI/UX / desktop |8.8|1024/1280, source figures and long names, bounded table|Omitted shell work remains separate|Medium|

09 rubric for the scoped design: Mobile8.7, Ease8.8, Visual8.7,
Feedback8.7, Accessibility8.7, Desktop8.8, Safety8.8, Reuse9.0.
Weighted result8.75/10. Performance rows follow the completed A/B below;
this design rating is not a whole-feature or competitive ranking.

## Same-machine navigation A/B

Parent a15ac914 built in /tmp/yourkhata-viewport-shop-base-a15; current build in the main checkout. Serial old1/new1/old2/new2, same API/seed/browser, no test/build/browser workload competing. Four paths ×3 repetitions ×2 widths ×2 profiles ×4 runs =192 valid samples; zero timeout/error samples. CPU4x and1.6Mbps/150ms RTT throttled profile,390px phone and1280px desktop. Six pooled samples per path/profile/build; p95 is nearest-rank (the maximum at n=6). Both cold first-repetition tails are retained.

The initial Library control attempt failed because the phone nav link was not visible. It was stopped, retained as control-selector-failed.log and excluded; all four final runs use Purchases as the already-delivered control path. Purchases shares optional grid code, so it is a navigation control, not an entirely untouched-app control. Main frontend restored after the final run.

| Width/profile | Path | Old content median/p95 ms | New content median/p95 ms | Median delta ms | New feedback median ms |
|---|---|---:|---:|---:|---:|
|390 / unthrottled|shop.customers→bills|100.5/422|105.0/416|+4.5|29.5|
|390 / unthrottled|shop.home→customers|241.0/275|246.5/270|+5.5|31.5|
|390 / unthrottled|shop.home→purchases|82.0/88|79.5/82|-2.5|3.5|
|390 / unthrottled|shop.home→suppliers|142.0/151|146.0/151|+4|34.0|
|390 / throttled|shop.customers→bills|532.5/901|546.5/908|+14|30.0|
|390 / throttled|shop.home→customers|537.0/748|553.0/761|+16|31.5|
|390 / throttled|shop.home→purchases|540.0/930|540.0/916|+0|7.0|
|390 / throttled|shop.home→suppliers|528.0/549|544.0/580|+16|30.0|
|1280 / unthrottled|shop.customers→bills|96.0/106|103.5/115|+7.5|30.5|
|1280 / unthrottled|shop.home→customers|530.5/544|538.0/550|+7.5|30.0|
|1280 / unthrottled|shop.home→purchases|382.5/426|385.0/417|+2.5|27.0|
|1280 / unthrottled|shop.home→suppliers|442.5/453|447.5/455|+5|30.0|
|1280 / throttled|shop.customers→bills|541.5/928|555.0/927|+13.5|31.5|
|1280 / throttled|shop.home→customers|846.0/1079|856.5/1100|+10.5|26.5|
|1280 / throttled|shop.home→purchases|834.0/1249|833.0/1239|-1|26.0|
|1280 / throttled|shop.home→suppliers|846.0/866|864.0/894|+18|25.5|

Observed target-route medians increase4–18ms (roughly1–3% depending on path/profile); the Purchases control moves−2.5 to+2.5ms. Do not call this a speedup or prove the increase is noise. The extra bounded-layout behavior buys reachable paging, with a small observed navigation cost. These sample counts do not isolate its causal contribution. Larger route tails remain visible above. F4/17Oct baselines are historical context only; this same-machine A/B is the valid current comparison.

New runs: first-change median28.5ms; maximum36ms. Total long tasks through content:0. Event Timing maximum64ms. First DOM change is the harness feedback marker, not field INP or a whole-merchant task-time result.

| Point of view | Score | Evidence | Still weak | Confidence |
|---|---:|---|---|---|
|Performance / phone|8.6|A/B6 samples per case/profile/build; target throttled medians544–553ms|Observed14–16ms increase; real PWA/task time unproved|Medium|
|Performance / desktop|8.6|Target throttled medians555–864ms; no long tasks in measured transitions|Observed10.5–18ms increase; first-run tails up to1.1s on target routes|Medium|

No whole-app or all-module performance pass is claimed.09's strict whole-module score gate remains separate; this scoped delivery cannot certify unfinished module workflows.


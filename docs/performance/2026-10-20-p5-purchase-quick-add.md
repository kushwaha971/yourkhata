# Purchase counter: shared quick-add and line finder

20 October 2026. R-DEC-27/29, purchase editor §7 step 1. Review before build:
ItemQuickAdd belongs above the line editor; repeat item raises Qty; barcode entry
retains the search caret and a list pick goes to Qty. Named lines become findable
from 10 with line number/name/quantity/unit distinguishing repeated names. The
sales implementation already owns these interactions: extract it, do not copy.
Purchases retain their own `pick` and cost/tax/default owner. Sales retains its
price-list/default/stock owners. No backend/schema/posting or Library/Lending
workflow changes. Remaining purchase composition steps 2–6 are separate pieces.

Fail-before: two new PurchaseBillEditor tests fail against c87aa514 because the
always-visible search is absent; 17 existing tests pass. Tests specify a third
line selected from search with Qty focus, cost 42 preserved without recording,
and barcode Rice raising existing Qty 20→21 with two rows and search focus.
Step 1 is delivered below; this is not whole purchase-module completion.


Review clarification: §7 requires compact cost rows as §3, although the handoff's
step 1 omitted that renderer. Both editors now use one CounterLineSummary rather
than copying sales markup into purchases. This is the approved counter
composition (top search, finder, compact rows), not spacing polish on the old
full-card layout. Purchase cost notes retain their behavior/wording for step 4.
The purchase cost track fits large money and selected names wrap; narrower
compact fields reuse the existing design-system stack.

The pre-existing customer-summary test fails on unchanged c87aa514 and the new
code when it clicks a pending old search option. Waiting for the current,
selected answer passes on both builds. Only the test readiness condition changes;
customer composition/permissions/queries are untouched by this piece.


## Verification checkpoint

- Changed-file ESLint with `--fix --max-warnings=0`, TypeScript, full Jest:
  **412 suites / 4,596 tests pass** in 106.795 s. Jest reports a worker that
  needed forced teardown; do not silently relabel this as a warning-free run.
  Focused purchase/sales/shared-hook group: 3 suites / 68 tests pass.
  Full cloud lint remains >25 minutes; the required gate is changed-file lint.
- Locale split/check: 6,644 keys / 57 catalogues, current en+hi. The existing
  catalogue-loading diagnostics remain warnings; no new catalogue is added.
- Standard Turbopack production build passes. Initial bundle gate correctly
  refused the editor growth; only twelve editor route/first-load budgets now
  use measured +0.3 KB. Final bundle gate passes. Framework 127.3 KB and shared
  app 113.7 KB stay under unchanged ceilings. All 174 contrast token pairs pass.
- No backend/model/schema/financial engine or customer document change. This
  piece exercises drafts, not Record, payout or stock posting. Their complete
  purchase acceptance follows the remaining §7 pieces, not this checkpoint.
- Browser: `e2e/revamp-purchase-quick-add.mjs` on both live local tiers,
  seed_scale owner, QA database `revamp_20261018`, console OTP provider. English
  390/320/1024/1280, Hindi 320/1280, light and dark. Empty/search/list pick,
  repeat scan+list, no match, long ten-line bill/large cost, finder and focused
  line. Zero main-page overflow, text cuts and computed label contrast failures
  in the first 96 frames; numeric input values measured using their actual font
  against the input content width. Six contact sheets and native 390 light,
  1280 light and 320 Hindi dark frames inspected. Expanded text is wrapped.
  The inherited shell business-name ellipsis is outside this piece's root;
  this is not an all-shell clipping certificate.
- On untouched c87aa514 the same browser harness fails waiting for the absent
  always-open item search. This independently proves the new flow assertion
  rejects the old composition. Existing purchase `pick` remains the sole owner
  of unitCost/lastCost/taxCode/itemTaxCode; repeats change Qty only.

## Performance method

`e2e/perf-billing.mjs --side=purchases` extends the existing harness rather than
copying it. Enter→line ends when the requested row's Qty is mounted and focused,
polled with rAF; Event Timing is recorded by phase. This is a different endpoint
from the older sales dock-count measurement, so no cross-harness speedup claim.
Thirty distinct items, phone 390 px CPU×4 and desktop 1280 px, no concurrent
build/tests. Phone median 34 ms, p95 43, last-five median 38; slowest picking
Event Timing 24 ms, search 56, Qty 40. Desktop median 33 ms, p95 50,
last-five median 50; slowest picking 32, search 48, Qty 48. Both 30/30 picks,
zero scanner lookups during list picks. These are this Mac's emulation numbers,
not a comparison with the previous cloud/container and not physical-device INP.
The first timing run printed results but failed writing its absent output folder;
the harness now creates the directory and a complete rerun saved the raw events.

Navigation A/B completed: c87aa514 detached worktree with hard-linked real
node_modules, standard build, same API/database and alternating old/new/old/new.
Only task-owned frontend processes restart. Reps=3 at 390/1280, both profiles,
Customers and Suppliers from Home (both unchanged control routes). The first
attempted Library control timed out on the old build because its nav link was
unavailable in this QA context; preserved as a failed attempt, not pooled.
Final pooled numbers and rating table follow below. The parent build passes compilation but its separate bundle gate has 61 pre-existing ceiling violations on this Mac (mostly 0.0–0.2 KB); this is preserved in bundle-old.json, not called green. The current build has zero violations.

## Limits and next

No external messages, production writes or Railway deployment. Run-created
purchase drafts are deleted; one named untracked electrical item is reusable on
the local QA tenant. Item purchase defaults are checked before/after the draft
run. Actual hardware scanners, installed PWA, OS keyboards/text scaling,
TalkBack and merchant research remain unproved. Offline and expired-session
purchase durability is still the explicit §7 risk; no device-copy promise is
introduced. Next: dock caption/meta, honest save/leave state, cost-update words,
payment-refusal recovery, supplier summary, then list/detail/returns. Home last.


## Final measured results

The strengthened final look run has **108 passing frames** (72 en, 36 hi),
including actual open option text/contrast, page/input width, an edited Qty
saved and read back from the server, and unchanged item purchase defaults.
All run-created draft IDs were deleted. No page errors. The initial 96-frame
pass above is retained as history, superseded by these stronger final checks.

| Navigation content ready, pooled median | Parent | New | Samples each |
|---|---:|---:|---:|
| Phone, unthrottled | 229.5 ms | 216 ms | 12 |
| Phone, CPU/network throttled | 526 ms | 526 ms | 12 |
| Desktop, unthrottled | 528 ms | 531 ms | 12 |
| Desktop, CPU/network throttled | 840 ms | 840 ms | 12 |

96 successful navigations total, old/new/old/new with 3 reps each. Unthrottled
run-to-run medians vary by ~48–52 ms; a 3 ms pooled desktop difference is not a
regression claim. Throttled pooled medians are identical. This is unchanged
navigation in these cases, not a purchase task-time improvement or an all-route
performance certificate. F4 and 17-Oct reports remain historical references;
this same-machine parent comparison is the relevant before/after control.

Final representative editor run includes a REAL supplier and last-cost queries:

| Enter→mounted/focused Qty, 30 items | Phone 390 CPU×4 | Desktop 1280 |
|---|---:|---:|
| Median / p95 | 36 / 48 ms | 38 / 51 ms |
| Last five median | 38 ms | 51 ms |
| Slowest Event Timing while picking | 80 ms | 48 ms |
| Slowest typing search / Qty | 56 / 40 ms | 48 / 48 ms |
| Successful picks / barcode fallbacks | 30 / 0 | 30 / 0 |

Both supplier-inclusive drafts deleted. Earlier 34/33 ms supplier-empty run is
not the representative final score. No claim that the deferred whole-form
subscription problem is fixed or that these Mac results match a physical phone.

| Route gzip, same-Mac builds | Parent | New | Delta |
|---|---:|---:|---:|
| Purchase bill new | 160.6 KB | 164.2 KB | +3.6 KB |
| Sales invoice new | 167.4 KB | 168.2 KB | +0.8 KB |
| Customers / Suppliers | 91.3 KB | 91.0 KB | −0.3 KB |

The earlier approximate growth update described over-budget bytes, not parent
byte deltas; this table is the exact before/after. Purchase first load 405.1–405.2
KB; sales 409.1–409.2 KB. Budget annotations explain what the bytes buy; the
finder remains a dynamic module, not eagerly imported into every editor.

## Scoped review — counter quick-add/lines, not the whole purchase editor

Provisional self-assessment from code, frames, tests and measurements; no merchant
research. “Still weak” explicitly keeps hardware/full-workflow uncertainty.

| Point of view | Score | Evidence | Still weak | Confidence |
|---|---:|---|---|---|
| Function · phone | 8.8 | Cost/tax default ownership preserved; scan/list Qty; edited draft readback; full tests | Record/payment/recovery are later pieces | Medium |
| Function · desktop | 8.8 | Same adapter/engine, real saved draft, keyboard Qty/finder | Full Record journey not rescored here | Medium |
| Busy shop · phone | 8.8 | Top search; repeat item; scanner caret; ten-line finder; compact rows | OS scanner/keyboard not physical-tested | Medium |
| Busy shop · desktop | 8.8 | Search Enter→Qty, finder and repeated costs preserved | Printer/scanner hardware not tested | Medium |
| UI/UX · phone | 8.7 | 320/390, dark/light, Hindi; wrapping names and numeric widths | Supplier/dock/save composition steps still pending | Medium |
| UI/UX · desktop | 8.8 | 1024 cards/1280 table; wrapped names, large cost; six sheets reviewed | 1536 side-panel screen not in this piece | Medium |
| Performance · phone | 8.7 | 36 ms median, 48 p95, worst pick event80; navigation526 unchanged | Mac CPU emulation, not installed PWA | Medium |
| Performance · desktop | 8.8 | 38 ms median, 51 p95; navigation840 unchanged | +3.6 KB purchase route and no all-route timing | Medium |

09 rubric for this component: mobile8.7/ease8.8/visual8.7/feedback8.7/
accessibility8.6/desktop8.8/preservation8.8/reuse9.2 → **8.75 weighted**.
This component passes the provisional component bar; there is deliberately no
whole-purchase or whole-Shop score. The missing §7 save-state/refusal work means
the whole editor cannot yet be certified above8.5 in every aspect.

Raw evidence: `data/2026-10-20-purchase-quick-add/` (all four navigation runs,
bundle manifests, supplier-inclusive editor events, fail-before logs, final
computed look measurements). Screenshots/contact sheets are delivered with this
checkpoint from the chat workspace; reproduce with the committed local harness.


Teardown follow-up: the changed-suite `--runInBand --detectOpenHandles` run
passes all68 in18.712s and reports no named open handle. It still logs React
`act` warnings from the sales cash-finish test and a blocked test-network call
to127.0.0.1:9. It does not isolate the full-suite worker warning; that remains
recorded rather than claimed fixed. Raw diagnostic is retained with the data.
The twelve additional saved-state frames were inspected as a seventh contact
sheet after the initial six sheets; no new visual defect was seen.

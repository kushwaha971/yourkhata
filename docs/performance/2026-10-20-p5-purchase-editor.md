# Purchase editor completion — §7 steps 2–6

20 October 2026, dev. Continue R-DEC-27/29 from93c6d3fe. Scope: the remaining
approved purchase editor composition and business states, one verified commit
per piece. No new plan, no Home work or Library/Lending contract change.
Final whole-editor score waits for all pieces and end-to-end acceptance.

## Step 2 — the finishing dock

Review: the reference keeps the total, number of item lines, included GST and
save status beside Save draft/Record. UbTotalDock already owns caption/meta;
reuse those slots, sum existing engine tax totals with sumMoney, and render the
status once (dock below1536, header above). No financial calculation is copied.
Record remains the existing marigold primary action. Item count counts named
lines, not the sum of quantities. Zero-GST captions do not claim included GST.

Fail-before: the new PurchaseBillEditor regression fails on missing
`total-dock-caption`; after implementation it checks 2 items/GST₹139.10 and
exactly one server-save status in the dock. Full frontend:412 suites/4,597 tests
pass in121.745s, with the worker teardown warning still recorded, not hidden.
Changed-file ESLint --fix/max-warnings0, type check, locale split/check, standard
production build, bundle and174 contrast pairs pass. No budget increase.
Full cloud lint takes over25min; changed-file lint is the required gate here.

Live local QA:120 frames (80en/40hi),390/320/1024/1280, both themes, Hindi320/1280.
Body, actual dock, open option surfaces, numeric input widths and label colours
measured. Zero overflow/cuts/low-contrast labels/page errors. Delaying the actual
PATCH proves Saving is beside Record until the server responds, then Saved.
Real edited Qty7 is read back from the server; item defaults remain unchanged;
run-created drafts deleted. Six contact sheets plus native320 Hindi saved and
1280 dark saving frames inspected. Artifacts: chat workspace
`artifacts/purchase-dock-2026-10-20/`; reproducible with
`e2e/revamp-purchase-quick-add.mjs --piece=purchase-dock` (add --locale=hi
--widths=320,1280 for Hindi). Data: data/2026-10-20-purchase-editor/.

Navigation reps3 completed:24/24 cases, phone/desktop and both profiles on the
otherwise idle live stack. Throttled content medians are[(390, 521), (1280, 838)]ms; no speed improvement claim. The untouched93c6
worktree is built for the final fresh old/new/old/new comparison. F4/17Oct
baselines remain historical controls, not substitutes for same-Mac comparison.

Still pending: honest current-input save status and leave warning (step3), cost
update wording (step4),403 payment-refusal recovery (step5), supplier summary
verification (step6), then whole-editor functional/merchant/visual/performance
rescore. This dock delivery does not certify those remaining workflows.

## Step 3 — current-input acknowledgement and safe finish (21 October)

Saved now means the server acknowledged the current persisted inputs, not just
that an earlier request finished. Actor/business/document-scoped snapshots compare
exact decimal meaning; trailing zeros do not invent edits, while null source cost
and an explicit zero remain different. A delayed reply cannot overwrite newer
quantity/cost input. Omitted partial rows (including GST-only edits) remain
unsaved and block Record with row focus rather than being silently discarded.
Loaded server drafts count as saved. Purchases still keep no device copy.

Close and native unload warn on unacknowledged input; Keep editing retains it.
Offline disables Save/Record. One async lock spans save-before-record and paid-now
preflight. When cost is blank, Paid now first obtains the actual saved default
and total from the server; it does not offer payment against a zero preview.
Quantity/cost/discount are disabled during finish. The shared window-effects
hook was moved from sales, not copied. Sales keeps its existing behavior.

Real Chromium found two defects unit rectangles missed: focusing a server value
42.0000 expanded a two-place field underneath native select-all, leaving `00`
after Clear; and a stale validation snackbar covered the leave dialog. The
shared money input now preserves its configured focused precision without
changing the stored value on focus. Close clears the stale snackbar. A new
hit-test checks dialog text against the element actually painted over it.
Both regressions fail before the fixes, including two occluded text nodes.

Final gates: 412 suites / 4,611 tests pass (100.084s); the existing worker
teardown warning remains recorded. Changed-file lint, type check, locale
split/check, production build, bundle and 174 contrast pairs pass. Full cloud
lint exceeds25min. Meaningful fail-before logs and exact gate logs are in
`data/2026-10-20-purchase-editor/safety-*`.

Live QA:216 frames (144en/72hi),18 states at390/320/1024/1280 light/dark,
Hindi320/1280. All six final contact sheets and native Hindi320 leave and
1280 dark source-default frames inspected. Main/dock/listbox/dialog contrast,
text boxes, numeric widths, page overflow and dialog occlusion: zero failures.
Actual PATCH delayed at Qty7 while8 is typed: server7/UI8 stays unsaved until a
second acknowledgement. Null cost saves42; explicit0 saves0; catalog default
remains42. Record with an unfinished row performs no write. Native reload cancel
and Keep editing preserve path, supplier, ten lines, Qty8 and the note. Test-created
drafts are deleted. Artifacts: chat workspace `artifacts/purchase-safety-2026-10-21/`.
The existing shell business-name truncation is outside the editor's approved scope.

Only16 exceeded route/first-load scalar ceilings changed, at measured+at most0.3KB.
Final editors166.7KB route /407.6new–407.7edit first load; ceilings166.9/
407.8–407.9. Shared113.7/framework127.3 unchanged. The bytes buy acknowledgement,
finish/preflight, omitted-row and leave safety; no dependency or copied engine.
Quiet navigation24/24 cases reps3 passes: phone content median145ms native/523ms
throttled; desktop453/845ms. No improvement or unchanged-speed claim from this
run alone; final old/new/old/new remains required after the remaining pieces.

Review corrections for the next pieces: an unconditional promise that the raw
cost becomes the catalog price is false for discounts/nonclaimable tax and
repeated items (the backend's final applicable line wins). Preserve those engines
and use truthful words. The old handoff's claimed supplier one-line summary is
actually a separate picker plus More details card: build the joined summary in
step6. Cost wording/precision, definitive payment403 recovery, lost Record-reply
recovery and whole-editor acceptance remain pending. No whole-editor score yet.

## Step 4 — truthful cost words and real unit-rate precision (21 October)

The raw entered cost is not always the next item default: the backend uses
net inbound cost after discounts and nonclaimable tax; the last applicable
repeated-item line wins. The cost note now describes that effect in words,
without a second pricing engine or a misleading guaranteed raw rupee amount.
Orders say expected cost; Send does not change stock or item defaults.
A zero previous cost is a meaningful comparison; exact decimal comparison
replaces the old floating-point percent hint. Loaded draft baselines also work.
This corrects §7's oversimplified price promise, preserving the real engine.

A new test exposed a real entry defect: two-place display precision also capped
what could be typed, so 40.1234 became40.12 before ratePlaces could expand it.
UbMoneyInput now accepts optional entry precision (only purchase unit cost opts
into4); ordinary money stays at its caller's precision. Select-all remains safe
when removing grouping/changing focused precision. The shared counter summary
uses optional unit-price precision so a collapsed row does not hide those digits.
Totals remain two-place money; actual saved string40.1204 is read from the API.
The desktop cost track fits ₹12,40,378.1234 without shrinking the font.

Fail-before unit and real-browser evidence retained in cost-* data. The first
full test run was RED: one new assertion assumed Qty20.000, but the form correctly
normalizes it to20. The assertion now checks the actual rate summary, without
weakening the wire-cost check. Final412 suites/4,613 tests pass in100.776s;
existing act/network/worker-teardown diagnostics remain recorded. Changed-file
lint, types, locale split/check, production build, bundle and174 contrast pass.
29 existing backend record/payment tests pass on the isolated test DB, including
ITC/nonclaimable cost, stock/ledger/audit and atomic payment403 refusal.

Live QA240 frames (160en/80hi),20 states at the required twelve viewport/theme/
locale profiles: zero overflow, text cuts, numeric-width, label contrast or
runtime failures. All six sheets inspected, plus native320 and1280 large precise
cost frames. Real typing40.1204 survives Save; null/explicit0/late-reply/native
leave checks still pass; catalog defaults stay unchanged on draft saves. Test
harness corrections expand the relevant card before interacting (opening one
card correctly closes the previous card). Drafts created by the sweep are removed.
Artifacts: chat workspace artifacts/purchase-cost-2026-10-21/.

Bundle gate initially refused seven exceeded scalars (0–0.1KB over rounded
ceilings). Only those seven use measured+0.3KB, documented in the budget file.
Editor166.9KB route/407.8–407.9 first load; shared113.7/framework127.3 unchanged.
No dependency, financial engine, payload, historical document or frozen app
workflow change. Shared input/formatting changes are presentation only.

The first broader nav run hit an unchanged legacy `nav a[href="/more"]`
selector under the current shell; stopped, preserved red log, no whole-nav pass
claim. Repeating the same two controls as prior/baseline runs completes24/24
cases reps3, otherwise idle. Content medians below are observations, not an
improvement claim; final fresh old/new/old/new remains outstanding.

- 390 unthrottled: median144ms, p95251ms.
- 390 throttled: median525ms, p95789ms.
- 1280 unthrottled: median446ms, p95566ms.
- 1280 throttled: median840ms, p951157ms.

Next: definitive payment-permission recovery, lost Record-reply recovery, joined supplier summary and whole-editor acceptance. No whole-editor rating yet.

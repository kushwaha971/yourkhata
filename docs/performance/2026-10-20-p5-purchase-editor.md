# Purchase editor completion — §7 steps 2–6

20 October 2026, dev. Continue R-DEC-27/29 from93c6d3fe. Scope: the remaining
approved purchase editor composition and business states, one verified commit
per piece. No new plan, no Home work or Library/Lending contract change.
The dated checkpoints below are historical. The final 21 October acceptance at the end supersedes their pending-editor status; it does not certify the entire Purchases module.

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

## Step 5 — explicit refusal and immutable Record recovery (21 October)

A definitive403 permission_denied naming details.payment now explains the
atomic refusal and changes the main action to **Record as Pay later**. Nothing
is automatically recorded or paid. Other403/context412/network failures never
offer this credit fallback. This is a presentation/retry choice over existing
endpoints, not a new permission, partial transaction or financial engine.

A separate real defect was reproduced: losing the Record reply left no recovery
action, and ordinary retry would PATCH the already recorded document before
replaying Record. The editor now retains the exact scoped id/version/key/payment
intent in memory, locks edits/Save/autosave/delete, and offers **Check recorded
bill**. GET first: an already posted outcome opens read-only without another
Record; a draft replays the original body/key, with no preceding PATCH. A failed
check preserves uncertainty and permits another check; a later permission refusal
cannot disprove an earlier lost payment and never enables credit fallback.
Close/native unload warn accurately; leaving still discards this in-memory
attempt (no purchase device copy was added). Both initial failed loads and
failed outcome reads are usable instead of an endless loading skeleton.

Pending payment amounts/methods/references/splits cannot be edited after their
old values were submitted; the sheet stays open during Record. Record request
IDs now fence late fulfilments/refusals after actor/business resets, just as
load/save IDs do. The save queue also tracks/aborts the in-flight Record and
checks the current actor/generation before applying its outcome. These guards
are tested, not an all-API privacy certificate.

Fail-before evidence: missing fallback/recovery; pending money fields still
editable; initial/check load stuck; two old-reducer actor-scope regressions.
Real Chromium caught another defect after rectangles all passed: at1024 a global
error toast covered the recovery explanation. A new actual text hit-test fails
in both uncertain/refused states on the pre-fix build. Instructions now occupy
the existing UbPageHeader controls, which the global toast already measures,
so both explanations remain uncovered. The overlay hit-test was extracted to
one shared e2e helper and reused; no duplicate overlay/financial implementation.

Final413 suites /4,624 tests pass (100.702s), with the existing worker teardown
warning retained. Changed-file lint, types, locale split/check, standard build,
bundle and174 contrast pass. Full cloud lint exceeds25min. All80 purchase
backend tests pass on the isolated test database (Django deprecation warning
retained), including stock/cost, payments, returns and permission contracts.
No backend schema, endpoint, body or financial calculation changed.

Live acceptance:60 final frames (40en/20hi) at390/320/1024/1280 light/dark,
Hindi320/1280. Paid now, busy Record, lost reply, uncertain leave and explicit
payment refusal, all twelve profiles. Fresh **Radhe Krishna Enterprises** owners,
LED drivers and electrical supplier, actual local API and production frontend.
For each profile the first Record reaches the server and only its reply is
aborted: one paid bill, one2-unit stock movement, purchase default40/selling55;
Check opens that existing bill with no second Record. Controlled payment403
keeps a draft; only an explicit Pay later makes it recorded/paid0/due94. Real
backend permission refusal is proved separately by the backend suite, not
misrepresented as a browser ACL-revocation exercise. Unposted test drafts are
removed; posted local QA audit records remain. No external sends/production data.

Final measurements: zero page overflow, text cuts, label contrast, runtime errors
or dialog/recovery-explanation occlusion. All six final contact sheets and native
1024 refusal/320Hindi leave frames inspected. The initial rectangle-only pass
missed toast occlusion and is not final acceptance. Artifacts: chat workspace
artifacts/purchase-finish-2026-10-21/; reproduce with revamp-purchase-finish.mjs.
Only15 exceeded purchase budget scalars use measured+0.3KB: editors167.6 route/
408.6 first load, shared113.7/framework127.3 unchanged. Bytes buy immutable
recovery/GET checking, explicit refusal, pending locks and failed-load retry.

The navigation harness now includes the actual New purchase action, alongside
previous controls. An initial harness insertion was in the request tracker;
that run was stopped and its invalid timing log retained, not benchmarked.
Corrected quiet run:36/36 cases, reps3, nine purchase/editor or control
observations per performance profile. Final old/new/old/new comparison still waits for step6;
no speed improvement claim from this checkpoint.

- Purchase editor 390/unthrottled: content median73ms, samples[83, 73, 73].
- Purchase editor 390/throttled: content median452ms, samples[1392, 450, 452].
- Purchase editor 1280/unthrottled: content median65ms, samples[409, 65, 65].
- Purchase editor 1280/throttled: content median566ms, samples[1364, 559, 566].

Next: true joined supplier context and complete editor acceptance/performance/rating. Purchase list/detail/returns remain later, followed by source modules and Home last. No whole-editor score yet.


## 21 October — joined supplier composition and final editor acceptance

**§7 editor implementation and local end-to-end acceptance are complete.**
This covers bill and purchase-order creation/editing, the supplier summary,
line entry, totals, Save draft, Record/Paid now, Send and their recovery states.
Purchase register/detail/return redesigns are the next pieces, not included in
this completion claim. The owner approved continuing them without a phase question.

### Composition and reusable behavior

Below1536, selecting a supplier produces one joined supplier/number/date/due
summary with Edit; long names wrap. Edit opens the original fields, including
invoice date, tax credit and reverse charge; duplicate/error states open them.
An empty editor keeps the supplier visible and secondary details folded. Desktop
retains the table when it fits and the side totals from1536. Search stays above
lines, list selection focuses Qty, scanner entry keeps search focus, a repeat
raises Qty without resetting a cost override, and the finder appears at ten
named lines. The finishing dock carries item/GST caption and one truthful save
state. Record is marigold, with no new financial engine.

No-match supplier creation reuses the lazy PartyQuickCreate, permission-gated,
Shop-scoped and defaulted to Supplier. It retains entered lines. A React portal
submit defect was reproduced: saving the child form also submitted the opening
document. UbForm now stops submit propagation; its failing-before regression
and the real browser supplier Save prove no Record/payment question occurs.
There is no second contact form or copied search/price/stock/tax engine.

Context-load failure now offers Retry instead of an endless skeleton; stale
context request responses are fenced. A sent/posted/voided/cancelled edit URL or
browser Back opens read-only detail. Orders reuse the scoped immutable intent
and GET-before-replay path: a lost Send reply checks the existing order, rather
than issuing another operation blindly. Recovery of an already-applied write
also reuses the existing invalidation map so warm stock/payment/report caches
refresh; a new warm-cache regression fails before that correction.

Quantity masks previously turned1.5 into15 for whole-number units and-5 into5.
They now preserve numeric intent and the existing central validator refuses it.
Purchase Record rejects invalid quantities; a negative return row cannot be
silently omitted while another positive row is issued. The shared input has no
Library/Lending consumers; their endpoint/model/workflow contracts are unchanged.
The return correction is safety coverage, not acceptance of the whole return UI.
A remaining UX limit: reopened custom counted-unit metadata is inferred for
NOS/PCS; other invalid custom-unit fractions still receive an authoritative
server refusal. Inventory metadata review remains in the planned inventory phase.

### Regressions and production gates

Failing-before cases retained in data/2026-10-20-purchase-editor/complete-*:
joined summary, blank-editor density, inline supplier permission/creation,
portal submit, order Send uncertainty, order-specific finder words, numeric
intent, invalid return row, posted edit URL and warm cache recovery. Existing
step3–5 regressions retain partial-row refusal, stale save acknowledgement,
source defaults/zero/precise costs, double taps, immutable retry and actor fences.

Final frozen app: **414 suites /4,639 frontend tests pass in105.369s**.
Changed-file ESLint --fix/max-warnings0, types, locale split/check, standard
production build, final bundle gate and174 contrast pairs pass. Full cloud lint
exceeds25minutes, so changed-file lint is used. Jest ran before the build, not
concurrently. Existing act/network-probe/worker-teardown warnings remain in the
raw log; passing does not mean warning-free. The gate helper stopped at the
initial exceeded bundle ceiling; after documented measured budgets, the final
manual bundle and contrast checks pass. The initial red log is retained.

All **80 purchase backend tests pass** against an isolated local test database;
Django converter deprecation warnings remain. No backend application code or
schema changed, and this is not an all-API security certificate or a rerun of
the entire backend suite. Build env: NEXT_PUBLIC_API_BASE_URL=/api/v1,
API_PROXY_TARGET=http://127.0.0.1:8000, SW/analytics false; standalone restarted
after build. QA database revamp_20261018, console OTP only. No Railway or
production data, external messages or actual money movement.

### Browser acceptance:498 final frames

| Family | Frames | What is proved |
|---|---:|---|
| Core editor |240|20 states ×12 profiles: editing, list/scanner, repeat, finder, Save, offline, native unload cancel, explicit zero/source default and four-place/large cost |
| Supplier/context/order contracts |144|12 states ×12 profiles: real inline creation, retry, summary/Edit, invalid quantity, lost Send reply, read-only Back/edit link, return input guard |
| Finishing |96|8 states ×12 profiles: cash/part UPI/advance/large payment, pending, lost Record reply, uncertain leave, explicit payment403 choice |
| Wide desktop |14|1536 light/dark, seven states, full metadata and side totals |
| Real money graph |4|390/1280 part PhonePe, advance cash; readbacks described below |

Twelve profiles means390/320/1024/1280 light/dark, plus Hindi320/1280 light/dark.
Computed foreground/background contrast, text against its own box, page width,
input-value widths and overlay hit tests are measured, not inferred from markup.
Final results: zero page overflow, cut labels, active-label contrast failures,
uncaught page errors or measured dialog/recovery-text occlusion. All20 contact
sheets were inspected, plus native supplier/large-money/Hindi recovery frames.
The omitted shell business-name/email ellipsis is a known separately scoped
shell issue; editor measurements are not a claim of whole-shell conformance.

Fresh Radhe Krishna Enterprises QA owners and electrical products were used
for actual writes. The scale book remains the load/performance fixture; its
existing supplier names are not relabelled. Browser facts:

- Lost Record response: the real server records one paid bill and2 stock units;
  GET recovery opens it without a second Record. Original default40/selling55
  remains distinct from bill pricing. The controlled browser payment403 keeps
  a draft; explicit Pay later then records paid0/due94. The actual ACL refusal
  is separately covered by backend tests, not claimed as browser role revocation.
- Real PhonePe part payment20 leaves133 due; a second supplier supplies the same
  two products on credit150. A200 cash payment on153 creates47 advance. Free
  goods total0 records without the payment drawer/body. Two actual PAYOUT
  vouchers per money-graph profile; stock reaches4 for each product. Later
  supplier costs39/88 do not reprice the earlier40/90 bill; selling defaults55/125
  remain unchanged. Final purchase default0 comes only from the explicit free
  goods record, not draft editing. Server engines remain authoritative.
- Send recovery changes no stock, catalog defaults or Shop debt; one actual
  Send despite its lost reply. Same phone in another shop's owner/contact does
  not merge identities: the other owner gets404 for this purchase/item/contact.
  Warm-cache invalidation is a focused integration regression; it does not
  pretend to be a new all-module access audit.
- Return invalid/valid inputs were exercised against recorded local fixtures;
  no return was issued in that input-only check. Actual return business rules
  remain in the80 backend tests and the forthcoming return acceptance piece.

Final harnesses: revamp-purchase-quick-add.mjs, revamp-purchase-finish.mjs,
revamp-purchase-contracts.mjs, revamp-purchase-money.mjs. Artifacts are in this
chat's artifacts/purchase-{editor-final,finishing-final,contracts-final,
editor-wide,money}-2026-10-21 directories. Raw result JSON is committed beside
this report. Meaningful harness reds are preserved: deterministic timestamp
GSTIN collision409 (now random valid PAN entropy) and return-button readiness
race (now wait for the attached action before choosing the phone menu).
Neither is hidden as a product test pass.

### Bundle cost

Final purchase editors:168.4KB route /409.8KB first load. Shared app114.2KB
(previous checkpoint113.7); framework127.3KB unchanged.98 exceeded route/first-
load scalars and the shared-app ceiling were adjusted with a reason in
bundle-budgets.json. Each changed route ceiling is measured+0.3KB; shared114.4.
These bytes buy reused lazy supplier creation, context/order/read-only/cache
recovery and common form/quantity safety. Default/framework limits were not
raised. No package was added.

### Final performance and evidence-based rating

Same Mac/API/database, otherwise quiet:93c6d3fe detached worktree (built with
real hardlinked node_modules), then final app, then old, then final again.
Current perf-app.mjs --reps=3 --only=nav, three identical cases (purchase register
→new editor, Home→Customers, Home→Suppliers),390/1280 and both profiles.
**144/144 navigation samples, no errors/timeouts.** Each table cell below pools
six samples; p95 uses nearest rank (the maximum for six), not a reassuring
interpolated tail. Throttled is CPU×4,150ms RTT,1.6Mbps down. Values are ms.

|Purchase editor route|Old content median /p95|Final content median /p95|Final first-change max|
|---|---:|---:|---:|
|390 unthrottled|69 /81|75 /371|3|
|390 throttled|431.5 /1325|443.5 /1390|8|
|1280 unthrottled|68.5 /433|64 /426|53|
|1280 throttled|559.5 /1309|557 /1356|72|

Warm phone median431.5→443.5ms (+12); final repeat-run medians425/451 differ26ms.
Warm desktop559.5→557ms; final repeat medians552/559 differ7ms. Controls:
phone Customers529→532.5/Suppliers522.5→524; desktop822.5→841.5/842→840.
First throttled editor sample each run is slower: phone1305/1325→1372/1390,
median+66ms (+5.0%); desktop1290/1309→1348/1356,+52.5ms (+4.0%). One unthrottled
phone final first sample is371ms versus old75/81; it is retained, not discarded.
This is a modest measured first-load cost, not a speed improvement or proof of
bit-for-bit unchanged navigation. Pending feedback still appears promptly.
F4's97→91ms first-change median (excluding Lending) and17Oct363ms baseline
measure other case sets/environments; they are historical context, not a causal
comparison for today's purchase editor. No F4 whole-app speed claim is made.

Actual30-line purchase entry, selected supplier, Enter→render+Qty focus:
phone390 CPU×4 median36/p9541ms, last-five36; desktop1280 median38/p9550,
last-five50. Event Timing maxima while picking/search typing/Qty typing:
phone32/56/40ms, desktop40/48/48ms. Zero unexpected scanner lookups during list
picks; scanner behavior itself is checked separately by the core acceptance
harness. The step1 medians36/38ms remain the same; this is not a new acceleration.
Final frontend restored after the serial comparison. Raw pooled samples and
per-event data are committed in complete-ab-* and complete-editor-speed.json.

### Whole-editor score (provisional self-assessment, not merchant research)

|Point of view|Score /10|Evidence|Still weak|Confidence|
|---|---:|---|---|---|
|Function · phone|8.9|Real Save/Record/Send, part/advance/free/credit readbacks, recovery and80 backend tests|No device copy or crash guarantee; custom-unit metadata UX|High for local flows|
|Function · desktop|8.9|Same source engines, warm-cache/posted-edit guards, permission and identity regressions|Not an all-API permission audit|High for tested paths|
|Busy shop · phone|8.7|Top search, repeat Qty, finder, inline supplier, common finishing flow|Real scanner/IME and merchant task study unproved|Medium|
|Busy shop · desktop|8.9|Keyboard entry, scanner focus,30-line picks, lazy shared create|Hardware scanner/printer unproved|Medium-high|
|UI/UX · phone|8.7|320/390 compact composition, Hindi, full words, dock, measured sheets/large money|OS text scaling/TalkBack and shell truncation outside scope|Medium-high|
|UI/UX · desktop|8.8|1024 cards/1280 table/1536 side totals, both themes and recovery states|No independent usability study|Medium-high|
|Performance · phone|8.6|36ms picks,≤56ms measured input events, prompt route feedback|First throttled load~1.39s;~5% more than baseline|Medium, emulated|
|Performance · desktop|8.8|38ms picks;557ms throttled warm navigation|First load~1.36s; small added common bytes|Medium-high, local|

09's separate design weights (20/15/15/15/10/10/10/5): mobile8.7, ease8.8,
visual8.8, feedback8.9, accessibility8.6, desktop8.8, safety9.0, reuse9.0 =
**8.805, reported conservatively as8.80/10**. This design rubric does not
replace the eight aspect scores above; lowest verified aspect is8.6. Scores
apply only to the completed editor, not purchase register/detail/returns or
whole-Shop readiness. Hardware/accessibility research could change them.


Physical phones, installed PWA, scanner/printer hardware, native phone contacts,
OS keyboard/text scaling and TalkBack are not proved by desktop Chromium.
Purchases intentionally have no device copy: native leave cancellation protects
an open tab, not a browser crash or forced reload. In-place re-auth remains a
shell dependency. No independent merchant research or whole-Shop certification
is claimed. These limits remain visible in the rating.

Next: purchase register §5, detail §6 and complete returns/debit-note redesign,
then remaining sales documents; inventory/money/expenses/reports afterward.
Approved remaining Home workflows stay last (R-DEC-27).

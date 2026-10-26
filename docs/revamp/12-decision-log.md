# 12 · Decisions and progress log

Newest first. Each decision says who made it and when. "Open" means it waits for the owner.

## Decisions

| ID | Decision | Status | By, date |
|---|---|---|---|
| R-DEC-20 | Owner: "take latest pull from dev and check claude is done something if that correct then proceed with next". Resume after the delivered R-DEC-19 handoff: fast-forward dev, independently review and verify Claude’s changes, correct demonstrated access defects under R-DEC-18, then continue approved Shop Home/remaining Shop screens under R-DEC-16. | decided | owner, 19 Oct 2026 (Asia/Calcutta) |
| R-DEC-19 | Owner: "once all these done before switching to home commit code and push and give me latest promt so i gave to another agent to continuing in same manner". Deliver the access-fix checkpoint, update the portable handoff, commit/push dev and stop before Home. This does not authorize claiming the remaining access audit complete. | decided | owner, 19 Oct 2026 (Asia/Kolkata) |
| R-DEC-18 | Owner: "then update that" (Shop search default), "same things goes for notification (should be based on module and users)", "not only that but all these date and functionallity will go in same way", "after all these fixes proceed with your next". Fix and verify access-context defects before resuming Shop Home; include shared-phone, tenant/user/module/role and stale-switch cases. This authorizes access hardening and verification, not new financial posting rules or unrestricted changes to live Library/Lending workflows. | decided, verification in progress | owner, 19 Oct 2026 |
| R-DEC-17 | Owner: "from next time I want all the example releted to Electronic and Electrice items and Firm name Radhe Krishna Enterprises". Use electronics/electrical examples and that firm name in new explanations/demo scenarios; this is not authorization to rename real tenants or existing customer records. | decided | owner, 19 Oct 2026 |
| R-DEC-16 | Owner: "proceed with supplier and all other shop module then proccedd with anohter module". Finish Suppliers, then remaining Shop screen families before another app. Continue Counter Mode, reuse shared components, verify each piece on desktop/phone and deliver its evidence. Library/Lending financial contracts remain frozen; unapproved backend business-rule proposals are not implicitly enabled by presentation scope. | decided | owner, 19 Oct 2026 |
| R-DEC-15 | Approve BP-11 shared-engine book authorization fix. Owner: "fix that backend gap as well". Enforce server-side app-specific rights, scope financial reads/writes/exports and preserve shared contact identity. Reproduce restricted-grant cases first; preserve Library/Lending vertical contracts. | decided | owner, 18 Oct 2026 |
| R-DEC-14 | Correct the Shop person-page and payment-drawer composition against the live Claude Counter Mode artifact; apply its principles to pages it does not explicitly depict. Remove the unnecessary permanent details rail, reduce summary height, reuse existing components/logic, and verify the result before rating. Owner: "then fix them why you are questoning me" and "fix them from all persoptice without stopping". The earlier 8.97 score is withdrawn; functional tests did not justify that visual score. | decided | owner, 18 Oct 2026, recorded during correction |
| R-DEC-13 | Keep the person page scoped to the section it was opened from. Customers shows customer dues/actions only; Suppliers supplier dues/actions only; Udhaar independent. Do not show both role figures or both receive/pay actions simply because the shared contact has both flags. Supersedes the dual-figure presentation in 07-screens/08 §3.1 (the separate-money invariant still stands). Owner: "why ui like as supplier or recive if both section are seperate that customer and supplier and udharbook" and "don't only thing from code wise think also proper things like feature wise as well and why that feature was give is it really required or not". Reuse existing components and review each feature's user purpose. | decided | owner, 18 Oct 2026, recorded 12:03 UTC (17:33 IST) |
| R-DEC-12 | Approve BP-09 Shop prerequisites: separate customer/supplier figures, bill-based lateness and last Shop activity, editable Shop reminders. Owner’s exact answer: "Approve BP-09 and complete the matching features". Library/Lending remain frozen. | decided | owner, 18 Oct 2026, recorded 08:13 UTC (13:43 IST) |
| R-DEC-11 | The Claude Counter Mode artifact is the composition/interaction reference across the whole revamp, not only Customers. Reuse existing components and business flows underneath; do not preserve old layouts and call colour/spacing changes a redesign. Owner’s words: "and this is not only about customer section"; then "yes proceed". Backend prerequisites are BP-09; they remain awaiting a separate approval under 08. | decided | owner, 18 Oct 2026, recorded during implementation |
| R-DEC-10 | Build Shop and Udhaar screens (Phase 5), one piece at a time, starting with Shop Customers list and person page. Owner’s words: "Shop and Udhaar screens (Recommended): start with Shop Customers list and person page." Remaining shell work and backend proposals remain unapproved. | decided | owner, received before implementation; recorded 18 Oct 2026 06:33 UTC (12:03 IST) |
| R-DEC-01 | Revamp is planning and design only until the owner approves a phase. No app code changes. | decided | owner, 17 Oct 2026 |
| R-DEC-02 | Keep the Counter Mode direction: teal and marigold, white page background, dark teal sidebar. Changes `tokens/light.css` canvas when built. | decided | owner, 17 Oct 2026 |
| R-DEC-03 | Shop Home: four-figure line (current spec) vs the earlier big sentence; proposal is both — sentence as a one-line phone header above the grid. | **open** | — |
| R-DEC-04 | Shop phone tab order: Home · Bills · Customers · Suppliers (design page) vs Home · Customers · Suppliers · Bills (manifest today). | **open** | — |
| R-DEC-05 | PWA shortcuts become generic per app and are guarded; `start_url` goes through the landing resolver. | proposed | — |
| N-1 | Phone module switching: the 5th bottom-bar slot becomes the App button with one App sheet (apps, more, you). Alternative B (3 tabs + App + More) rejected. | decided | owner, 17 Oct 2026 |
| N-2 | Notifications: popover on desktop, page on phones; same backend. | proposed | — |
| BP-01…07 | Backend proposals in 08. None approved. | **open** | — |
| R-DEC-06 | Keep the existing YourKhata logo and mark (`UbLogo`, `frontend/public/brand/yourkhata-*.svg`, rules in DESIGN-SYSTEM.md §7). On the dark sidebar it sits on a white rounded tile so it stays visible; the mark is never recoloured. | decided | owner, 17 Oct 2026 |
| L-01 | Library and Lending: UI only; contracts in 02 are fixed. | decided | owner, 17 Oct 2026 |
| R-DEC-08 | Build approved for the shared speed and tap fixes (roadmap Phase 4: route loading views, pressed and pending states, double-tap lock, phone App button and desktop sidebar app list), with screenshots and before/after numbers after each piece. Library and Lending screens are not changed in this phase beyond the shared shell. The owner then asked this session not to build and to hand the work to a new session with the start prompt. | decided | owner, decision card, 17 Oct 2026 17:27 UTC; hand-over 17:28 UTC |
| R-DEC-09 | Desktop sidebar: do NOT list the apps (Library, Lending, Shop, Udhaar book) in the rail. Show only the open app's own sections, with ONE button at the top (the open app's name and icon, "Switch app") that opens a page listing every app the person can open. Supersedes the "Apps group" of 04 §3 and 07-screens/02 "Desktop sidebar" built in F4 (11a2b10). Owner's words: "why on sidebar be default we are shown tinat Library/Lending instead of that in that button there is something like module/feature what when clikc on that open next page and where see all the list". The phone App button and App sheet are unchanged. Built the same day (see Progress). | decided, built | owner, 18 Oct 2026 05:42 UTC |
| R-DEC-07 | Every UI piece built (form, card, drawer, sheet, dialog, list, any screen) is delivered with screenshots of it on a phone and on desktop, in each of its states, before the next piece starts. See 11 "Screenshots after each piece". | decided | owner, 17 Oct 2026 |

## R-DEC-21 · Home must follow the artifact, including Find or start

Owner, 19 Oct 2026; clarification recorded 17:22 UTC. Owner's words: “that dashboard design is something else and I’m looking for that”, “and also that global search in that search Find or start:a name, item, bill number or amount”, “even that Home ui want same”; then “ok proceed”. Implement the artifact hierarchy for Shop Home using existing components and authorized sources. The previous identity-only search / phone disclosure composition is superseded. This is not approval to invent hourly/repeat figures or settle Customer/Supplier balances. No Library/Lending contract changes.

## R-DEC-22 · Header search and complete artifact Home

Owner, 19 Oct 2026, approximately 17:36–17:38 UTC: “move that search to above on
global search replace to that and make it global search”, “on header”, “in
artcrafe there is graph and I want that same ui”, “each and everything as per
artcraft”, and “also check that mobile view also that present in artcraft”.
Supersedes Home-body search and omission of the hourly graph. Implement the
shared Shop header command, actual hourly/chart-table and reference compositions,
and their necessary read-only BP-15 data. This interprets the explicit feature
request as authorization for its read prerequisite, not a quoted approval of
financial settlement or a change to live Library/Lending contracts.

## R-DEC-23 · Daily graph instead of hourly

Owner, 19 Oct 2026: “instead of horuly use daliy”. Use the existing seven-day
net-billed daily series in the artifact-style compact graph/table. Supersedes
the hourly requirement in R-DEC-22 and removes its proposed hourly backend read.
BP-15 now supplies only missing role-lane/Repeat details; existing daily report
arithmetic and endpoints remain reused.

## R-DEC-24 · Responsive fidelity and period controls

Owner, 20 Oct 2026: approve period/group filters rather than hourly; require
Repeat pills matching the artifact, compact same-row graph dropdowns, joined
mobile 2×2 figure card and filled mobile tabs. The owner also says “same
responsibile in everywhere in futruer”. This is a continuing quality standard,
recorded in CLAUDE.md. Use the reference for whole compositions and real flows,
not just isolated components; expose gaps rather than overstate completion.

## R-DEC-32 · These requirements are strict, not discretionary

Owner,21Oct2026: “all these thigns are hard stricts to follow”. The reference,
documented component values, mobile-first behavior, all-module viewport rollout,
reuse/business boundaries and review/build/LOOK/measure/report loop are mandatory.
Root CLAUDE.md contains the acceptance gates; AGENTS.md and both handoffs point
to them. Before coding, record the spec-to-check mapping in the existing piece
report. No invented reference parity, completion or rating. The owner must not
have to catch deviations that the approved docs already specify. This does not
introduce routine permission questions; continue authorized work within scope.

R-DEC-32 extension,21Oct2026: owner explicitly adds functional correctness,
why each feature is useful/necessary for end users, comparison with competitors,
and checking that necessary requirements are fulfilled. These are hard gates
alongside design. Each report must trace required needs/contracts to evidence
and state missing/deferred/unproven work. Competitive claims require dated,
verified task-level evidence and honest better/equal/worse trade-offs. No rating
can excuse broken money/stock, access isolation, lost work or essential flows.
This records the requirement; it does not claim competitor research or all
module requirements are already complete. See CLAUDE.md gates9–12.

## R-DEC-31 · All-module viewport behavior; reference-size chip faces

Owner,21Oct2026: wants table/list viewport sizing and persistent pagination in
all modules, not only Purchases. Current purchase implementation is not a claim
that all other lists have been migrated. Roll out the same shared behavior to
Shop, personal Udhaar, Library and Lending registers, including already-delivered
lists; verify each actual page, not a blind global switch. Library/Lending
financial endpoints, models and workflows remain frozen. This authorizes the
list-layout behavior, not unrelated new workflows or whole-module completion.

Owner also questioned the enlarged chip faces. The purchase implementation
mistakenly forced44px visible height; committed reference/DS requires32px faces
and44px mobile touch targets. Restore the32px face and reserve6px vertical room
for the existing transparent hit area. Measure both actual face and hit testing.
The live Claude artifact was inaccessible; local committed reference was checked.

## R-DEC-30 · Mobile-first viewport registers, complete redesign

Owner,21Oct2026 (recorded11:04 UTC /16:34 IST), reaffirmed a proper redesign
like Customers, Suppliers and Bills, not minor styling. Tables and mobile lists
must fit the available viewport; rows scroll internally while pagination and
key actions remain accessible. Around80% of users use mobile: prioritize
readability, touch, navigation/accessibility, speed and busy-counter use.
Apply this as an acceptance rule for each remaining register; reuse one opt-in
page/grid pattern and measure real heights rather than copy fixed offsets.
Previously delivered registers have not all been migrated by this purchase
piece; adopt/verify the pattern through their approved module work. Forms and
detail screens retain task-appropriate layouts. No financial contract change.

## R-DEC-29 · Revamp every module; do not patch the old design

Owner, 20 Oct 2026: "do not rework on existing design for any module; follow
the proper revamp instead of making changes in the existing." Every module is
built to its approved revamp composition (07-screens; design/counter-mode.html
for editors) as the acceptance reference, not by adjusting the old screens
piecemeal. Spec/code disagreements are recorded here and the spec is followed
unless it breaks a "Must keep working" contract in 02. Same day, the owner
chose "Move on" from billing with phone performance at 8 (a pick ~190 ms at 4x
CPU on any bill length; three trims within noise); purchases are next under
R-DEC-27. The standard every module is scored against (design, busy shop,
performance, and how each is measured) is in START-NEXT-SESSION-PROMPT.txt.

## R-DEC-28 · Plain labels throughout the application

Owner,20 Oct2026, recorded07:21 UTC (12:51 IST): “Quick Sale and Saved customer”,
then “everru where in entienr project”. Apply those billing labels and use
Customer/Supplier by role, Contact for neutral/shared identities, across rendered
English/Hindi copy, reports, imports, activity and server presentation messages.
Preserve machine identifiers, API/import contracts, user records and all existing
financial/vertical workflows. This is presentation wording, not a mode/model
rename or a migration of people between books. R-DEC-27 delivery order continues.

## R-DEC-27 · Finish Shop source workflows before remaining Home features

Owner,20 Oct2026, recorded06:17 UTC (11:47 IST): “do home penidnfg work
 after completion of Billing/POS, purchases and returns Inventory, payments,
 expenses and reports” because “FROM THERE ASLO DETAIL REQUIRED”. This changes
sequence, not approval or scope. Complete and verify billing/POS, purchases and
returns, then inventory, payments, expenses and reports, then return to remaining
Home promises/follow-ups, physical cash counts and explicit settlement. Reuse
those verified source workflows and shared components in Home. R-DEC-26 remains
approved; do not ask again. Immediate next piece: invoice/POS editor.

## R-DEC-26 · Remaining Home workflows approved

Owner's decision-card answer: **“Approve all three workflows”**, followed by
“proceed”. Recorded 20 Oct 2026 at 06:03 UTC (11:33 IST). This approves the
concrete BP-08/16/17 scopes: Shop-only role-scoped promises/follow-ups, physical
cash-count observations without automatic balance adjustments, and explicit,
audited customer–supplier settlement that never nets automatically. Preserve
separate books, roles, permissions, existing financial posting rules and frozen
Library/Lending contracts. Finish the BP-15 read checkpoint, then implement and
verify each approved workflow separately; no repeat approval question is needed.

## R-DEC-25 · Continue approved Shop work without another phase question

Owner, 20 Oct 2026: “after completion of Home you will direcly procced with next
without waiting for my permission”. After Home acceptance, commit/push and report
its evidence, then proceed directly to Bills/POS/customer invoices and the
remaining approved Shop sequence. Do not stop for routine design/implementation
confirmation or repeat the phase choice. Genuine new business-rule decisions,
destructive actions and frozen Library/Lending contracts retain their boundaries.

## Progress

21Oct2026 — Purchase register §5 redesigned to R-DEC-30: viewport-sized phone list/desktop table, internally scrolling rows and visible pagination, compact server totals, status chips, full supplier/paper identity and header actions. Shared opt-in viewport/grid and existing search/stats/clearance reused. Due-window identity, late failure, empty-month Clear, row-page offset and toast covering Next reproduced/fixed.416 suites/4,647 tests,80 purchase backend checks,240 final frames; exact performance/rating in `2026-10-21-p5-purchase-register.md`. BP-18 records missing draft timestamps as unapproved, not invented. Next purchase detail §6/order conversion/full returns; Home last.

21 Oct2026 — Purchase §7 full editor acceptance: joined supplier/metadata summary and permission-gated reused inline supplier create; failed context retry; order Send lost-reply recovery; posted edit/Back read-only guard; recovered-write cache invalidation. Portal submit propagation and quantity sign/point corruption reproduced/fixed with regressions; negative return rows cannot be silently omitted.414 suites/4,639 frontend tests,80 purchase backend tests,498 final measured en/hi frames. Final performance/rating in `docs/performance/2026-10-20-p5-purchase-editor.md`. No backend engine/contract change. Current Next: purchase register §5, detail §6, full returns/debit-note redesign, remaining sales documents; Home last.

Source-review corrections21Oct (not new owner decisions): the old supplier picker plus separate More details was not the §7 joined summary; the earlier16Oct-built wording is superseded by21Oct acceptance. §17.6's keyboard-only whole-quantity masking changed1.5→15/-5→5, so numeric intent is now preserved and refused by the existing central validator. The cost-note correction remains: tax/discount/last duplicate-line rules belong to the server, not a promise that raw typed cost always becomes the default. In-place re-auth/device copy remains outside §7 delivery; no silent scope expansion.

21 Oct2026 — Purchase §7 step5 delivered: definitive payment403 explicit Pay later; scoped immutable lost-Record recovery with GET-before-replay; pending money locks; initial/check-load retry and late-actor request fence. Browser hit-test caught/corrected a toast covering instructions. 4,624 tests/80 backend tests/60 final measured frames; production gates pass. Navigation36/36 includes actual New purchase. Report: purchase-editor. Next joined supplier summary and whole-editor acceptance/rescore; Home remains last.

21 Oct2026 — Purchase §7 step4 delivered: truthful record/order cost notes, exact zero-aware comparisons, opt-in four-place cost entry and rate summaries. 4,613 frontend tests/29 backend checks/240 measured frames; all production gates pass. Seven measured budget scalars adjusted; no engine/payload change. Broad nav legacy More selector red log retained; scoped controls24/24 pass. Next payment-refusal/lost Record-reply recovery, joined supplier summary and whole-editor acceptance. See purchase-editor report.

21 Oct2026 — Purchase §7 step3 delivered: current-input server acknowledgement, partial-row Record guard, offline/leave/native reload protection, source-default Paid-now preflight and locked numeric fields. Shared window hook moved, native money-input clear and toast occlusion regressions fixed. 4,611 tests/216 measured frames; production gates pass. Report: `docs/performance/2026-10-20-p5-purchase-editor.md`. Review correction: raw cost is not always catalog cost after tax/discounts; the separate supplier picker/More details is not the promised joined summary. Next steps4–6 and whole-editor acceptance; no whole-editor score yet.

20 Oct 2026 — Purchase §7 step 2 delivered: item/GST caption and one save-state live region beside Record via existing UbTotalDock caption/meta. 4,597 tests,120 measured frames, no cuts/overflow/contrast failures; all production gates pass without a budget raise. Report: `docs/performance/2026-10-20-p5-purchase-editor.md`. Next honest save/leave state, cost wording, payment-refusal recovery, supplier summary and complete editor acceptance.

20 Oct 2026 — Purchase §7 step 1 delivered: shared quick-add, dynamic labeled finder and compact cost rows reused by sales/purchases; repeat Qty preserves cost overrides, scanner/list focus, edited draft readback. 412 suites/4,596 tests, 108 measured en/hi frames, no cuts/overflow/contrast failures. Supplier-inclusive 30-line pick median36 ms phone CPU×4 /38 ms desktop; old/new/old/new navigation throttled526/840 ms unchanged. Component rubric8.75, not whole-purchase completion. Report: `docs/performance/2026-10-20-p5-purchase-quick-add.md`. Next dock caption/meta, then honest save/leave, cost words, refusal recovery, supplier summary.

20 Oct review correction (R-DEC-27/29): the old Next still instructed another
billing pick-speed trim although the owner chose “Move on” and deferred the
subscription redesign. The current handoff supersedes that instruction.
Purchase §7 also explicitly requires compact cost rows as §3; step 1 therefore
shares CounterLineSummary as well as quick-add/finder, instead of copying sales
markup. This does not change cost, tax or posting ownership.

20 Oct 2026 — Owner chose "Move on": billing phone performance stays 8 (a pick costs ~190 ms at 4x CPU on any bill length; three targeted fixes measured within noise); the editor state redesign is deferred, and the remaining sales documents, purchases and returns are next (R-DEC-27).

20 Oct 2026 — Billing rescore in the artifact's table: function/busy shop/UI 8.5–9 on phone and desktop; performance desktop 9, phone 8. Same-container old/new navigation: median 684 vs 688 ms (noise 8.5 ms), unchanged. New e2e/perf-billing.mjs: pick on a 30-line bill ~200 ms at 4x CPU, ~100 ms laptop; typing 48–72 ms. Report: 2026-10-20-p5-counter-billing.md.

20 Oct 2026 — Billing: "Find a line on this bill" from ten named lines puts the caret in the chosen line's Qty (lazy `InvoiceLineFinder`). Live look found every combobox cutting long options with "…"; they wrap now. 4,589 tests; 108 frames. Navigation timing slower everywhere against 18 Oct, frozen apps included, so not attributable; same-container A/B owed before the rescore. Report: 2026-10-20-p5-counter-billing.md (third section).

20 Oct 2026 — Billing hold and resume ("On hold · N" row of time-stamped chips above the editor, Hold saves then opens a blank bill) and "Add <name> as a new customer" from the Saved customer search (write permission only, lazy contact form). List rows carry `updated_at`. Live look fixed held chips wrapping to three phone rows and identical-looking held bills; harness now cleans the drafts it POSTs. 4,585 tests; 84 frames. Report: 2026-10-20-p5-counter-billing.md (second section).

20 Oct 2026 — Billing toward the Counter Mode standard (owner: >8.5 in every aspect, phone and desktop; the Counter Mode artifact is the acceptance reference): same item again raises Qty; a scan keeps the caret in the search; one-tap "Paid cash" on a Quick Sale ("UPI or other" opens the sheet; Save moves to the header, a deliberate difference from the artifact's dock, told to the owner); dock caption "1 item · includes GST ₹x" and save state; picker stock in words and GST included/extra (gst_percent now sent to every member, cost still gated); restore archived look-alike or Create from a no-match search; "For this bill only" on a changed rate. Found and fixed a list hidden by a stale blur timer and the item catalogue leaking into editor routes. 4,580 tests, 80 frames, real one-tap cash issue. Report: docs/performance/2026-10-20-p5-counter-billing.md.

20 Oct 2026 — Shop Customers list: PostgreSQL JIT compiled every Shop-facts query for ~0.6 s before running it in ~0.04 s. `jit=off` on the app's connections; API 1.6–1.9 s → 0.44–0.52 s, Customers tab 1.65 s → 0.45–0.61 s. Backend 4,673 passed / 16 skipped / 2 timing failures (one already red). `docs/performance/2026-10-20-shop-customers-jit.md`.

20 Oct 2026 — Bill editor composition (07-screens/09 §3): always-open item search, compact Shop customer line, offline/slow Issue states, Issue named with its total; live run found and fixed a squeezed customer name at 320 px, a red Restore and Escape discarding a kept bill. 4,564 frontend tests, 80 frames, real Quick Sale issue and draft restore on local QA. Found the Shop customer list API at 1.5–1.9 s. `docs/performance/2026-10-20-p5-editor-compose.md`.


19 Oct 2026 — BP-11/R-DEC-15: implementing shared-engine app/book authorization using existing grant roles; financial contact projections, ledger reads/exports, payment IDs/targets, reminders and module-owned deposits. New explicit-grant marker prevents clearing the last app from restoring legacy access. Verification and migration/rollout limits: docs/performance/2026-10-19-bp11-book-authorization.md. Verified: 22 security regressions, 149 compatibility/query-budget checks and 7 live HTTP checks. Full backend: 4,621 passed, 16 skipped, one Library wall-clock failure that passed alone afterward; do not relabel the original full run green. Migration applied only locally. Deliver/push before further UI work.

18 Oct 2026 — Owner rejected the person-page composition and reused old payment drawer (R-DEC-14). Corrected the page and Shop form: compact summary, folded secondary details, amount-first 440 px drawer, UI-kit method select, viewport-aware footer, failed-read retry/save guard, discard confirmation and shared snackbar/footer clearance. Original 8.97 score withdrawn. Final 397/4,484 frontend tests and 210 measured browser captures pass; see the person report. Access-control regression check: 122 passed, scoped to the checked permission/tenancy/app-grant/payment paths. Final correction evidence follows in the existing person report.

18 Oct 2026 — Person page (R-DEC-10/13): role-scoped Customer/Supplier overview and actions, real source bills/receipts, lazy existing forms and selected-person bill handoff. One composition serves phone/desktop; no dual-role summary or combined Shop activity. Shop statement withheld pending BP-10; Udhaar retains its ledger and statement. Verification/costs/product rationale: `docs/performance/2026-10-18-p5-shop-person.md`.

18 Oct 2026 — R-DEC-10/11 Customers register, filter drawer and editable Shop reminder, plus approved BP-09 role-aware reads. Customer/supplier lists, person role header and Shop home headline panels no longer net the roles. The existing person-menu reminder now uses Shop amounts; its history and the Udhaar Sent tab are book-scoped. No financial posting/model or Library/Lending contract changed. This completes the Customers piece, **not the person-page or whole-app redesign**. Evidence, scores, remaining read-consumer gaps and measured costs: `docs/performance/2026-10-18-p5-customers.md`.

| Date | What was done | Files |
|---|---|---|
|20 Oct2026|R-DEC-28 plain labels across English/Hindi and server presentation: Quick Sale/Saved customer, Customer/Supplier/Contact by context.4,550 frontend passes and48 read-only browser frames. Full backend4670 pass/16 skip/3 failures; corrected59-test group passes incl isolated scale40.37s; original full-run caveat retained. Handoff updated; next remains billing/POS, Home deferred.|docs/performance/2026-10-20-plain-contact-terms.md; START-NEXT-SESSION-PROMPT.txt|
|20 Oct2026|R-DEC-27 billing component checkpoint: opt-in compact rows, edit/error focus retention, full names, readable total dock and numeric rates.4,550 tests,84 measured frames; whole POS remains in progress. Next: item search/customer composition and issue/recovery flows.|docs/performance/2026-10-20-p5-editor-lines.md;07-screens/09 §3|
|20 Oct2026|R-DEC-27 owner reordered work: billing/POS, purchases/returns, inventory/money/expenses/reports first; approved remaining Home workflows afterward, using those sources. Next: invoice/POS editor.|07-screens/09; START-NEXT-SESSION-PROMPT.txt|
|20 Oct2026|BP-15 Home source facts and Shop-origin read fences:4,673 backend passes/16 skips,4,547 frontend passes,168 measured frames; local payment refresh tested. R-DEC-26 approves promises, physical cash observations and explicit settlements; implement next.|docs/performance/2026-10-20-home-register-facts.md;08 BP-08/16/17|
|20 Oct2026|R-DEC-25 bill reading/detail checkpoint: native phone lines, summary/rail, current cancellation facts, Shop-specific Receive, editable sharing and safe print. Full4,541 tests;230 measured frames;four local₹1 receipts;12 quiet nav samples. New Home workflow scope remains pending approval; metadata read follow-up is next.|docs/performance/2026-10-20-p5-bill-detail.md;08 BP-08/15/16/17|
| 20 Oct 2026 | R-DEC-25 Bills register verified: visible statuses, compact totals, shared register/phone cards, header New, full dates/names, committed search and guarded N. 4,536 tests;102 en/hi measured states;12 quiet nav samples. Commit/push then invoice/POS editor/detail. | docs/performance/2026-10-20-p5-bills-register.md; 07-screens/09 |
| 20 Oct 2026 | R-DEC-21–25 Home accepted locally: header command, real Repeat/role lanes, compact period/group graph, joined phone figures and filled tabs; 4,532 frontend tests, 144 Home and 64 measured flow frames, local double-tap/receipt. Backend latest 4,665 pass/16 skip/one existing scale timeout; isolated pass48.66s. Commit/push checkpoint, then Bills/POS without reapproval. | docs/performance/2026-10-19-p5-shop-home.md; 03-shop-home.md; START-NEXT-SESSION-PROMPT.txt |
| 19 Oct 2026 | Superseded first Home composition (not the accepted delivery): Counter Mode figures, role-separated lanes, shared search/payment/reminder, tabs and lazy Insights; source-scoped local chart state and wrapping chart geometry. Final browser verification and delivery in progress; no new finance API. | docs/performance/2026-10-19-p5-shop-home.md; 07-screens/03-shop-home.md |
| 19 Oct 2026 | R-DEC-20: fast-forwarded seven Claude commits through 7de05d53; independent BP-14 review corrected legacy/sensitive stored exports, actual source scope, report-aging aliases/private main fields and disabled-app cash history. 12 fail-before assertions; 18 focused security checks; full backend 4,661 passed/16 skipped/zero failures. Home harness now measures loading/first use instead of merely taking PNGs. Next: actual Counter Mode Home rebuild. | docs/performance/2026-10-19-claude-review-access-followup.md; e2e/revamp-home.mjs |
| 19 Oct 2026 | R-DEC-18, found while reading Shop Home's data: the every-book `cash_in_hand` tile is now only for readers of every book (reproduced Shop-only read of Udhaar + Library cash). Shop Home must use `shop_cash_in_hand`. | docs/performance/2026-10-19-access-audit-imports-exports.md |
| 19 Oct 2026 | R-DEC-18: business-wide tag rename/merge/delete now needs the right in every contact app (reproduced Library-only rename). R-DEC-18 access defects found in this audit are resolved; Shop Home (R-DEC-16) starts next. | docs/performance/2026-10-19-access-audit-imports-exports.md |
| 19 Oct 2026 | R-DEC-18 access sweep completed by shared module and permission pattern: backup export owner-only (no defect); Deposits held report scoped to the deposit's app (reproduced Shop-only read of a Library deposit; 400 reports/payments/BP-11 tests pass). Tag question resolved in the next row. Next: Shop Home under R-DEC-16. | docs/performance/2026-10-19-access-audit-imports-exports.md; 02 §5.1 |
| 19 Oct 2026 | R-DEC-18 access audit continued: party import needs the main-book grant it posts into (read and write); background exports re-check the books recorded when requested; `/files/{id}` limited to logos/signatures. Each defect reproduced first; 7 regressions; full backend 4,638 passed/16 skipped/2 failed (known Library timing test, passed alone; sprint-1 route matrix fails identically on unchanged dev in the sandbox). Pushed as 4837eed3. | docs/performance/2026-10-19-access-audit-imports-exports.md; 02 §5.1 |
| 19 Oct 2026 | R-DEC-18 / BP-13: late actor/revision responses and cross-context 401 retries refused; expected-user/business preconditions stop old-tab writes before view execution; shared source identity and reload warning. 4,505 frontend tests, 96 measured browser states; 4,632 backend passes/16 skips/one timing failure passed alone in 49.73s. R-DEC-19 requires commit/push and handoff before Home; remaining access audit limits stay explicit. | docs/performance/2026-10-19-bp13-request-context.md; START-NEXT-SESSION-PROMPT.txt; AGENT_START_PROMPT.md |
| 19 Oct 2026 | R-DEC-18 / BP-12: explicit manifest/form Shop searches, business/book source keys, stale-choice guard, full long-name choices and app/recipient notification visibility for list/count/read/read-all. 4,494 frontend tests, 60 measured operator states; 4,628 backend passes/16 skips/one timing failure passed alone. Late previous-user same-business response reproduced and queued as next transport fix; no all-API privacy sign-off. | docs/performance/2026-10-19-bp12-context-isolation.md; docs/revamp/02 §5.1 |
| 19 Oct 2026 | R-DEC-16 Suppliers: shared Counter Mode table/phone register and filter, existing outgoing Pay, correct signed counts/sort and role copy. 123 measured Supplier states, 72 Customer regression states; real one-write payment/refresh/receipt; 4,489 frontend and 929 selected backend checks. Electrical-product many-to-many regression and R-DEC-17 example preference recorded. | docs/performance/2026-10-19-p5-suppliers.md; e2e/revamp-customers.mjs; apps/purchases/tests/test_shared_products.py |
| 18 Oct 2026 | R-DEC-13 Shop person piece: distinct role views, payment/bill handoffs, real unpaid source documents and role-specific payment history, no empty read-only dock; shared components/queries reused. BP-10 records the historical statement gap. | docs/performance/2026-10-18-p5-shop-person.md; e2e/revamp-person.mjs |
| 18 Oct 2026 | R-DEC-10/11/12 Customers register and approved BP-09: Counter Mode summary/chips, search/filter/sort, desktop table and responsive phone rows; local scale-book browser checks, en/hi state sweep, full frontend tests, explicit feature-gap ratings. Person/Suppliers/Udhaar next. | docs/performance/2026-10-18-p5-customers.md; e2e/revamp-customers.mjs |
| 17 Oct 2026 | Read-only audit of frontend, backend, existing docs and performance facts | 01, 02 |
| 17 Oct 2026 | Goals, principles, navigation strategy, feedback and performance plan, shared components | 03, 04, 05, 06 |
| 17 Oct 2026 | Screen specs for sign-in and onboarding, global shell, notifications, four module entry points | 07-screens/01–07 |
| 17 Oct 2026 | Backend proposals BP-01…07 (none approved) | 08 |
| 17 Oct 2026 | Design review rounds 1 and 2 for the foundation; whole-module scores deferred until their screens are specified | 09 |
| 17 Oct 2026 | Roadmap and QA plan | 10, 11 |
| 17 Oct 2026 | Owner chose the App button (N-1) | 04, 07-screens/02 |
| 17 Oct 2026 | Owner: keep the existing logo (R-DEC-06) | 03, AGENT_START_PROMPT.md |
| 17 Oct 2026 | Owner: screenshots on phone and desktop after every built UI piece (R-DEC-07) | 11, AGENT_START_PROMPT.md |
| 17 Oct 2026 | Wave 2 and 3 screen specs for Shop (two files), Udhaar, Library, Lending and shared overlays; each failed round 1 and passes round 2 provisionally; module scores in 09 §5a | 07-screens/08–13, 09 |
| 17 Oct 2026 | Phase 1 baseline measured on the scale book; H1–H4, H6 proven, H8 Lending Today only, H5 and H7 open | docs/performance/2026-10-17-app-baseline.md, e2e/perf-app.mjs, 05 |
| 17 Oct 2026 | Owner approved building Phase 4 (R-DEC-08) and handed it to a new session; no app code changed in this session | 12 |
| 17 Oct 2026 | Phase 4 piece 1 built: loading view on all 93 app routes (b168527). Throttled tap → first change p50 363 → 98 ms, p95 819 → 711 ms; link taps 52–165 ms; router.push taps and Lending Today → Loans not yet fixed | frontend/app/(app)/**/loading.tsx, RouteLoading, docs/performance/2026-10-17-f1-loading-views.md |
| 18 Oct 2026 | Phase 4 piece 2 built: pressed looks on every button variant, bottom tab, sidebar row and table row; `useAppRouter` + `RouteProgress` for the 68 `router.push` modules, lint-enforced. Customer row tap 299 → 18 ms; p95 without Lending Today 306 → 172 ms | frontend (hooks/useAppRouter, RouteProgress, UbRouteProgress, tokens), docs/performance/2026-10-18-f2-pressed-and-pending.md |
| 18 Oct 2026 | Phase 4 piece 3 built: double-tap lock. `UbForm` drops a second submit while the first is running; `UbButton` locks itself while an async `onClick` runs (`useAsyncAction`); `mayHaveBeenSaved()` decides when a request key is kept. Client-only fixes inside Lending and Library, no endpoint, body or calculation changed: Collect, Collect-from-borrower, New loan and Library's manual charge kept their key only on success, so "Try again" after a lost answer could record the money twice (07-screens/13 L-R1); and Collect's first desktop click on Save did nothing after typing an amount, because padding "1" to "1.00" on blur collapsed the preview card under the pointer. Live: one POST for a double tap plus Enter on Udhaar "You gave" and Lending Collect at 390/320/1280 in both themes; a lost answer retried with the same key came back `Idempotent-Replayed` with the same receipt. Navigation unchanged (throttled p95 without Lending Today 172 → 156 ms, within spread) | frontend (UbForm, UbButton, hooks/useAsyncAction, utils/requestKey, lending and library dialogs), e2e/revamp-shots.mjs `--piece=lock`, bundle-budgets.json, docs/performance/2026-10-18-f3-double-tap-lock.md |
| 18 Oct 2026 | R-DEC-09 built: the rail lists no app. One "Apps" row at the top (drawn only with a second app or an app to add) opens the new `/apps` page: "Your apps" as tiles, the open one marked, and for an owner "Add an app" tiles that switch an app on through `useAddApp`, the same hook the business menu now uses. The phone App sheet uses the same `AppTiles`. The F4 app tree (`SidebarAppTree`) and NavSections' filter props are removed. Live at 390/320/1024/1280, light and dark, Hindi: no app named in the rail, labels ≥ 7.7:1, switch and return land where they left. The "Add an app" tiles are covered by a unit test only, because the scale book already runs all four apps | frontend (navigation: AppTiles, AppsPageContent, SidebarAppsRow, useAddApp; app/(app)/apps; UbSidebar, NavSections, TenantSwitcherMenu, mobileNav, routes), e2e/revamp-shots.mjs, bundle-budgets.json |
| 18 Oct 2026 | Phase 4 piece 4 built: phone App button and App sheet; desktop sidebar app tree; dark teal rail (#0B3F45, dark theme #0E2427) with the logo on a white tile and a marigold edge on the current row; white page (R-DEC-02); each app reopens on the screen it was left on (per business, per app, session storage). The App sheet holds the app tiles and everything `/more` held (one `MoreMenu` body for both) and is `dynamic()`, fetched when the browser is idle. The screenshots found three defects, all fixed with a check that fails before the fix: in the light theme every rail label was dark ink on dark teal (1.4:1, now 7.7:1); the sheet's search ran edge to edge; and at the old 180 px rail "Delivery challans" and "Purchase orders" were cut, so the rail is now the specified 232 px and labels wrap instead of cutting. Navigation unchanged within spread | frontend (features/navigation: AppSwitcherSheet, SidebarAppTree, MoreMenu, appPlace, useOpenApp; UbBottomNav, MobileTabBar, NavSections, UbSidebar, tokens), e2e/revamp-shots.mjs `--piece=apps`, e2e/perf-app.mjs, bundle-budgets.json, docs/performance/2026-10-18-f4-app-button.md |
| 17 Oct 2026 | Tool-neutral start prompt for any coding agent; root AGENTS.md; design page copied into the repo | AGENT_START_PROMPT.md, design/ |

21 Oct2026 — R-DEC-31/32 viewport group1: Customers/Suppliers/Bills use shared row-only scroll and reachable paging. Manual append preserves position; result-set changes reset.522 measured final frames and416 suites/4,648 frontend tests pass; no financial writes/backend changes. Report: `docs/performance/2026-10-21-viewport-shop-registers.md`. Remaining lists stay pending in11.

21 Oct2026 review in progress — remaining sales lists still used tall stat cards/status-in-sheet despite09 §1. Correct the complete approved register composition under R-DEC-29/31; do not count them as covered by Bills. Reproduced stale query input, Challan Open credit column, and older-source reply/error replacement; regressions precede correction. Evidence continues in `docs/performance/2026-10-21-viewport-sales-documents.md`; this is not a new backend workflow approval or completion claim.

## Next

R-DEC-28 terminology checkpoint is delivered on dev; see the20-Oct label report
and updated continuation prompt. This changes words, not the sequence below.

**R-DEC-27 current order:**
1. Billing/POS editor and remaining sales document flows, purchases and returns.
2. Inventory, payments/advances/refunds, expenses/cashbook and reports.
3. Remaining Home workflows approved in R-DEC-26 (BP-08/16/17), integrated with
   the verified source workflows, followed by Home end-to-end acceptance.

Immediate next under owner R-DEC-31: Purchases and Shop Customers/Suppliers/Bills viewport groups are verified (21Oct viewport-shop report). Continue remaining sales-document lists, then each module list group tracked in11. Other matrix rows remain pending. This shared layout rollout is not a whole-module revamp certificate. Resume purchase detail §6, order conversion and full returns under the existing R-DEC-27 order; inventory/money/reports and remaining Home retain their full-workflow sequence. Do not copy fixed offsets or imply pending modules are fixed.
Billing phone performance stays 8/10 and its subscription redesign stays
deferred; do not repeat rejected memo/one-write/deferred-focus trims.

Delivered: Home surface4a66b430, Bills register ed6d1a2b, bill detailb49df7f6,
Home source facts/read isolationfe6852ae. The latest read checkpoint passes
4,673 backend tests/16 skipped,4,547 frontend tests and168 measured Home states.
It resolves the earlier full-run timing caveat for that run; physical/PWA limits
remain. Home's scoped8.76 surface/8.8 implemented-flow and8.2 full-parity reviews
are not whole-Shop certification. Do not call remaining approved writes built.

**R-DEC-16 active:** Customer register and the corrected Shop person piece are delivered (`06ac3b23`); BP-11 book authorization is delivered (`4e6d7b37`). Suppliers is delivered as `b0716d46`; after the R-DEC-18 access checkpoint continue Shop Home, then the remaining Shop screen families, then another app. Do not ask those phase/BP-09 approvals again. **R-DEC-13 supersedes the two-figure person-page design:** Customers shows only customer money and Receive/New bill; Suppliers only supplier money and Pay/Purchase bill; Udhaar independent. Current Shop facts are BP-09. Historical role-specific statements/aging are proposed BP-10, and shared-book authorization audit is BP-11 (implemented and pushed under R-DEC-15); BP-10 remains unapproved; the mixed Shop statement link is withheld from these views. Reports: `docs/performance/2026-10-18-p5-customers.md` and `docs/performance/2026-10-18-p5-shop-person.md`.

1. **Build Phase 4, approved (R-DEC-08)**, one piece at a time, in this order. After each piece, run the gates in CLAUDE.md, take phone and desktop screenshots in every state (R-DEC-07, method in 11), measure before and after with `e2e/perf-app.mjs` against the baseline in docs/performance/2026-10-17-app-baseline.md, then commit and report before starting the next.
   1. ~~F1 route loading views~~ done 17 Oct (b168527; results in docs/performance/2026-10-17-f1-loading-views.md). `RouteProgress` was not needed for link taps and moves into piece 2 if router.push taps still need it.
   2. ~~F2 pressed and pending states~~ done 18 Oct (results in docs/performance/2026-10-18-f2-pressed-and-pending.md). Full `npm run lint` takes over 25 minutes in the cloud container; lint changed files with `npx eslint --max-warnings=0 <files>` and say so.
   3. ~~F3 double-tap lock~~ done 18 Oct (results in docs/performance/2026-10-18-f3-double-tap-lock.md). Left for the screen work, not this piece: Collect's button still says "Save collection" while busy (no `busyLabel`; needs an en + hi string), and the "Not sure it was saved. Checking…" re-read in 07-screens/13 is not built (today the message is "Could not reach the server.", and Try again now replays safely). A Turbopack chunking duplicate (lucide's icon factory copied into the forms' validation-message chunk, ~0.6 KB on most form routes) appeared with this build; recorded in bundle-budgets.json, worth removing when someone has a build to spare.
   4. ~~F4 phone App button and App sheet; desktop sidebar app tree~~ done 18 Oct (results in docs/performance/2026-10-18-f4-app-button.md). Not built in this piece, each still in 07-screens/02: a figure on each app tile (no app's home figures are held app-wide yet), the "+ Add an app" tile (still in the business menu), the unsaved-changes guard on switching, the per-row pending spinner, the 64 px icon rail at 1024–1279 px (at 1024 the Customers filters now wrap to a second row because the rail is 52 px wider), hiding the bar while the keyboard is open, the `/account` page and the notifications popover. A long business name in the rail header still ends in "…".
   5. ~~R-DEC-09 one "Apps" row and the Apps page~~ done 18 Oct.
   **Phase 4 (R-DEC-08) is complete.** Owner chose Shop and Udhaar screens (R-DEC-10). Customers and the role-scoped person piece are built. R-DEC-14 person correction is delivered. Suppliers register and outgoing Pay journey are delivered; finish the R-DEC-18 access checkpoint, then Shop Home and remaining Shop screens under R-DEC-16. Do not ask the Phase 5/shell choice again; the omitted shell work remains unapproved.
   Library and Lending: shared shell only; their screens, endpoints and calculations stay as 02 freezes them.
2. Owner answers the five open questions (Udhaar undo, reminder tabs, Close khata, Shop person bottom bar, "Plan ended"), plus R-DEC-03, R-DEC-04 and the BP items. These do not block step 1.
3. Write the proposals the specs raised into 08 (BP-08 dual-role settle; Lending Today returning every loan and the loans / members N+1s; Library P-01…06; Lending FP-1…9; Shop P-08-01…06).
4. List the six new overlay pieces from 12-shared-overlays in 06.


## R-DEC-33 · Distinct mobile cards and compact search (22 Oct2026)

Owner: "but in mobile these are not table they should be like cards and there should on scroll paginratuon right"; "in desktop and mobile there is diffrenr way to showing data"; "in mobile view half of the screen are taken by filter, search and chip and title"; "why there is two search". The supplied21Oct22:41 Customers/settings screenshots are the mobile composition reference.

Desktop keeps tables and visible pagination. Mobile uses joined cards, scroll-next and a manual accessible fallback, without desktop page arrows. Put the sentinel inside the card scroll region, never pinned where it fetches every page. Preserve position and source scope, deduplicate overlapping pages, reset on filter/context changes and retain cards with retry on an append failure.

Mobile has one visible list-search field. Global Shop search remains a44px header icon rather than another full-width search row. Compact title/New in the header, search+Filters, one quick-chip strip and a one-line summary; no FAB covering records/paging. Preserve touch targets and required data. Supplied settings-row reference informs that future screen; no new settings workflows or frozen financial changes are authorized here.

This latest decision supersedes earlier mobile manual/arrow-paging acceptance and Next references: desktop viewport verification remains; Customers/Suppliers/Bills/Purchases mobile need follow-up. Finish the active sales-register/mobile shared composition and reverify before a final rating or push. Continue remaining module list groups, then R-DEC-27 workflows; Home stays last.


23Oct2026 owner checkpoint request: "commit and push and give me updated prompt in same manner". Preserve current unfinished sales/mobile composition as an explicit IN-PROGRESS checkpoint. Latest continuation is the23Oct section in both revamp prompts; it supersedes stale Next entries. Latest1024 compact-breakpoint correction needs fresh full visual acceptance/performance. No final rating or all-module certification. R-DEC-33 follow-up includes previously verified Bills/Customers/Suppliers/Purchases; Home retains its approved single command field.


## R-DEC-34 · Feature by feature (23 Oct 2026)

Owner: "and I would say go feature wise fetaure else will never complete our developemnt".

Finish one feature completely before starting the next: build, full gates, LOOK, phone and desktop acceptance, performance, docs, commit and push. Only then open the next feature. Do not spread a shared change across several modules and leave each half-verified. The order stays as R-DEC-27 and the IMMEDIATE NEXT list give it. The current feature is the sales-document lists (Estimates, Orders, Challans, Credit Notes) under R-DEC-33. Bills, Customers, Suppliers and Purchases are each a later feature, one at a time.

Progress 23 Oct 2026 (afternoon): sales-document lists verified on the exact checkpoint (gates, sweep EN/HI, mobile contract, LOOK, A/B). Phone 4x-CPU navigation is ~50 ms slower than 477916b and is recorded, not hidden. Next feature under R-DEC-34: Bills register mobile cards (R-DEC-33), then Customers, Suppliers, Purchases, one at a time.

Progress 23 Oct 2026 (evening): Bills register phone composition verified (gates, EN/HI sweep, mobile contract, LOOK, A/B vs 7b27948). Known limit: at 320 px with crore totals the summary wraps and cards get 58.5%. Next feature under R-DEC-34: Customers register (R-DEC-33), then Suppliers, then Purchases.


## R-DEC-35 · Udhaar → Lending → Library; plain words, optional notes, relevant defaults

25 October 2026, owner handoff and decision replies recorded in this session
by 05:46 UTC (11:16 IST). Continue this revamp on dev; Shop is the approved
reference and is complete for the requested work. Order: Udhaar first, then
Lending, then Library. Finish each screen/overlay group with gates, LOOK,
phone/desktop acceptance, same-machine A/B, docs, commit/push and remote SHA
before starting the next. No routine next-screen permission questions.

Owner rules: short everyday English (roughly10words/idea) and simple spoken
Hindi, each English change paired in Hindi. Udhaar You gave/You got; Lending
Lent/Collected, Running/Late; Library Fee/Paid, Student. Technical identifiers
stay intact. Avoid transaction/ledger/outstanding/receivable/payable/aging/
archive/reverse/void/disburse/arrears/instalment/EMI/export CSV in user copy:
entry/book/due/You will get/You will give/Old dues/Hide/Cancel entry/Give loan/
Late/payment/Download (Excel). No queue/sync/payload exposed to users.

Notes always optional: Note (optional), no empty-note save refusal, amount→Save
fast path. Audit reasons stay required with one-tap reason suggestions. Check
client and server; frozen Lending/Library server refusal requires a proposal,
never an unapproved contract change.

Relevant defaults use existing server filters, URL persistence and server
counts when available. Udhaar people: Due (nonzero, active) /You will get/
You will give/Settled/All; hidden only explicitly requested. Lending: Running,
Late,Closed,All; borrowers with running loans. Library: Active/Fee due/On hold/
Left/All, free seats and available books/copies first. Histories latest few,
Show all(N). Never filter paged results in the browser. Missing server filters
require08 approval; keep supported defaults until then.

Owner replies (exact): "Keep Cancel entry with a reason (recommended)";
"Udhaar only (recommended)"; "Hide person / Show again (recommended)";
"Approve balance=due (recommended)". Q1/Q2/Q3 are resolved accordingly;
Library Plan ended wording remains open for that feature. BP-20 is approved
for the minimal Udhaar read filter only. No financial write/calculation change.

Reference conflicts resolved by owner:04's Add-person FAB and stat cards are
superseded by compact header action and shared register/summary (R-DEC-33).
DESIGN-SYSTEM's historical warm page and archive wording are superseded by the
owner's white page and plain words.04's optional split-view is not a new
workflow: existing person navigation remains until that next piece. Personal
Udhaar is still tenant-book-scoped in code (02 §5.1); this presentation work
must not claim independent per-user ownership is implemented.

Immediate next: Udhaar home/people register and its filter group (/khata).
Keep Shop layouts/flows as reference; rerun Shop regressions if shared code
changes. Person khata/entry overlays follow after this piece is fully verified.

25Oct2026 code/doc disagreement: R-DEC-35 requested independently owned Udhaar use, while 02 §5.1 and `Party.balance` are tenant-main-book scoped. This presentation piece fixes wording to say "this book" and records the privacy gap in the Udhaar report; no ownership backend change is authorised by the presentation-only boundary. Whole-module privacy/function completion is not claimed.

## R-DEC-36 · Simpler Udhaar list from the owner's KhataBook references

25 October 2026, owner screenshots and replies received by 06:09 UTC (11:39
IST). The owner said: "on fist keep avatate and amount only just like in that
khata bookk baiscel replaict that but make wording and other things diffrenr
and keep in my we have to beat khatabook for that feature"; "That chip can we
add inside filter"; and "make it more simple lioke that in khatabook don't need
to complcat that feature". These instructions supersede the five-chip strip
and list-row reminder action drafted earlier today. The primary phone list is
avatar, full person name and directional amount; tap opens the khata history.
Balance choices move into Filters. The header holds Add person without an
unexplained ⋯. Person-level reminder stays in the existing person page flow,
with editable text before WhatsApp/SMS/Call handoff. Existing backend money,
entries and permissions do not change. Preserve other management capabilities
via their existing dedicated routes; their Udhaar entry points need a separate
navigation review before claiming full access on mobile.

## R-DEC-37 · Udhaar entry words

25 October 2026, owner asked for words other than "You gave / You got" and
replied "yes proceed" by 06:24 UTC (11:54 IST) to the recommended plain
English. Use "Gave money" / "Got money" for Udhaar entry buttons, entry
headings and statement columns; Hindi "पैसे दिए" / "पैसे मिले". Keep balances
separate and label them "To get" / "To give" (or their existing full-sentence
equivalents where the label needs to stand alone). This supersedes the older
Udhaar wording examples in 02/04/10 without changing ledger direction,
amounts, endpoints or historical records.

## R-DEC-38 · Approve Udhaar-only contact membership (BP-21)

25 October 2026, owner reply received by 06:36 UTC (12:06 IST): "Approve
BP-21 after this screen (Recommended)". The current quick Add still uses the
shared Party role model, so a new Udhaar person can appear in Shop Customers.
BP-21 will add explicit book membership with server-side list/count/search/
export/write fences and a cautious legacy migration. Build it as the next
verified piece after this screen is committed and pushed. No phone-number
linking, balance netting, or Library/Lending contract change is approved.

## R-DEC-39 · Udhaar phone header and row density

25 October 2026, owner screenshot feedback received by 06:48 UTC (12:18 IST):
"there is too much size why not avater name same row" and "remove that title
in case of mobile ... keep like floating button like in khata book". The owner
also questioned the line directly under search/filter. This supersedes
R-DEC-36's phone-header Add placement. Phone `/khata` now hides its page title,
keeps Search + Filters, puts avatar and full wrapping name beside the amount
in a compact shared card variant, removes the summary's top border, and places
one floating Add person action above the bottom navigation. Desktop keeps its
heading and ordinary Add action. The browser harness measures avatar/name
alignment, card share, visible heading, FAB, text fit and contrast.

## R-DEC-40 · Keep the person-row arrow

25 October 2026, owner: "keep that > icon for shwoing direction" (received by
06:58 UTC / 12:28 IST). The compact Udhaar row keeps a right chevron as a clear
open-history cue. It remains one 44px+ tap target, with avatar and wrapping
name beside the directional amount. The 320px long-name case is remeasured.

Progress25Oct2026: Udhaar people/quick Add UI checkpoint implemented under R-DEC-35–40. Full frontend4,848tests and production gates green;38 measured EN/HI frames and matched navigation A/B recorded. Existing ledger54/54, statement24/24, credit19/19, tags13/13, people30/30, write-off11/11 pass; Old dues52/54 and reminder/expense omnibus remain red, explicitly retained in report. No whole-module >8.5 claim. Next approved piece is BP-21 after commit/push of this scoped checkpoint; then person history/entries and remaining Udhaar before Lending/Library.

Integration25Oct2026: remote dev advanced to7a9de2c1e during verification.
Committed Udhaar checkpoint4000c136d, then merged the remote shared-table/form/
security/SW fixes and business-type planning docs. Resolved two conflicts by
preserving both changes. Combined-code439suites/4,856tests, types/locales/lint,
production/bundle/contrast and38frame EN/HI rerun pass. Original A/B predates
the merge and is not recast as final runtime proof. BP-21 remains next.

## R-DEC-41 · Additional shared mobile reference for all apps

25 October2026, owner instruction recorded10:07UTC (15:37IST): use
https://claude.ai/artifact/RsYjPpq2t3zCTMu5iUSvNm#gf as an additional mobile
reference wherever needed; the owner intends to apply these patterns to Shop
later and wants consistent patterns in Library and Lending. The exact artifact
is already committed as `design/shop-fixes-and-business-types.html`, with its
identity confirmed by `design/shop-fixes-notes-for-prompt.txt`. The live link
could not be opened by the web reader; this decision is based on the committed
HTML, not a claim to have viewed the live artifact.

Read PartF (#gf) phone lists/detail/actions and A2/A5 shared disclosure/form/
drawer guidance before the next mobile piece. Reuse the same existing design
system rather than copying feature-specific code: one search/filter row,
compact records, stable counts during refresh, clean frame/separators and
reachable actions. A5 specifies6px label→field,4px field→hint,16px field gaps,
24px group gaps,16px phone/24px desktop edges,44px phone/40px desktop fields,
and Cancel/Save together with Save wider. These are reference acceptance
criteria to verify when each relevant overlay is redesigned, not a statement
that all current components already satisfy them.

Udhaar's latest explicit R-DEC-36–40 decisions retain precedence for its list:
no phone page title; avatar/full name/amount/chevron; choices in Filters;
floating Add person; Gave money/Got money and To get/To give. Use Library/
Lending's own nouns, money words and workflows. L-01 financial/API/model
contracts remain frozen. The artifact's Shop business-type/scanning proposals
do not authorise new Library/Lending features or change the current work order.
BP-21 remains next, then Udhaar completion, Lending and Library; do not reopen
Shop implementation from this reference-only instruction.

## R-DEC-42 · Shop is outside this thread's implementation scope

25October2026, owner: "DOn't do any things in shop modue" and "only follow
that desigin for UDhar , Library and Lending". This supersedes the immediate
BP-21 order: defer its cross-app membership/backend change because it would
change Shop's contact behavior. No membership application code was changed
before this instruction. Work only on Udhaar, Lending and Library presentation
using the shared artifact reference. Shared components may be reused; avoid
changing the Shop rendering/behavior. Next piece: Udhaar person overview,
visible statement/reminder actions and entry history composition under the
khata app guard, then its overlays and remaining Udhaar scope. Preserve L-01.

## R-DEC-43 · No global search in Udhaar, Library or Lending

25October2026, owner: "global search is not required for Udhaar, librayr and
lending". Hide the shell search on phone and desktop in these three apps;
keep each screen's own search. Library/Lending already omit shell search in
their manifests; remove Udhaar's partySearch opt-in. Shop's manifest and search
stay unchanged. Regression checks cover all three routes and existing Shop
search assertions. This overrides the earlier Udhaar header-search reference.

## R-DEC-44 · Udhaar person actions as a compact icon row

25October2026, owner screenshot feedback: replace outlined Statement/Remind
buttons with simple icons like the supplied KhataBook person reference, designed
for busy users. Use Report, Remind and Call icon actions with short visible
labels and44px+ targets. Report opens the existing statement, Remind opens the
existing editable composer, Call uses tel:. Keep the reminder-history status
with Details rather than spending a separate primary row on "Not reminded yet".
Entry history follows the action row. No new financial or messaging workflow.

## R-DEC-45 · Personal Udhaar with name/mobile only

Owner clarified25October2026: this is money given to/from friends and other
people; Add/Edit needs only name and mobile. Entry needs Gave/Got, amount and
an optional note. Keep balance, history, WhatsApp/SMS reminders, Call and Report.
Remove business Details, email/address/GST, credit limit/days, terms and opening
amount from Udhaar's visible contact flow. The user asked for a fresh minimal
implementation; preserve saved entries/balances and shared financial engines
used by Shop/Library/Lending. No shared-table destructive deletion. R-DEC-42's
no-Shop-work rule remains. The live artifact #d12 is inaccessible; committed
#d12 is a Shop dashboard, so it is not claimed as inspected Udhaar parity.
Official Khatabook help reviewed25October: contact name/optional phone/phonebook,
then a separate Gave/Got amount entry. Source:
https://khatabook.com/help/en-us/category/X1IofBAAACQAT1tS/ .

R-DEC-45 implementation choice: personal list starts All active, not Due, so a
name/mobile-only contact remains visible before the first entry. The existing
To get/To give/Settled choices stay inside Filters; business credit/tag/type/
collection axes are absent from personal filters. Existing BP-20 Due API is
retained for compatible reads, not the personal default. This supersedes the
older R-DEC-35 default for the owner's new personal-book scope.

## R-DEC-46 · Personal action styling

Owner clarified: Gave money keeps its red color; Got money uses the primary
brand color. Report/WhatsApp/SMS/Call use one regular font, size and ink, with
matching icon sizes. Use the actual WhatsApp mark, not a generic chat bubble.
WhatsApp and SMS each open an editable composer focused on that selected
channel; no extra Copy/More/Call choices in the personal composer. The shared
sheet defaults remain unchanged for other modules. Personal inputs follow44px
phone controls; Add/Edit footer uses Cancel and Save side by side.

Progress25Oct2026: final personal-Udhaar core implemented under R-DEC-45/46 in
a separate page, preserving other apps' shared renderer. Name/mobile-only wire,
amount/optional-note entries, All-active list, minimal menu, matching secondary
actions with proper WhatsApp mark; red Gave/primary Got. Final440suites/4,865
frontendtests,443backend/contracts pass(4skipped), standard gates,70frames and
21realQAchecks green. Three fast Save taps→onePOST,500given−200received=300.
Quiet matched throttle phone633→426ms,desktop920.5→428ms,n=6. Canonical report:
2026-10-25-personal-udhaar-core.md. Older prototype scores superseded. Next:
personal report/print and correction/recovery overlays, then Lending/Library.
Mainbook per-user privacy and BP-21 remain explicitly unresolved/deferred;
no Shop implementation or shared-data deletion in this thread.

## R-DEC-47 · One local Back arrow on the personal person page

25October2026 owner questioned the global-header arrow and the separate Back
to People text row. Keep one44px local arrow beside the person's full name,
returning directly to /khata (including deep links); no visible Back-to-people
text row and no duplicate mobile-shell arrow. Other apps and nested statement
pages keep their existing header Back. The manifest declares which page owns
Back; the shared shell does not name an app. Fail-before shell regression was
red; the updated shell/person/navigation group passes35checks. Color clarification:
teal#0E7C86 is brand primary; marigold#F59E1B is the established main-action/CTA
color used by the existing primary button style. No palette change was requested.

## R-DEC-48 · Fix personal ownership before further Udhaar work

25 October 2026, owner: "udhar app is speare module based on logged in user"
and "proceed and fix them". The owner again reports business customer/supplier
rows in Udhaar. This explicitly prioritises the missing ownership requirement
over R-DEC-42's deferral; it does not authorise Shop redesign or deleting shared
business records. Implement a server-owned personal book independent of active
business, with real read/write/count/statement/reminder isolation, preserving
shared financial services and live Library/Lending contracts. No inferred
migration of ambiguous old shared entries. BP-21's book-membership-only proposal
is superseded for personal Udhaar by unique user-owned private storage.

Also: To get and To give are separate green/red cards, no people-count text or
extra divider; one local back arrow beside the person's name. Acceptance and
remaining checks: docs/performance/2026-10-25-private-udhaar-fix.md.

## R-DEC-49 · Got money uses the sidebar colour

25 October 2026 owner: "that get button should be same as sidebar color instead
of yellow color". Got money uses the existing surface-nav token (dark teal) and
white text, including its phone dock and desktop action. Gave money stays red.
This supersedes R-DEC-46's marigold Got money choice; Add person is unchanged.
Named regression fails on the yellow version, passes on the dark-teal version;
browser acceptance compares computed Got money and sidebar background colours.

Progress25October2026: R-DEC-48/49 verified: private user-owned Udhaar API,
Shop-contact exclusion and owner/staff separation; green/red balance cards,
no count strip/divider, one local Back arrow; Got money matches sidebar dark
teal. Final4,872frontendtests,838backend/contracts+4skips, gates and44measured
frames pass. Quiet old/new/old/new throttled phone422.5→418ms, desktop414→407.5ms;
no speed-improvement claim. See2026-10-25-private-udhaar-fix.md and machine data.
Next: remaining minimal personal report/correction/recovery verification, then
Lending and Library; do not revert to business main-book reads. Existing shared
records retained, no inferred ownership migration; production not touched.


Progress26October2026: owner requested senior exploratory browser QA, beyond
happy paths, including phone taps, cards, three dots and refresh behaviour.
Interactive local production-browser audit of5094e1d40 found UQA01–10; fiveP1s
(CSV404, personal print business identity, draft reload loss, business-read-only
personal Add blocked, personal Got correction requires payment method). Money
correction/cancellation and lost-reply retry arithmetic passed. Card/menu/Back
journeys worked in sampled mobile emulation; cached list money flashed old then
updated without reload. Do not dismiss physical-phone report or claim full QA.
Next: fix P1s with meaningful regressions, rerun affected real journeys, finish
remaining coverage matrix before any whole-Udhaar sign-off or Lending/Library.
Report: docs/performance/2026-10-25-udhaar-exploratory-qa.md. Audit-only; no
application changes.


Progress26October2026, Shop A2 folding sections (FB-012): rebuilt from the
handoff description (the patch file was not on disk). UbDisclosure root clips,
owns card colour and focus ring; square 52px header; `flush`. UbPanel `bare`
and orphaned-divider hiding; PartyInfoPanel `bare` rows 14/16/8. Looking found
three defects tests missed: doubled rules from null sections, a non-existent
semibold class (title rendered 400), and a heading over a still-loading row.
50 measured frames, 0 failures/console errors; jest 4876; build/bundle OK.
Next: A1 header search. Report: docs/performance/2026-10-26-shop-a2-folding-sections.md.

Progress26October2026, Shop A1 header search (FB-011): full-screen phone
search, 640px grouped desktop list (Start/People/Items/Bills), one-line rows,
shorter hint. Found by using it: letters lost and no keyboard on a phone, grey
not teal highlight (pixel-sampled), Start flooding the list, coloured amounts
the design draws neutral, no paid state on bills. Every shown figure read back
from the API (34 rows x 10 views, 0 mismatches; skewed self-test fails all).
Scan button deferred to Part C. Words now layered app -> business in
useAppWords (BP-22 seam). Next: A3 saved customer box.


R-DEC-50 (owner, 26 October 2026) — P0 FOR EVERYTHING: every screen is
pixel-exact and functionally identical to the approved design, in every case.
Owner's words: "Want exact 100% pixel perfect and functional like in artifact
… keep that in mind for each and everything … add that also in docs as P0 for
everything." Method (CLAUDE.md acceptance gate 13): measured computed values
against the design's CSS numbers, pixel-sampled colours, design mocks
photographed side by side with the built screen per case (390/320/1280,
light/dark, EN/HI, empty/loading/error/long/no-match), every shown figure read
back from the API with a self-test that proves the read-back can fail,
busy-counter behaviour, manual exploratory, seeded monkey and functional end-to-end testing (owner, same day), and conflicts with earlier owner rules listed for the
owner rather than chosen silently. Multiple business types are designed in from
the start (useAppWords, BP-22). Applies to Shop, Udhaar, Lending, Library and
every later app.

R-DEC-51 (owner, 26 October 2026) — business-model decisions, answered on the
visual map (https://claude.ai/artifact/JQwhANuqjVAcxs4PFjBrcb), all as proposed:
1. Per business type: words change and rows a business never uses are hidden;
   the menu ORDER is the same for everyone.
2. Phone bottom bar: Home · Bills · Customers · Items · More.
3. Starter categories: the list for the business type, all ticked; the owner
   unticks.
4. First business type to build: Hardware & electrical (P1: box/piece units,
   part numbers, rack).
5. Bill line details: a bottom sheet on a phone, under the row on desktop.
6. Owner-typed words: English required, Hindi optional; the built-in Hindi
   word is used until one is added.
7. Features are per business, never per staff member; people are limited by
   roles and permissions.
8. The server sends the menu rows (BP-22 #3).
BP-22 is approved: words, features and menu rows go in the session, resolved
on the server. Doc 17 §7 records the same answers. Parts B, C and D may start
in the order of the ORDER section of START-BUSINESS-TYPES-PROMPT.txt, after
Part A, Part F and BP-22's build.

R-DEC-52 (owner, 26 October 2026) — Shop scope, in the owner's words: "update
the entire UI of the Shop module along with the additional features as we
mention in docs, pixel perfect as per that artifact, end-to-end working
features, and also remove all unused, unnecessary and duplicate code."
So the Shop work is: (1) every Shop page, modal and component redone to the
approved artifact, phone and desktop (R-DEC-50); (2) Parts B, C and D per the
design page and plan 13, in the order R-DEC-51 set; (3) every feature proved
end to end through the UI with API read-back; (4) unused, unnecessary and
duplicate code removed — the code a redone screen replaces is deleted in the
same commit, plus one measured sweep (unused exports, locale keys, CSS,
duplicated rules into one owner). Nothing is removed on a guess: each removal
is proved unused by search, build and full tests. A new dead-code tool needs an
ADR first. Estimate given to the owner: about 9–10 months for one developer
(plan 13's figures plus ~1–2 weeks for the sweep); jewellery (P7) and ERP (P8)
are separate.

Progress26October2026, Shop A3 saved customer box (FB-013): one two-part
switch, the box in two lines/two columns (avatar · name · Change / mobile ·
Shop balance), desktop one row 300·1fr·360, all measured equal to the design.
Thirteen defects found by read-back, functional, monkey and manual testing,
none by a unit test: wrong book's money on a Shop bill (P0, FB-018), autosave
racing Issue (409), a deleted discount failing every save (sales and
purchases, now one owner), 150 % off silent and autosaved, a React flushSync
warning from Radix checkbox/switch (and a freeze in the first fix, caught by
the monkey watchdog), lost typing after Saved customer, unformatted mobiles in
the picker, and sizing/height details. Filed: FB-019 UPI QR request, FB-020
absurd quantity/rate accepted (A4), FB-021 box grows once for a five-figure
balance at 390 px. Report: docs/performance/2026-10-26-shop-a3-saved-customer-box.md.
Next: A4 adding items.

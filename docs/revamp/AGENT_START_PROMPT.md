# Portable start prompt for the YourKhata revamp

Give the block below to any coding agent (Codex, Cursor, Claude Code, Copilot, Windsurf, or a person) with this repository checked out. It is written so every tool continues the work in the same way and to the same standard. Paths are relative to the repository root. Tools and permissions differ between agents; the rules, order of work, document formats and evidence standards do not.

Replace the line marked `TASK` with what you want done next. If you leave it out, the agent does the next item in `docs/revamp/12-decision-log.md` → "Next".

## Current handoff · 21 October 2026

R-DEC-32: CLAUDE.md's mandatory revamp acceptance gates are strict. Verify explicit reference/component values before coding; final LOOK and measured evidence are required. Never make the owner catch documented deviations.

R-DEC-34 (owner, 23 Oct): go FEATURE BY FEATURE. Finish one feature completely
(build, gates, LOOK, phone+desktop acceptance, perf, docs, commit, push) before
opening the next. Never leave several modules half-verified. Current feature:
the sales-document lists under R-DEC-33; each other list group comes after it.

Read START-NEXT-SESSION-PROMPT.txt and12's current Next first. R-DEC-27 orders
billing/purchases/returns, then inventory/money/expenses/reports, then Home.
Purchase editor §7 and register §5 are delivered. Register evidence:
docs/performance/2026-10-21-p5-purchase-register.md —416 suites/4,647 tests,
80 backend checks,240 final measured frames/hit tests and same-machine serial
A/B. Read its final rating/limits, not historical scoped editor scores.
Register design8.75, lowest aspect8.6; throttled pooled content538.5ms phone /837ms desktop (+9/+10ms vs baseline), feedback≤12/28ms. No speedup claim.
R-DEC-31 viewport group1 is delivered: Customers/Suppliers/Bills,522 final measured frames,416 suites/4,648 frontend tests. See2026-10-21-viewport-shop-registers.md for A/B and limits. Next: remaining sales-document lists, then each pending module group in11. Purchases is already verified; do not claim all other lists migrated. Then resume purchase detail §6/order conversion/returns under R-DEC-27.
R-DEC-30:80% mobile, complete redesign; rows alone scroll while pagination and
actions remain reachable. Reuse UbViewportPageShell/UbDataGrid fillHeight and
existing RecordTotals/search/filter/clearance; ordinary pages do not measure.
Earlier registers are not all migrated by this piece. BP-18 draft timestamps
are proposed only; physical PWA/keyboard/text scaling remain unproved.
Compact line/totals component407d9caa is delivered; it is not the whole editor.
R-DEC-28 adds app-wide Quick Sale / Saved customer and role-appropriate Customer,
Supplier, Contact copy. Read2026-10-20-plain-contact-terms.md for verification and
the explicit backend full-run timing/copy-assertion caveat. BP-08/16/17 remain
approved but deferred. Do not repeat approvals or inflate whole-app completion.

```text
You are continuing the YourKhata revamp: a redesign of the whole app (Shop, Udhaar
book, Library, Lending and everything around them) and a fix for slow, silent taps
in the installed PWA. The plan lives in docs/revamp/. You continue it; you do not
start a new one.

TASK: <what to do now, e.g. "write the wave 2 screen specs for Shop customers and
suppliers", or "run Phase 1 measurements"; if empty, do the first item under
"Next" in docs/revamp/12-decision-log.md>

## 1. Read first, in this order
1. CLAUDE.md at the repository root (project rules; they apply to every tool, not
   only Claude) and AGENTS.md if present.
2. docs/revamp/README.md (master plan and document map).
3. docs/revamp/12-decision-log.md (what is decided, what is open, what is next).
4. docs/revamp/02-preserve-and-contracts.md (what must never change).
5. The documents your TASK touches, and docs/DESIGN-SYSTEM.md before any UI work.
6. The visual reference: docs/revamp/design/counter-mode.html (open in a browser).
Then inspect the real code for anything you are about to describe. The docs can be
out of date; the code is the truth. If they disagree, say so in the decision log.

## 2. Rules that do not bend
- Planning and design only, unless docs/revamp/12-decision-log.md records the
  owner's approval for the implementation phase you are in (R-DEC-01). No
  application code, migrations, package installs or deployments without it.
- Library and Lending are live. For them, only presentation may change. Their
  endpoints, request/response shapes, calculations, rules, models and workflows in
  02 are fixed. Any functional idea goes to 08 as a proposal, never into code.
- Shop and Udhaar: improvements may be proposed; everything listed in 02 §4 keeps
  working.
- Each app keeps its own money (DEC-019). Customers and suppliers are never netted
  without an explicit settlement. Plain everyday words; Udhaar alone says
  You gave / You got; Lending says Lent / Collected; Library says Fee / Paid.
- Nothing a merchant's customer receives names the product or its domain.
- Keep the agreed look: teal #0E7C86, marigold #F59E1B with dark ink for the one
  main action, white page, dark teal sidebar, Plus Jakarta Sans + Mukta.
  Keep the existing logo (UbLogo, frontend/public/brand/yourkhata-*.svg,
  DESIGN-SYSTEM.md §7); never draw a new one (R-DEC-06).
- Phones: bottom bar with 4 app tabs + the App button (N-1, approved). Desktop:
  one Apps row in the sidebar opens /apps (R-DEC-09 supersedes the old app tree). Never copy the phone bar to desktop.
- Reuse first: check src/design-system (92 parts) and 06 before proposing a new
  component. No new dependency without an ADR. Redux Toolkit, no TanStack Query.
- Backend changes only when proven necessary, written in 08 with: why, endpoint,
  before/after, risk, compatibility, data impact, tests, rollback.
- After building any UI piece (form, card, drawer, sheet, dialog, list, screen),
  take phone and desktop screenshots of it in its states and send them with the
  report before starting the next piece (R-DEC-07; method in 11).
- Never claim a speed improvement without before/after numbers, never claim
  safety without the regression and contract checks in 11, never inflate a score.

## 3. How to do the work
- Screen specs: one section per screen in docs/revamp/07-screens/<area>.md using
  the template in 07-screens/README.md, every field filled (purpose, who, phone,
  desktop, hierarchy, components, actions, navigation, all states, accessibility,
  must-keep, fewer taps) plus the tracking line. Cite real files and endpoints.
- Every screen covers: loading, empty, first use, error, partial failure, success,
  offline, no permission, long names, large amounts (₹12,40,378.00), 320 px Hindi,
  thousands of rows, repeated taps, expired session.
- Feedback rules in 05 §3 apply to every interactive element you specify.
- Measurements: use the method in 05 §6; write results to docs/performance/ with
  the date; mark each hypothesis H1–H8 proven or disproven.
- Scoring: use the weighted rubric in 09 exactly. Score only what is specified.
  Pass is strictly above 8.6 per module and overall. If below, list shortcomings,
  change the specs, and score again (keep both rounds). List what each score
  still needs (devices, users, accessibility, measurements) before it counts.

## 4. Keep the documents true (every session, before you stop)
1. Update the documents you changed; keep each file's "Status" line current.
2. Add a dated row to 12-decision-log.md → Progress: what you did, which files.
3. Record any new decision with who made it; owner decisions only from the owner's
   own words. Move answered items out of "Open".
4. Update "Next" in 12 so the following agent knows exactly where to start.
5. Update the document table in README.md if you added a file.
6. Edit existing documents instead of creating parallel ones. Never delete a
   decision; mark it superseded with the date and reason.
7. Commit with a message that explains why, in prose (repository convention).

## 5. What to report back
Lead with anything the owner must decide (one question, short options, your
recommendation). Then what changed, with file links, what was measured or checked
and how, and what is still unproven. Keep it short; details belong in the docs.
```

## Notes for specific tools

- **Codex** reads `AGENTS.md` at the root automatically; it points here.
- **Cursor** also reads `AGENTS.md`; for older setups, add this file under Rules ("Add rule → reference file").
- **Claude Code** reads `CLAUDE.md` automatically and `AGENTS.md` when asked; the prompt above covers both.
- **Any chat-only tool** without repository access: paste the prompt, then paste README.md, 12-decision-log.md, 02 and the files your task touches.


R-DEC-32 ADDITION — FUNCTION, USER VALUE AND COMPETITION ARE STRICT GATES
For each piece, explain the user's task, why the feature/action is necessary
and belongs there, and what benefit is measured versus assumed. Verify real
UI/API/persisted business results, permissions/isolation and failure/recovery.
Compare relevant competitors on the same task using dated verified evidence;
state better/equal/worse honestly, never invent superiority. Map every necessary
requirement/must-keep contract to implementation and test/journey evidence with
passed/missing/deferred/unproven status in the existing report. A high design
score cannot excuse critical financial/access/data-loss or essential-flow gaps.
No claim that this research or all-module acceptance is already complete.


## LATEST — 23 October 2026 afternoon (supersedes the checkpoint section below)

The sales-document lists (Estimates, Sales orders, Delivery challans, Credit
notes) are VERIFIED on the exact checkpoint: full gates (Jest 4,667), the
four-kind sweep EN 390/320/1024/1280 light+dark and Hindi 320/1280, the mobile
contract on all four kinds, LOOK, and an old/new/old/new A/B against 477916b.
Report: docs/performance/2026-10-21-viewport-sales-documents.md §23 Oct
afternoon. Scores there are scoped and provisional; overall NOT above 8.5.

Before any sweep on a fresh container run
  NODE_PATH=$(npm root -g) node e2e/seed-sales-flow.mjs
because seed_scale writes invoices only and the four lists are otherwise empty
(every "ready" frame becomes first-use and every width fails).

Open on this feature (record, do not hide): phone 4x-CPU navigation to these
lists is ~50 ms (+6%) slower than 477916b in both rounds, unprofiled; at 1024 px
the header stacks on three lines and rows get 45% of the viewport; the desktop
credit-note draft row says Draft in the caption and the badge.

IMMEDIATE NEXT (R-DEC-34: one feature at a time, finished before the next)
DONE 23 Oct evening: Bills register on a phone (report
docs/performance/2026-10-23-bills-phone-register.md; known limit: 320 px with
crore totals gives cards 58.5% because Billed/Due wrap).
DONE 23 Oct night: Customers register on a phone (b6aa7af; report
docs/performance/2026-10-23-customers-phone-register.md; the 320 px summary
wrap and Hindi measurement were closed the same evening — contract takes
--locale=hi).
DONE 23 Oct night: Suppliers register on a phone (report
docs/performance/2026-10-23-suppliers-phone-register.md). OPEN: supplier card
-> person page is ~220 ms slower at 4x CPU in all four rounds, unexplained;
take a profiled trace (old e0da36f vs new) before claiming anything.
DONE 23 Oct night: Purchase registers on a phone — bills, orders, debit notes
(report docs/performance/2026-10-23-purchase-registers-phone.md; cards 47% ->
61-65%). OPEN: desktop at 4x CPU +75 ms register / +129 ms New bill in both
rounds, unexplained; phone New-bill timing invalid (negative content times).
DONE 23 Oct night: Purchase detail §6 incl. order -> bill and returns entry
(report docs/performance/2026-10-23-purchase-detail.md; e2e/purchase-detail.mjs
118/118). Defaults awaiting owner: "Supplier gave money back" hidden; Cancel
order / Delete draft in the action row, not a ⋯ menu.
DONE 24 Oct: Items list on a phone §8.1 (report
docs/performance/2026-10-24-items-phone-register.md; cards 69%). OPEN: list
open at 4x CPU slower (round 1 heavy, both sizes). Deviations awaiting owner:
no kind disc and no category on the phone card.
1. Rest of Stock: item detail §8.2 (Adjust stock on the page), item form §8.3,
   adjustment §8.4, low stock/summary §8.7 (Order from a low row), masters and
   price lists; then Payments, Expenses, Reports; approved Home workflows LAST.

## LATEST CHECKPOINT —23 October2026 (owner requested commit/push)

This section supersedes stale Next/current-handoff statements below/elsewhere.
Continue the existing revamp on dev; do not start a new plan. Read AGENTS.md,
CLAUDE.md, revamp README/12/02,09 §1, DESIGN-SYSTEM and counter-mode.html.
Preserve untracked ims-platform/; never reset or blindly stage it.

CURRENT WORK IS IN PROGRESS, NOT FINAL ACCEPTANCE. Parent delivered commit is
477916b1. The owner explicitly requested committing this unfinished checkpoint.
No final new rating, all-module completion or deployment claim is justified.

R-DEC-33 is strict across previously verified screens too: desktop tables with
bounded row scrolling and visible pagination; mobile joined cards with loading
next batches on scroll and manual retry/fallback, no desktop page arrows.
Sentinel belongs INSIDE the card scroll region, not pinned where it fetches
all pages. Preserve position, deduplicate IDs, reset on filter/context changes,
retain cards on failed append.32px chip face/44px mobile targets. Compact title
and New in header, one list search+Filters row, useful chips, concise summary.
No duplicate full-width search: global Shop search is a44px icon on lists.
Home has no list search, so its approved prominent Find or start field remains.
Dashboard/forms/settings follow their own approved composition, not a table.
Owner supplied21Oct22:41 mobile Customers and Bills/printing screenshots as
reference. Live Claude artifact has not been freshly inspected in this piece.

IMPLEMENTED IN THIS CHECKPOINT
- Estimates/Orders/Challans/Credit Notes share the approved compact register,
  visible status chips and server totals. Mobile append Redux mode uses existing
  paging APIs; latest request/kind/filter fences; render-time stale-source guard.
- Shared grid afterRows slot keeps load-next inside scrolling cards; UbLoadMore
  has optional automatic/repeatWhileVisible controls and44px manual fallback.
  Identity merge helper reused in existing party reducer (behavior preserved).
- Compact mobile global search; Home command field retained. Shared filter
  button40px matches search, with44px mobile hit area; explicit small filters
  remain32px. Active chip reveals horizontally without vertical page scrolling.
- Challans no longer show Open credit. Credit-note All renamed Recorded because
  server All intentionally excludes draft/void; empty recorded view offers Show
  drafts when source counts say drafts exist. No generic New return.
- Latest1024 fix: use existing min-width1280 media query, NOT grid full tier
  (full begins1024), join date into identity below1280; wide date stays separate.
  Wrap long document references and titles. This latest fix still needs LOOK.

VERIFICATION — DO NOT OVERSTATE
- Before latest compact-breakpoint changes,421 suites/4,663 frontend tests passed,
  full build/types/lint/locales/contrast and corrected bundle gate passed.
-75 selected backend sales tests passed (6 deprecation warnings). No backend
  source/schema/API/financial calculation changes.104 local draft API fixtures
  (26/kind) were created for real paging, never issued/paid. Local QA only.
- The full four-kind sweep had Orders green, other English runs red at1024:
  Estimates/Credit Notes dates clipped; Challan first-use title clipped. Hindi
  runs passed. These failures are not final green. Fixes are now implemented;
  repeat the exact sweep after latest build/restart. The current focused test
  group and latest production build pass; exact checkpoint gates in report.
- Earlier phone probe:56px shell header,44px global icon, exactly one list
  search, cards62% of usable844px viewport;25→26 source-backed append, manual
  failure retry, no automatic retry loop, query reset. Recheck after final build.
- Initial static-asset500/login failures were serving setup: rebuilding deletes
  standalone copied static/public; always restart and recopy AFTER each build.
- No final performance A/B for this piece, final all-frame LOOK or final rating.
  Do not reuse477916b1 performance numbers as if they measured current code.

IMMEDIATE NEXT
1. Finish exact-current full gates sequentially (Jest before build), then restart
   task frontend with copied static/public and verify a real JS asset200.
2. e2e/revamp-bills.mjs now supports --kind=estimate|sales_order|delivery_challan|
   credit_note, --locale, --widths, --themes. Use390/320/1024/1280 light/dark and
   Hindi320/1280. Reused source-backed data with explicit synthetic UI states.
   Credit-note draft fixture path uses tab=draft; server Recorded is unchanged.
3. e2e/mobile-sales-contract.mjs: actual append failure/retry, query reset,
   no eager page2, one search,40px toolbar match, active-chip visible, cards
   >=60% usable normal phone viewport, desktop table/pager. --kinds/--widths
   supported. Run all4 kinds/phone+desktop; fix real failures before rating.
4. LOOK native frames/contact sheets, measure own-text bounds/contrast/hit tests.
   Short600px with network banner is a separate stress case, not60% guarantee.
5. Quiet same-machine old/new/old/new perf using e2e/perf-app.mjs --reps=3
   --only=nav --cases=shop.bills→estimates,shop.bills→orders,
   shop.bills→challans,shop.bills→credit-notes. Parent477916b1 build is in chat
   artifacts/mobile-cards-2026-10-22/baseline if still available; otherwise
   create a clean baseline and cp -al node_modules, not a symlink.
6. Update dated report,07 tracking,11 matrix,12 Next and BOTH prompts; commit
   verified result, pushdev, verify remote SHA, report final screenshots/numbers.
7. R-DEC-33 mobile follow-up is still PENDING for Bills, Customers, Suppliers,
   Purchases and other lists. Shared primitives existing does not migrate them.
   Verify Home after shared shell changes against its approved reference.
   Continue each list group, then purchase detail/order conversion/returns and
   remaining source modules under R-DEC-27; approved remaining Home workflows LAST.

Boundaries: separate user/business/app/book/role access, no phone-number-based
access or automatic netting, internal costs never customer-facing, editable
outgoing messages/no autosend, weighted-average supplier-return stock cost,
original bill credit amount. Library/Lending financial contracts frozen.
No package/new engine; DS reuse, no raw feature JSX, lazy overlays. Use electrical
examples and Radhe Krishna Enterprises. Ratings provisional and scoped; no
competitor superiority or physical/PWA/hardware/research claim without evidence.
No production/Railway writes. Commit attribution: Assisted-by: OpenAI Codex.

Exact23Oct checkpoint verification: changed-file lint0, type-check0,7 focused suites/84 tests pass (3.864s); latest production build passed. Full final browser/LOOK/A-B remains pending.

# Portable start prompt for the YourKhata revamp

Give the block below to any coding agent (Codex, Cursor, Claude Code, Copilot, Windsurf, or a person) with this repository checked out. It is written so every tool continues the work in the same way and to the same standard. Paths are relative to the repository root. Tools and permissions differ between agents; the rules, order of work, document formats and evidence standards do not.

Replace the line marked `TASK` with what you want done next. If you leave it out, the agent does the next item in `docs/revamp/12-decision-log.md` → "Next".

## Current handoff · 21 October 2026

R-DEC-32: CLAUDE.md's mandatory revamp acceptance gates are strict. Verify explicit reference/component values before coding; final LOOK and measured evidence are required. Never make the owner catch documented deviations.

Read START-NEXT-SESSION-PROMPT.txt and12's current Next first. R-DEC-27 orders
billing/purchases/returns, then inventory/money/expenses/reports, then Home.
Purchase editor §7 and register §5 are delivered. Register evidence:
docs/performance/2026-10-21-p5-purchase-register.md —416 suites/4,647 tests,
80 backend checks,240 final measured frames/hit tests and same-machine serial
A/B. Read its final rating/limits, not historical scoped editor scores.
Register design8.75, lowest aspect8.6; throttled pooled content538.5ms phone /837ms desktop (+9/+10ms vs baseline), feedback≤12/28ms. No speedup claim.
Next: R-DEC-31 viewport rollout, starting with existing Shop Customers/Suppliers/Bills; see11's matrix. Only Purchases is currently implemented. Then resume purchase detail §6/order conversion/returns under R-DEC-27.
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

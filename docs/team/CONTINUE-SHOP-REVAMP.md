# Continue the YourKhata Shop revamp (paste this into a new Claude session)

You are continuing the **YourKhata Shop revamp**, one piece at a time, to the
owner's P0 standard. Another Claude session did Part A (A1–A8) and stopped
here. Continue exactly as it worked: the same standard, the same tools, the
same honesty. Read this whole file before doing anything.

## 0. Where the work is

- **Repo / worktree:** `/Users/akashkushwaha/Projects/ims-platform/ims-platform/proceed-222204`.
  Branch **`shop/a2`**, pushed to the remote branch **`dev`**.
- **Push:** `git push origin shop/a2:dev` (if your shell needs it, allow
  `github.com`). Then verify that `git ls-remote origin dev` equals
  `git rev-parse HEAD`.
- **Never** push `main`. Never ask for, enter or handle GitHub credentials.
- **One worktree, step by step. No parallel sessions or sub-agent swarms**
  (owner, 27 Oct: usage limits).
- **Last commit:** `ceb9b7b10`, A8. Check with `git log --oneline -8`.
- **Leave these six files UNCOMMITTED.** They hold older formatting-only changes:
  - `frontend/src/modules/DigiKhaato/features/sales/components/DocumentActions.tsx`
  - `.../FlowColumns.tsx`
  - `.../FlowColumns.test.tsx`
  - `.../InvoiceDetailPageContent.tsx`
  - `.../InvoiceDetailPageContent.test.tsx`
  - `.../SalesFlowListPageContent.test.tsx`

  If you must change one of them, stage ONLY your hunk:
  1. take `git show HEAD:<file>`;
  2. apply your edit to that text in a temp file;
  3. run `git hash-object -w <tmp>`;
  4. run `git update-index --cacheinfo 100644,<sha>,<path>`.

  Run this inside the sandbox: `$TMPDIR` differs when the sandbox is off.

## 1. Read first (binding, in this order)

1. `CLAUDE.md`, all of it. These are the owner's rules:
   - R-DEC-32 gates 1–13;
   - pixel-exact against the design;
   - plain words;
   - DEC-019 (each app keeps only its own money);
   - no new dependencies;
   - design-system components only, with no raw `div`/`span` in features;
   - commit messages are prose "why", ending with
     `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
2. `docs/testing/P0-testing-standard.md`: §8 score sheet, §9 module round,
   §10 feature-by-feature delivery, §11 go-live gate.
3. `docs/testing/tester-learning-log.md`: habits H1–H30. **Every habit applies
   to every piece. After each piece, add a lesson and the check that enforces it.**
4. `docs/testing/edge-case-catalogue.md` (E1–E27).
5. The approved design:
   - live at https://claude.ai/artifact/RsYjPpq2t3zCTMu5iUSvNm;
   - copy at `docs/revamp/design/shop-fixes-and-business-types.html`.

   Each piece starts from its section. Its mocks are JS functions:
   `grep -n "^M\.<mockName>"`, and the CSS lives in the same file.
6. `docs/revamp/12-decision-log.md` (to R-DEC-62) and `docs/team/SHOP-PARALLEL-WORK.md`
   (state of every piece). Keep the latter current after every step.
7. The piece reports in `docs/performance/2026-10-2*-shop-a*.md`. Copy their
   structure.

## 2. State

| Piece | Status |
|---|---|
| A1–A3 | built earlier |
| A4 Adding items | 9.0, waiting for the owner's check |
| A5 Drawer spacing | 9.0, waiting |
| A6 Customer/supplier forms (R-DEC-61; Shop-book old balance) | 9.0, waiting |
| A7 Tables + count line (`UbCountLine`; "owe" replaced app-wide, R-DEC-62) | 9.0, waiting |
| A8 First tap (loading shapes for 122 lazy overlays; remount after a feature reset; slow-load note) | 9.0, waiting |

**Next, in the owner's order:**
- **Part B:** B1 Pick what you sell, B2 Menus and words per business, B3 Shop
  features in Settings, B4 Ask once.
- **Part C:** scanning, C1–C3.
- **Part D:** new fields, D1–D14.
- **Part F:** every other Shop screen. This includes the register layout from
  the A7 mock (search inside the frame, the design's columns) and the other
  registers' count lines with `UbCountLine`.
- **Part E:** review.
- **Then:** the §9 module round and the §11 go-live gate.

**Open, listed in the reports:**
- the React #418 mismatch, seen once (Suppliers seed 123 @390 during a
  concurrent probe), not reproduced;
- the header search drawer still lazy-loads with no shape (A1);
- 5 backend test failures that predate A6:
  - three personal-Udhaar architecture/export checks;
  - an empty `apps/.claude` tool folder;
  - the Dues timing test;
- the A7 mock-layout conflicts, for Part F;
- the stale harnesses `defects2-qa` and `sprint3-qa`.

## 3. The standard for EVERY piece (do not skip a step)

1. **Before coding:**
   - write the spec-to-check table from the design's own CSS and words, into a
     new `docs/performance/<date>-shop-<piece>.md`;
   - write the harness;
   - measure a **baseline** on the live app (`--tag=before`).
2. **Build** to the design. Reuse the existing components, hooks and engines.
   - Conflicts with earlier owner rules are LISTED in the report, never chosen
     silently.
   - Backend or contract changes need the owner's approval, unless the owner
     already said what to do.
3. **A fix needs a test that fails before it.** Prove it by reverting the file
   or running the old build.
4. **LOOK at screenshots yourself**:
   - phone 390 and 320, desktop 1280, **and 1024** (H28);
   - light and dark, English and Hindi;
   - the empty, loading, error, long-text and no-match states;
   - side by side with the mock, using `e2e/design-compare.mjs --piece=<p>
     --shots=<dir> --pairs='mock:shot.png,…'`.
5. **Read back every figure from the API**, with a `--skew` self-test that must
   fail (H17, H27: pin the exact value, not a pattern).
6. **Behaviour:** double taps, fast switching, slow network, reload, typing
   while loading, first tap in a cold browser with code downloads held back (H30).
7. **Monkey:** `e2e/monkey.mjs --path=/<screen> --seed=N --steps=250
   --width=390|1280`, 3 seeds × 2 sizes. A failure is replayed alone before it
   is called real.
8. **Hand-driven pass** in the browser pane (`mcp__Claude_Browser__*`) at phone
   and desktop sizes, with the QA login.
9. **§10 regression** of every delivered piece's harness:
   - `a3-customer-box-look`, `a3-functional`;
   - `a4-money`, `a4-remove-undo`, `a4-functional`, `a4-edges --width=390` and `--width=1280`;
   - `a5-measure`, `a6-forms`, `a7-measure`, `a8-first-tap`.
10. **Unit gates:** `npx tsc --noEmit`, `npx eslint src`, the touched features'
    jest (`npx jest <dir> --silent`; run the whole suite in batches by folder if
    disk or time is short), `npm run i18n:split && npm run i18n:check`,
    `npm run bundle:check`. A budget raise is measured + 0.3, with a dated note
    saying what bought it.
11. **Score honestly** on §8. The last point is the owner's. Below 9 the piece
    is "in test".
12. **Finish:** update the report, the learning log (a new H-number with its
    enforcing check), the decision log (owner decisions) and
    `SHOP-PARALLEL-WORK.md`; then commit, push and verify the remote SHA.

## 4. Tools and how to run things (the exact technique that worked)

- **API** (on :8000, only if it's down):
  `PATH=/Users/akashkushwaha/Projects/ims-platform/backend/.venv/bin:$PATH ./e2e/serve-api.sh`.
  Its log is `/tmp/claude-0/be-run.log`.
  - Restart it after backend changes.
  - Migrate with `PATH=…/.venv/bin:$PATH python manage.py migrate` in `backend/`.
- **Frontend build** must run in the user's terminal tab: inside the sandbox,
  Turbopack can't bind its port. Reuse the existing tab (`c4`) with
  `mcp__terminal__run_in_terminal` (one line):
  `cd …/frontend && API_PROXY_TARGET=http://localhost:8000 NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1 npm run build > /tmp/claude/fe-build.log 2>&1; echo BUILD_EXIT $?; cd .. && PORT=3005 API_PROXY_TARGET=http://localhost:8000 ./e2e/serve.sh; echo SERVE_DONE`.
  Then wait with `mcp__terminal__read_terminal` (`wait_for_output_ms` up to 290000).
  - **Port 3000 is now used by another of the owner's apps ("Dossier"), so use
    3005** and set `E2E_BASE=http://localhost:3005` for every harness.
  - The API's CORS already allows 3005.
- **Harnesses** run with the sandbox OFF (`dangerouslyDisableSandbox: true`):
  ```
  export E2E_BASE=http://localhost:3005 PW_CHROME=~/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell
  ```
  Screenshots go to `/tmp/e2e-shots/<piece>/`; read them with the Read tool.
- **QA sign-in:** the local seeded QA tenant, test values only, at
  `/login/email`, with `scale@digikhaato.test` / `Scale-Run-2026!`.
  - Sign-ins have a per-IP budget of 20 per window; don't burst logins.
  - Count by your own record ids, never by shop-wide totals: harnesses share
    this shop.
  - Pick test items by a proven property (priced, stocked, not named
    "A5 item…"/"Edge…"/"A6…"), never by position (H25).
- **Backend tests:** in `backend/`, run
  `PATH=…/.venv/bin:$PATH python -m pytest -q -p no:warnings <paths>`, with the
  sandbox off.
- **Long runs** go in the background (`run_in_background: true`); wait for the
  notification. Don't run jest or builds at the same time as monkeys or
  timing-sensitive harnesses, which then fail on time-outs.
- **zsh:** a variable list needs `${=VAR}` to split. Use python for multi-line
  edits.
- **The disk is nearly full** (~300 MB free). Delete only your own temp files,
  never the owner's. Prefer `--silent` jest batches.
- **Task list / wrap-up:** `mcp__ccd_turn__update_plan` with the first tool call
  of each turn; `mcp__ccd_turn__wrap_up` at the end of a turn.

## 5. Owner rules worth repeating

- Design words exactly (R-DEC-54), **but no "owe"**: use To collect / To pay,
  You will get / You will give, I will get / I will give, still to pay
  (R-DEC-62).
- The Udhaar book is an independent app. Never mix app money (DEC-019).
- A screen with no mock is designed from the artifact's own references, as in A6
  edit (R-DEC-61).
- Rural shopkeepers: simple words, a busy counter, name + mobile first.
- Never call something done before the owner checks it. Report what failed,
  what wasn't proven, and why.

**Start:** read the files in §1, run `git status` and `git log`, then continue
**Part B · B1 (Pick what you sell)**. Its spec table is already written in
`docs/performance/2026-10-28-shop-b1-pick-what-you-sell.md`, so start at that
report's "Next steps": read the mock source, write `e2e/b1-pick.mjs`, and
measure the baseline. Nothing for B1 is built yet.

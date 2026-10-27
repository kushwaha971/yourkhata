# Shop work in parallel — who does what, and how anyone resumes it (P0)

The owner, 27 Oct 2026: several sessions work on the Shop at once, as one team,
to one standard. If any of them stops, **anyone (another session, another AI
tool, or a person) must be able to continue the same task, in the same
worktree, from where it stopped**, using only this file and the repo.

**Every session keeps its own section below current**: after every finished
step, update its status, last commit and next step, and commit the change on
its branch. A section that lags the code is a defect.

---

## How to resume any task (for whoever picks it up)

1. Open the task's **worktree** (path below) and check out its **branch**.
2. Read, in this order:
   - `CLAUDE.md`;
   - `docs/testing/P0-testing-standard.md`;
   - `docs/testing/tester-learning-log.md`;
   - `docs/testing/edge-case-catalogue.md`;
   - the task's design section in `docs/revamp/design/shop-fixes-and-business-types.html`;
   - the task's report (path below), which says what is done, measured and missing.
3. Run `git log --oneline -15` and `git status`. Trust the code and the
   report over this file if they disagree, then fix this file.
4. Bring up the stack the way §"The local stack" says, on the task's **own
   port**.
5. Continue from the section's **Next step**. Do not redo finished steps
   (CLAUDE.md: re-fixing is worse than not touching).
6. Follow the same standard: nothing is done below 9/10 on the score sheet,
   and the status stays "in test" until then. Write a lesson in the
   learning log after the task.
7. Keep the team rules below.

## The local stack (shared by every task)

- **API: one, shared, on :8000.** Start it with
  `PATH=<repo>/backend/.venv/bin:$PATH ./e2e/serve-api.sh`, and only if it is
  down. Restarting it interrupts every other task's tests.
- **Frontend: one per task, on the task's own port.** Build in the task's
  worktree with
  `API_PROXY_TARGET=http://localhost:8000 NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1 npm run build`,
  then `PORT=<port> ./e2e/serve.sh`. `next start` cannot serve this build.
- **Harnesses:** run them with `E2E_BASE=http://localhost:<port>` and
  `PW_CHROME=~/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell`.
- **QA sign-in:** `/login/email`, scale@digikhaato.test (from `seed_scale`;
  re-seed with `manage.py seed_scale --entries 6000 --parties 300 --items 400 --invoices 800`
  if the business is missing).
- **Many tasks write to the one QA shop.** Count by your own record ids, or by
  a filter proven to filter, never by shop-wide totals (H3, H17).

## Team rules

1. **Ownership:** only a file's owner edits it; anyone else messages the
   owner the exact change it needs.
2. **Ask before creating anything shared** (a component, util, token or
   harness helper): "I am adding X in <file> for <reason>; does anyone have
   it?" If someone does, reuse theirs: cherry-pick their commit.
3. **Share what others can use:** message the team its file and commit.
4. **Branches are not merged by a task.** Main (A4) merges them into `dev`
   when each is ready, and resolves overlaps in the shared docs. Keep your
   edits to your own rows and sections there.
5. **Never push** from a task branch; main pushes `dev`.
6. **One standard:** the P0 testing standard, the score sheet with evidence,
   and the habits and cases. Report honestly.

## Ownership

| Owner | Files |
|---|---|
| A4 / main | sales bill editor (`features/sales/components/Invoice*Editor*`, `InvoiceLine*`, `InvoiceLinesSection`, `InvoiceTotalsPanel`, `InvoiceBillAdjustments`, `hooks/useDraftAutosave`, `hooks/useInvoiceEditor`), `UbQuantityStepper`, `UbQuantityInput`, `UbSnackbar`, the bill prints |
| A5 | `UbDrawer`, `UbSheet`, `UbField` spacing, `PartyFormDrawer`, `ItemFormDrawer`, `PaymentFormDrawer`, `StockAdjustmentDrawer`; the harness port change (`E2E_BASE`, `PORT` in `serve.sh`) |
| A7 | the register tables and lists, the data grid, the count line, the pager |
| A8 | route loading, suspense fallbacks, `UbAppShell`, route layouts |

---

## A4 · Adding items to a bill — main session

- **Worktree:** `/Users/akashkushwaha/Projects/ims-platform/ims-platform/proceed-222204`
- **Branch:** `shop/a2` (pushes to `dev`)
- **Port:** 3000
- **Report:** `docs/performance/2026-10-27-shop-a4-adding-items.md`
- **Status:** in test, 8.5/10
- **Last commit:** see `git log` on `shop/a2`; pushed to `dev`
- **Next step:**
  1. Run the six monkey runs on the final build (seeds 501, 4401 and 7713 ×
     390 and 1280). If all pass, the score is 9.0, and the status becomes
     "ready for the owner's check".
- **Waiting on the owner:** the desktop header's Hold / Save draft (Counter
  Mode) against dBill.

## A5 · Spacing inside drawers and sheets

- **Worktree:** `/Users/akashkushwaha/Projects/ims-platform/ims-platform/shop-a5-d647aa`
- **Branch:** `claude/shop-a5-d647aa`
- **Port:** 3001
- **Report:** `docs/performance/2026-10-27-shop-a5-drawer-spacing.md`
- **Status:** stopped by the owner on 27 Oct 2026, after one commit. Main
  continues A5 here, one piece at a time.
- **Last commit:** cf10ff099 — the harness port change: `E2E_BASE` in all 148
  harnesses, and `serve.sh` takes `PORT` without killing other servers.
  Known gap: `sprint3-qa` F3 still asserts host `localhost:3000`.
- **Next step:**
  1. (Done in cf10ff099; bring it in with a cherry-pick.)
  2. The spec-to-check mapping.
  3. `e2e/a5-edges.mjs`.
  4. Then build.

## A7 · Tables and the count line

- **Worktree:** `/Users/akashkushwaha/Projects/ims-platform/ims-platform/shop-a7-e986b8`
- **Branch:** `claude/shop-a7-e986b8`
- **Port:** 3002
- **Report:** `docs/performance/2026-10-27-shop-a7-tables-count.md`
- **Status:** stopped by the owner on 27 Oct 2026 before any commit; main
  continues it after A5.
- **Last commit:** — (the branch is at 17e99ec88)
- **Next step:**
  1. Cherry-pick cf10ff099 (A5's port commit).
  2. Measure what is built against the A7 design.
  3. The spec-to-check mapping and `e2e/a7-edges.mjs`.

## A8 · The page goes blank on the first tap

- **Worktree:** `/Users/akashkushwaha/Projects/ims-platform/ims-platform/shop-a8-26fdf0`
- **Branch:** `claude/shop-a8-26fdf0`
- **Port:** 3003
- **Report:** `docs/performance/2026-10-27-shop-a8-first-tap.md`
- **Status:** stopped by the owner on 27 Oct 2026 before any commit; main
  continues it after A5.
- **Last commit:** — (the branch is at 17e99ec88)
- **Next step:**
  1. Cherry-pick cf10ff099 (A5's port commit).
  2. Reproduce the blank page (cold, slow network, every Shop menu tap).
  3. The spec-to-check mapping and `e2e/a8-edges.mjs`.

## Waiting to start

- **A6 · Separate customer and supplier forms.** Starts after A5 is in,
  because it rebuilds the same contact drawer.
- **Then,** in the owner's order: Part F, Parts B/C/D, and the module round
  for the whole Shop (P0 standard §9).

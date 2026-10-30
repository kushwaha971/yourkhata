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
- **Status:** ready for the owner's check, 9.0/10 (27 Oct 2026)
- **Last commit:** see `git log` on `shop/a2`; pushed to `dev`
- **Next step:**
  1. The owner tries A4. Anything found is fixed the same day and the
     standard is changed to catch its class.
  2. Meanwhile: A5 here (spec list written in
     `docs/performance/2026-10-28-shop-a5-drawer-spacing.md`).
- **Waiting on the owner:** the desktop header's Hold / Save draft (Counter
  Mode) against dBill.

## A5 · Spacing inside drawers and sheets

- **Worktree:** `/Users/akashkushwaha/Projects/ims-platform/ims-platform/shop-a5-d647aa`
- **Branch:** `claude/shop-a5-d647aa`
- **Port:** 3001
- **Report:** `docs/performance/2026-10-27-shop-a5-drawer-spacing.md`
- **Status:** ready for the owner's check, 9.0/10 (27 Oct 2026), built here
  in the main worktree; the A5 branch only gave its port commit.
- **Last commit:** cf10ff099 — the harness port change: `E2E_BASE` in all 148
  harnesses, and `serve.sh` takes `PORT` without killing other servers.
  Known gap: `sprint3-qa` F3 still asserts host `localhost:3000`.
- **Next step:**
  1. (Done in cf10ff099; bring it in with a cherry-pick.)
  2. The spec-to-check mapping.
  3. `e2e/a5-edges.mjs`.
  4. Then build.

## A7 · Tables and the count line

- **Worktree:** main (`proceed-222204`), branch `shop/a2`.
- **Report:** `docs/performance/2026-10-28-shop-a7-tables-count.md`; harness `e2e/a7-measure.mjs`.
- **Status:** ready for the owner's check (28 Oct 2026); built in the main worktree.
- **Built:**
  - the register frame (`REGISTER_*`) on all seven Shop registers;
  - `UbCountLine` and the Customers/Suppliers count line;
  - "owe" replaced with simple words app-wide (R-DEC-62);
  - fixes at 1024: the bill's customer box, the Hindi Pay button, phone numbers.
- **Next:** Part F registers' count lines use `UbCountLine`; the mock-layout conflicts listed in the report.

## A8 · The page goes blank on the first tap

- **Worktree:** main (`proceed-222204`), branch `shop/a2`.
- **Report:** `docs/performance/2026-10-28-shop-a8-first-tap.md`; harness `e2e/a8-first-tap.mjs`.
- **Status:** ready for the owner's check (28 Oct 2026).
- **Built:**
  - loading shapes for 97 lazy overlays, with a guard test;
  - the slow-load note with Try again;
  - the page remounts after a feature reset, which fixes a list that never
    loaded when opened from another app.
- **Next:** Part B (B1 Pick what you sell).

## B1 · Pick what you sell — main session

- **Worktree:** main (`proceed-222204`), branch `shop/a2`.
- **Report:** `docs/performance/2026-10-28-shop-b1-pick-what-you-sell.md`;
  harnesses `e2e/b1-pick.mjs` (look, 124 checks) and `e2e/b1-signup.mjs`
  (real sign-up read back, 10 checks, `--skew` fails all 10).
- **Status:** ready for the owner's check (30 Oct 2026). Owner decisions
  R-DEC-63 (kinds are stored types), R-DEC-64 (one business = one kind;
  Wholesale = kind + `shop.wholesale`, "Wholesale of what?" below), R-DEC-65
  (P0: each kind its own app, modular schema).
- **Open:** "What do you sell?" is still a section of wizard step 1 (the design
  has its own step; owner not asked to change it); a resumed wizard does not
  re-light the Wholesale tile; the B2/B3 matrix
  (https://claude.ai/artifact/XnDfhJoNkDUXZoNSKmfFLb) waits for approval.
- **Next:** B2, after the owner approves the matrix and the design thread's
  additions.

## B2 · Menus and words per business — main session

- **Report:** `docs/performance/2026-10-30-shop-b2-menus-and-words.md`;
  harnesses `e2e/b2-menus.mjs` (61), `e2e/b2-edges.mjs` (9); fixture
  `e2e/fixtures/b2_kind_owners.py` (one test owner per kind).
- **Status:** ready for the owner's check (30 Oct 2026).
- **Next:** B3 Shop features in Settings.

## What the stopped sessions found (27 Oct 2026, before the owner stopped them)

The owner stopped the parallel sessions to save usage. Three sessions working
at once spend it three times as fast, and each would stop mid-task at the
limit. Their findings so far, to verify (not trust) when the piece is worked:

- **A8:** the cause may already be fixed in commit 59a1eb9f8 (25 Oct, from
  the backlog branch, in this history). A `dynamic()` drawer with neither
  `ssr: false` nor a `loading` view waits on its first download at the route's
  `loading.tsx`, which swaps the page for the skeleton. Next: reproduce on the
  live app to prove the fix holds, or find what is left.
- **A8, from A6 (28 Oct):** two cases to start from.
  - `/suppliers` seed 64 @320 reproduces a ~7.9 s "return" every time:
    DOM-ready at 25 ms, then main content late, with `GET /parties/roles` still
    open. Replay: `node e2e/monkey.mjs --path=/suppliers --seed=64 --steps=250 --width=320`.
  - The first "+" on a phone took 1–3 s to show the form under load.
- **A8, from A4's monkey:** once, under load, the bill editor sat on its
  skeleton for minutes (seed 501 at 390, step 193; not reproduced on a quiet
  replay). A8 must test a stalled network on purpose: a skeleton must time out
  into a message with a way to retry, never wait for ever.
- **A7:** items 1 and 2 (the table frame clips the grey header to its rounded
  corners; the pager drops its own top line) are in the code from 59a1eb9, but
  not yet measured on the live app. **Item 3, the count line, is not built.**
- **A5:** made only the harness port commit cf10ff099.

**Lesson (main):** a message queued to a stopped session wakes it when it is
idle, so do not message sessions the owner has stopped.

## Waiting to start

- **A6 · Separate customer and supplier forms — READY FOR THE OWNER'S CHECK,
  9.0/10 (28 Oct 2026), main worktree.** Report:
  `docs/performance/2026-10-28-shop-a6-customer-supplier-forms.md`; harness
  `e2e/a6-forms.mjs`. Built to R-DEC-61:
  - a name and a number at the counter;
  - pick an existing contact instead of a role switch;
  - the Shop's own old balance (backend `ledger 0010`).
  Open, outside A6: the A8 slow returns (seeds 64, 93); "owe" words on the
  lists and the payment header; 5 backend failures predating A6.
- **Then,** in the owner's order: Part F, Parts B/C/D, and the module round
  for the whole Shop (P0 standard §9).

# Continue YourKhata: finish the A–D certification, then wait for the owner (paste into a new Claude session)

You are continuing the **YourKhata Shop revamp**. Parts A, B, C and D are
built. The owner (Akash) asked for a full **A–D certification** before Part G,
and said: *"once all these complete then push the latest fixes and wait for my
instruction to start G"*. **Do not start Part G until the owner says so in
words.** Read this whole file, then `CLAUDE.md`,
`docs/testing/P0-testing-standard.md` and `docs/testing/tester-learning-log.md`.

## 0. Where the work is (1 Nov 2026)

- **Worktree:** `/Users/akashkushwaha/Projects/ims-platform/ims-platform/proceed-222204`,
  branch **`shop/a2`**. The owner reads **`dev`**: push with
  `git push origin HEAD:dev` and `git push origin HEAD` (both), then check
  `git ls-remote origin dev` equals `git rev-parse HEAD`. Never push `main`.
- **Last commit when this was written:** `03a35a070` (on both `dev` and
  `shop/a2`). Check `git log --oneline -20`.
- One worktree, one piece at a time, no sub-agent swarms (owner, 27 Oct).
- Commit messages explain *why* in prose; end with the Co-Authored-By line.

## 1. Running the stack and the tests

```bash
# API (Django, port 8000) — needs the venv on PATH
export PATH=/Users/akashkushwaha/Projects/ims-platform/backend/.venv/bin:$PATH
bash e2e/serve-api.sh
# Frontend: build with these env vars, then serve the standalone build on 3005
cd frontend && NEXT_PUBLIC_API_BASE_URL=/api/v1 API_PROXY_TARGET=http://localhost:8000 npm run build
PORT=3005 bash ../e2e/serve.sh
# Harness env
export PW_CHROME=~/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell
export E2E_BASE=http://localhost:3005
# QA people and businesses (idempotent): run once
cd backend && python manage.py shell < ../e2e/fixtures/ad_cert_people.py
```

Lessons that cost time: **never rebuild or restart the API while a harness or
monkey is running** (chunks vanish → false 500s/MIME errors); restart the API
after any backend change (`serve-api.sh` runs `--noreload`); a sign-in uses
`/login/email`; the frontend gates are `npm run type-check/lint/test`,
`npm run bundle:check` (raise an over-budget route to measured + 0.3 with a
note in `bundle-budgets.json` `//routes`), `npm run i18n:split && npm run i18n:check`.

## 2. What the certification has done (all live, read back from the API)

- `e2e/ad-certify.mjs` **77/77** (`--skew` fails 3): Owner/Admin/Staff/
  Accountant in QA Kirana by API, sidebar and typed URL; qa-mixed is Staff in
  QA Kirana and Owner of QA Mobile, switching both ways; QA Medical's item,
  customer and bill are 404 and absent from QA Kirana; a member cannot switch
  into a business they are not in; a role change applies on the next request
  (the app refreshes the token on 401), in one business only; a stale tab is
  refused (409) instead of writing into another business; a signed-out write
  is refused.
- `e2e/ad-onboard.mjs` **34/34**: one person adds a business of 8 kinds;
  each one's features, words and menu read back; switching keeps each context.
- Full Shop regression `e2e/b-regression.sh` (now 37 harnesses, incl.
  ad-certify and ad-onboard): all pass except a7-measure, which failed only
  on the 1st of a month (empty Expenses register) and is fixed in the harness.
- D: 48 monkey runs on 8 D screens pass; d-look 300/300; d-edges 10/10.

**Defects found and fixed in this certification** (all committed and pushed):
1. HIGH — no way on screen to make a batch- or IMEI-tracked item. Built the
   design's "Medicine details" / "Phone details" groups
   (`ItemTrackingFields.tsx`); a tracked item hides Opening stock.
2. MEDIUM — medical/mobile/clothes did not get batches/serials/variants;
   Expiry and Find by IMEI were in every business's menu. Presets fixed, new
   feature key `serials`, migration `platform 0022`, menu rows gated.
3. HIGH (D) — Return to distributor refused every medicine and phone; batches
   and IMEIs now leave on a debit note and come back on its void.
4. LOW — a returned phone now reads "Returned to supplier" with its debit note.

## 3. Status: certification FINISHED (1 Nov 2026)

The report is `docs/testing/ad-certification-report.md` — read it. Remaining
work is only what §6 of that report lists (stale harnesses to re-baseline,
the personal-Udhaar export risk for its own thread). **Wait for the owner's
explicit instruction before starting Part G.**

## 3a. (Historical) the steps that were still to do

1. **Finish the broad monkey sweep** — 12 areas × 2 seeds × 390/1280 with
   `node e2e/monkey.mjs --path=<p> --seed=<s> --steps=120 --width=<w>`.
   Done and passing: /dashboard, /sales/invoices/new, /sales/invoices,
   /purchases/bills/new, /parties, /items, /stock/summary (part). Still to run:
   /stock/summary, /payments, /expenses, /reports, /settings, /khata.
   Note: on a LIST page the monkey's "no reload/return ever happened with lines
   on the bill" is its bill-lines check not applying — not a product defect.
   Script: `/private/tmp/claude-501/.../scratchpad/certify-all.sh` (may be
   gone; rebuild the loop from this paragraph).
2. **Re-run the 8 older suites** (security, credentials, journey, parties,
   ledger, statement, tags, credit). They never ran before because they
   launched a missing browser; they now honour `PW_CHROME`. They predate the
   revamp: when one fails, decide **stale harness vs real defect** by looking
   at the screen and the API, fix the right one, and say which.
3. **Monkey as Staff and as Accountant**: `--login=qa-staff@adcert.test:AdCert-Test-2026!`
   and `qa-acct@…` on /dashboard, /sales/invoices/new, /items, /settings,
   /reports (refusals must be states on screen, never crashes or 5xx).
4. Fix what fails (root cause, a test that failed before the fix), re-run the
   affected harness and then `e2e/b-regression.sh`; push to `dev` and `shop/a2`.
5. **Write the testing report** as a Claude Doc (or `docs/testing/ad-certification-report.md`):
   scenarios with expected vs actual; passed / failed / blocked / excluded;
   bugs with severity and root cause; fixes and regression results; remaining
   risks; a readiness verdict for G. Give the owner the link and **wait**.

## 4. Exclusions (depend on later parts — list them in the report)

- Part G modules: jewellery (rate, weight billing, old gold, karigar), short
  book and same-salt substitutes, Schedule H, repairs, site/contractor dues,
  vehicle history, schemes, advance orders, loose-by-amount / phone orders.
- D15 messages needing those records (refill, repair ready, service due).
- Print columns Size and Part no., warranty / drug-licence footer lines.
- B3 settings switches for features (owner deferred them until after D).
- Part F (every other Shop screen per kind), H, I (other apps), E (review).

## 5. Known risks / open items (not fixed — say so in the report)

- `backend/apps/platform_app/tests/test_tenant_data.py` fails: the personal
  Udhaar `parties.PersonalBook` table is not registered for tenant export and
  deletion (from the personal-Udhaar work, outside A–D). Data-integrity risk:
  a business export/deletion would miss it.
- `tests/architecture/test_import_rules.py` has two failures from the same
  work (`parties/urls_personal.py` imports ledger; `personal_book.py` imports
  DRF) and a stray `.claude` folder under `backend/apps`.
- `python manage.py makemigrations --check` shows a pending
  `parties 0014` (opening_balance_direction) from that work.
- An estimate converted to a bill picks batches/IMEIs at conversion (by
  design); not separately soak-tested.

## 6. How to report to the owner

Plain short English, lead with the answer, no "Reference" ids. When a check
fails, say so with the number. Never call something tested that was not run.

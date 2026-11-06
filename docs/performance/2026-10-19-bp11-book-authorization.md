# BP-11 · Shared-engine book authorization

Owner approved the fix with “fix that backend gap as well”; R-DEC-15. Continues the revamp plan. Backend-only change: no frontend layout, financial posting, invoice pricing or Library/Lending calculation changes.

## What changed and why

The old resolver merged per-app codenames. A shared right such as `ledger.entry.read` could therefore authorize an unrelated book, and a writable Shop role could lend its write right to a read-only role in another app.

- Reuse the app registry, existing grant roles, overrides, module gating and token-version checks. `permissions_for_app` resolves the requested app's own role; `HasPermission` checks it before entering a handler or replaying idempotency data.
- Ledger list/detail/statement/summary/aging and CSV require the requested book. Direct entry IDs use the stored bucket; manual ledger posting requires main regardless of query parameters. Existing tenant scoping still runs.
- Shared contact identity remains reusable. Responses omit unauthorized financial fields, main summary/credit/opening data, and unsupported private metadata. A Shop list retains its own selected-role balance. Unauthorized balance/date/credit filters and exports cannot infer hidden values. Global shared-contact archive requires both core-book rights because its consequences span books.
- Payment lists and totals are scoped before pagination. Direct receipt, void, allocation and share actions check the stored payment. Explicit allocation targets require their actual bucket's right. Open-document reads validate bucket access.
- Held deposits and their deposit-bucket receipts use the owning module. Applying a deposit to another book also requires that book. Historical broad owner/legacy deposit access remains compatible.
- Reminder preview/create/history/send/mark/due use their own book or registered module source. Business-level sending-policy settings retain their existing settings permission; they do not expose financial records.

## Explicit empty grants and migration

Migration `platform/0019_membership_explicit_app_grants` adds one boolean, `app_grants_configured`, and marks memberships that already have grant rows. Managing grants or leaving an app records this state. An explicitly empty grant set means no app access, not “restore every permission from the old business role.” Grant changes still increment `permissions_version` and invalidate stale tokens.

Never-configured legacy memberships keep their documented business-role authorization, and owners keep authorized business-wide access. The migration does not transfer money, reassign ownership, or modify ledger/document rows. It cannot recover whether a previously empty membership was deliberately cleared before this flag existed; an owner must explicitly configure that legacy membership. Apply the migration before starting the updated API. Deploy and rollback need to keep code/schema in step; rolling back this security change restores the old exposure, so is not a recommended incident response.

## Verification

- Before-fix proof: 16 new denied-book regressions fail on the previous backend; two positive compatibility checks pass. Explicit-empty/deposit additions exercise the corrected implementation separately.
- **22 focused security regressions passed.** Includes direct entry/receipt IDs, filters/exports, cross-app read-only versus write grants, explicit-empty revocation through the management service, and module-owned deposits.
- **149 compatibility/query-budget tests passed** after fixing the initial extra query and preserving validation/module-disabled error precedence. No query budget was increased. Architecture, app-grant and module-role tests passed in the complete run. Black/isort checks passed on all 17 changed/new Python files; Django check has no issues and makemigrations --check reports no missing migrations. Ruff/mypy were not available and are not claimed.
- **Full backend run: 4,621 passed, 16 skipped, 1 failed in 470.79 seconds.** The sole failure was the unchanged Library 20,000-copy close wall-clock test: 5.4304 seconds against a 5-second ceiling. The exact test passed alone afterward (1 passed in 3.03 seconds total). The original complete run is not labelled wholly green. Existing deprecation/pagination warnings remain.
- **Live HTTP smoke: 7 checks passed** against the restarted API on localhost:8000 using disposable restricted users in revamp_20261018. Own-book summaries/contact projections return 200; the other book returns 403; revoking the last explicit app returns 403. No token or user credentials are committed. Sanitized evidence: data/2026-10-19-bp11-http-smoke.json and data/2026-10-19-bp11-verification.json.
- Frontend files were unchanged in this backend-only piece; no new visual score, frontend build or frontend-test rerun is claimed.

No customer messages, production writes or production migration ran. Tests use `test_revamp_bp09`; runtime smoke testing uses only isolated `revamp_20261018`. Public customer-share token semantics remain unchanged.

## Limits

This closes the demonstrated shared-engine app/book grant gap; it is not a penetration-test certificate for every endpoint. A record's owning app, not whichever page is selected, determines access. An authorized colleague in the same business may still read the records their role permits. This does not implement separate personal Udhaar ownership inside one shared tenant; that needs a deliberate ownership model, not a frontend filter or a ledger rewrite. The migration preserves never-configured legacy roles as documented.

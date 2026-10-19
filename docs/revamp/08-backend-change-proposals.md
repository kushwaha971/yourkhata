# 08 · Backend change proposals

Status: **BP-09 and BP-11 approved by the owner on 18 Oct 2026; BP-12 and BP-13 access-context corrections are approved on 19 Oct (R-DEC-18); other backend proposals remain unapproved unless separately recorded.**

The revamp is mainly UI, UX and frontend performance. A backend change is listed here only if the audit found a demonstrated need. Library and Lending contracts are fixed: proposals for them change no request, response, rule or table; they only make the same answer arrive faster or safer, and each still needs approval.

Every proposal has the same fields: why, what it touches, before vs after, risk, compatibility, data impact, tests, rollback.

## BP-01 · Lending "Today" runs one query per active loan

- **Why**: `GET /lending/today` computes `figures()` for every active loan in the book, unpaginated (`apps/lending/services/collections.py:423-424`). On a book with a few thousand loans this is the slowest screen a collector opens, every morning. Not yet measured: Phase 1 must time it on a seeded book before this proceeds.
- **Touches**: `GET /lending/today` only.
- **Before → after**: same response, byte for byte. Figures computed in one or two aggregate queries over `DuesDue` instead of per loan.
- **Risk**: medium; the figures are money and must match.
- **Compatibility**: no contract change.
- **Data**: none.
- **Tests**: figure parity test — old and new implementation over a fuzzed book must return identical JSON; a query-count budget in `tests/performance/`.
- **Rollback**: keep the old function behind a setting for one release; flip back.

## BP-02 · Lending loan list and reminders, one figures query per row

- **Why**: `GET /lending/loans` (`views/loans.py:46`, `services/loans.py:694`) and `GET /lending/reminders` (`messages.py:261-289`) run `figures()` per row.
- **Touches**: those two endpoints. Same shape as BP-01, same tests and rollback. Lower priority: they are paged (loans) or smaller.

## BP-03 · Library member list, 4–5 queries per row

- **Why**: `GET /library/members` builds `member_summary` per row (`services/members.py:141-160`, `:245`; `loans.py:161`). A 50-row page is 200+ queries.
- **Touches**: `GET /library/members` only. Same response.
- **Risk**: medium (dues and block reasons are shown to staff).
- **Tests**: response parity on a seeded library of 2,000 members; query budget.
- **Rollback**: as BP-01.

## BP-04 · Library overdue fines computed per loan

- **Why**: `fine_for` runs 2–3 queries per overdue loan on `GET /library/loans` and `/overdue` (`services/loans.py:183`, `:238`). Settings and closed days can be loaded once per request.
- **Touches**: those endpoints; same response. Low risk if parity-tested.

## BP-05 · Duplicate protection on money actions that have none

The client can and will lock buttons (05 §4). The server is the last guard. The audit found money-moving writes with no idempotency scope:

| Endpoint | Money? | Today | Proposal |
|---|---|---|---|
| `POST /library/members/{id}/deposit/receive` | yes | no key | add `@idempotent("library.deposit.receive")`, key optional (same as other scopes) |
| `POST /library/members/{id}/deposit/apply`, `/refund` | yes | no key | same pattern |
| `POST /library/charges/{id}/waive`, `/reverse` | yes | no key | same pattern |
| `POST /lending/loans/{id}/collections`, borrower collections | yes | key **optional** | keep optional on the server (old clients), make the new client always send one |
| `POST /lending/loans/{id}/write-off` | yes | amount must match | no change needed |
| `POST /lending/collections/{id}/void` | yes | safe by filter | no change needed |

- **Compatibility**: an optional key changes nothing for a client that doesn't send it, so old installed apps keep working. Library is frozen, so even this needs approval; the alternative is client-side locking only.
- **Risk**: low. **Data**: one row per keyed request in the existing idempotency table.
- **Tests**: same key + same body replays; same key + different body 409; no key behaves as today.
- **Rollback**: remove the decorator.

## BP-06 · Throttling on Library and Lending writes

- **Why**: no throttle class on Library (except reports) or Lending (`config/settings/base.py:196` has no default). A runaway client loop or repeated taps can hit write endpoints without limit.
- **Proposal**: deferred. Adding a throttle could refuse a legitimate busy counter; needs traffic data first. Recorded so it isn't lost.

## BP-07 · Landing for installed apps

- **Why**: the PWA opens `/dashboard` for everyone (A-05). The server already resolves a landing (`landing` in `auth/me`).
- **Proposal**: frontend only (`proxy.ts` and manifest `start_url`); **no backend change** if `landing` already returns the last app's home. Phase 1 verifies. Listed here only so the dependency is visible.

## Not proposed

- No change to any Library or Lending calculation, model, migration, or response field.
- No new notification types, no push (owner directive; NTF-04 needs ADR-024).
- No pagination change on Library/Lending lists (page-number paging is part of their contract); long lists are handled in the client (05 F8).

## BP-09 · Shop data needed by the approved Counter Mode screens

**Status: APPROVED, 18 Oct 2026 08:13 UTC (13:43 IST). Owner: "Approve BP-09 and complete the matching features".** This is a prerequisite for faithful functionality, not a replacement redesign plan. The owner clarified that the Claude artifact is the target for every revamp screen, rather than small changes to existing layouts. Reference: https://claude.ai/artifact/GCqwcB9AuZ5Yhqhu8xgobh, Customers and filters.

- **Why:** the current party list exposes a single signed `shop_balance` and generic `last_activity_at`; it cannot faithfully show separate customer/supplier amounts, bill-based days late, or the last Shop document. The current person-level reminder reads the Udhaar balance. These are TV-01, TV-02, TV-07 and P-08-03 already recorded in the Shop programme and screen specification.
- **Touches:** Shop-scoped reads in `backend/apps/parties` (selector/filter/serializer); the existing reminder preview/manual-send service and serializers; corresponding Shop frontend adapters. Exact service ownership must be confirmed against current source before editing. No Library/Lending endpoint, calculation, model or workflow changes.
- **Before → after:** add backward-compatible Shop-only fields for customer receivable/customer credit and supplier payable/supplier credit, oldest unpaid bill due date/days late, and last Shop activity date/type. Add supported late-bucket filters and oldest-overdue ordering to the existing Shop party list. Compose and log editable customer-level reminders from current Shop amounts, with an explicit Shop book context; absent context keeps existing Udhaar behaviour.
- **Business invariants:** do not net customer and supplier balances; do not treat a supplier payable as customer advance; derive amounts from existing document, allocation, credit/refund engines rather than inventing frontend arithmetic. Preserve existing financial posting, stock costing, invoices and historical records. Explicit settlement remains a separate unapproved proposal and is not included here.
- **Compatibility/data:** additive optional read fields and optional reminder book context, preserving existing defaults. No record deletion, balance rewrite or new financial transaction type. If implementation reveals that a migration or different contract is necessary, document the exact change before building it.
- **UI consequence:** once these are verified, Customers can show Late / Late by / Most late first, last Shop activity and inline Remind exactly as the reference intends. Do not fabricate these values or route a Shop reminder through the Udhaar preview meanwhile.
- **Risk:** medium to high because incorrect recipient amounts are financial misinformation. Staff permissions, tenant isolation, reminder caps/hours and customer-facing branding rules continue to apply.
- **Acceptance tests:** same person owes ₹1,000 as customer and is owed ₹600 as supplier: each list shows its own amount, never ₹400 or a false advance. Cover partial payment, unallocated customer/supplier advances, credits, returns/refunds, settled, archived, no bills, due today versus overdue, and an older Udhaar entry versus newer Shop document. Reminder preview must use a fresh Shop figure, preserve final edited text in the existing log, retain recipient/cap/hour checks, and never claim delivery from app handoff. Existing no-book Udhaar requests and Library/Lending contracts must be unchanged. Add query-count checks on the 2,000-person scale book; no per-row invoice queries.
- **Rollback:** remove the additive client reads/controls and optional context, retaining prior fields/defaults. No destructive data rollback should be required.

Implementation note (18 Oct): optional Shop-only invoice/payment read filters and zero-net archive safeguards complete the current-role person workspace; source query defaults remain backward compatible. Role-aware Shop headline/top-party dashboard consumers also reuse this read seam so the lists they open agree. Existing report/aging consumers and the full person-page presentation remain separate follow-up pieces; see the implementation report’s limitations. No posting/model/stock change was made.

## BP-10 · Role-specific Shop statements and historical aging

**Proposed, not approved.** R-DEC-13 requires Customer and Supplier workspaces to stay separate. BP-09 supplies current role facts; the legacy Shop statement/aging still replays a signed combined ledger. Reusing that document for a Customer would silently subtract supplier payables.

- Why: merchants need an accurate customer/supplier statement, not a relabelled net figure. The person page temporarily withholds the mixed Shop statement link; individual source bill/receipt sharing and the Udhaar statement remain available.
- Proposal: additive `role=customer|supplier` on Shop-only statement/aging reads, with historical source allocations, credit/refund classification and as-of semantics specified first. No financial posting rewrite. Existing no-role requests and Library/Lending contracts remain unchanged.
- Risk: high if current `amount_due` is mistaken for a historical balance. Role/source assignment, reversals, voids, applied advances and partial returns must be independently replayed; never use current totals to fabricate a past statement.
- Data: read-only, no destructive conversion from the old cache. A schema/linkage proposal must be separate if existing historical allocation events prove insufficient.
- Tests: customer 1,000 / supplier 600 remain independent at each date; reversals, refunds, advances, partial payment, cross-book isolation, tenant/staff permission checks and PDF/share privacy. Compare to an independent source-event replay, not to the production selector itself.
- Rollback: remove the opt-in reads/new link; preserve existing endpoints and source documents. Do not unblock the old mixed statement by renaming it.


## BP-11 · Shared-engine book authorization

**APPROVED — owner, 18 Oct 2026: "fix that backend gap as well".** Implement server-side app/book authorization and financial-field projection using existing app grants and action permissions. No financial posting, ownership migration or Library/Lending calculation changes. The additive platform/0019 membership marker is required to distinguish explicit empty app grants from never-configured legacy access.

Raised 18 Oct 2026 after the owner asked whether any other user/module could read data without permission. **Tenant and action-permission checks are present; a selected app or a UI book filter is not itself an authorization boundary.**

Evidence: `platform_app/apps.py` grants Shop the shared parties/ledger capabilities and Udhaar those same two capabilities. `permissions_registry._scoped_by_app_grants` narrows capabilities, not individual money buckets. `PartyViewSet._detail` accepts `book=shop` under the shared party-read permission; `PartyDetailSerializer` returns the main balance and `bucket_figures()` may also add Shop balance. Payment selectors scope to tenant, with bucket supplied as an optional list filter. This is existing shared-engine permission granularity, not evidence that every app grant strictly hides every other book. A user with the broad shared read permission may receive more financial fields than the currently rendered screen uses.

Do not confuse this with cross-business access: 122 selected permission/tenant/app-grant/module-role/payment regressions passed. Do not call those tests a complete per-app privacy audit, and do not claim per-user private Udhaar ownership from tenant scoping alone.

Proposed work: define and test the authorization matrix for each shared contact, ledger, statement, reminder and payment endpoint, including omitted/changed book parameters, list totals/exports/detail serializers, direct IDs, role overrides and revoked grants. Reuse the existing membership/app registry/permission resolver rather than inventing another role map. Enforce allowed books server-side and project only authorized financial facts; keep contact identity reuse independent from financial access. First reproduce each undesired read with denied/limited app grants. Preserve owner/authorized staff workflows, public-share token semantics and Library/Lending's fixed vertical contracts. Personal Udhaar ownership needs an explicit owner/data-model design rather than hiding tenant-wide rows in the frontend.

Risk/compatibility: shared identity pickers and legacy missing-book callers must keep working; returning zero for a hidden balance is misleading, so the response/projection convention needs documenting before a change. Approved implementation adds app-aware authorization/projection and migration platform/0019 for an explicit-grants marker. It changes no financial records. Never-configured legacy business roles remain compatible; explicitly empty managed grants now revoke access. Read docs/performance/2026-10-19-bp11-book-authorization.md before deployment/rollback. The owner has approved this proposal (R-DEC-15).


## BP-12 · Notification visibility and shared-context isolation

**Approved correction scope, 19 Oct 2026 (R-DEC-18).** Owner explicitly requested notifications based on modules/users and the same rule for all data/functions, with these fixes before the next redesign piece. This is access hardening, not a change to vertical financial rules or API shapes.

- **Why:** a regression reproduces Shop-only access to an Udhaar broadcast through a merged ledger permission, and a targeted Library row bypassing module access. Shared recent-contact pickers omit Shop context and receive 403 for Shop-only staff; source caches do not include business/book and retain old-source rows during a switch.
- **Touches:** the existing notification visibility predicate used by list/count/read/read-all; shared frontend party/item search hooks and their Shop callers. No new search or financial engine.
- **Before → after:** resolve module-origin notification access using app-specific grants, including targeted rows. The recipient and business filters remain mandatory; the badge and read actions use the identical predicate. Explicit Shop search context and tenant/book source keys prevent borrowing Udhaar rights or showing stale contacts from another context.
- **Compatibility:** preserve documented never-configured membership compatibility; business/account-level notifications keep their existing recipient/permission rules. Preserve notification response shapes and every Library/Lending endpoint, calculation and workflow. No model migration, record deletion or posted balance change.
- **Risk:** visibility must not leak through unread counts or mark-all; caches must not retain selectable rows from another scope; targeting a user does not override a revoked app grant.
- **Tests:** fail-before tests for wrong-context searches, stale source rows and notifications; cross-business same-phone contact/owner API checks; grant revocation/disabled apps/other recipient; list/badge/direct/read-all parity; regression of existing inbox and permissions suites; local restricted-staff browser searches on phone and desktop.
- **Rollback:** revert the frontend search changes if needed; retain server visibility guards. An emergency UI rollback must not re-enable cross-app notification disclosure.

The owner asked for the rule across the application. This piece does not certify every endpoint. Continue an explicit coverage matrix for read/write/bulk/export/share and account/business switching; unverified surfaces stay named rather than inferred safe from hidden controls.

## BP-13 · Request actor/business intent and late-response isolation

Approved access correction scope: R-DEC-18. The owner requires user/module/business isolation for data and actions, with fixes before the next redesign screen.

- Why: the stored diagnostic proves a late user-A notification response can populate user B after logout/login in the same business. Tenant-only checks cannot identify that change. Response-only tenant checks also cannot prevent a stale tab creating a record in the business selected by a shared cookie before the response is rejected.
- Touches: shared Axios transport/bridge and request identity selector, shared source keys, central JWT authentication and tenant response metadata. No financial service or vertical payload/model/calculation changes.
- Before/after: capture authenticated user/business/permission revision on requests; reject stale results and retries. Optional X-Expected-User-Id and X-Expected-Tenant-Id headers are preconditions, never authentication or tenant selection; mismatches return 409 before the view acts. Existing tokens/membership/grants remain the authority. Echo membership revision on scoped responses so late results from older rights cannot overwrite current state; keep own tenant-transition/bootstrap behavior.
- Compatibility: clients omitting preconditions keep current API shapes; browser adds them only when its context is known. Public token documents and intentional authentication transitions remain functional. CORS must allow/expose the new headers. No migration or database rewrite.
- Risk: a guard must not break login/OTP, refresh, own-business switching, adding a business, no-tenant sessions or impersonation. Stale 401s must never refresh/replay under a different actor. Context mismatch clears stale local data and reloads coherently rather than rendering another actor under an old header.
- Acceptance: late success/error/401 after logout/new login in same business; revision changes; matching and forged/absent preconditions; stale-tab writes have no side effects; own switch and bootstrap pass; cookie and Bearer paths; proxy/CORS; account/tenant switch in two browser tabs. Add the failing diagnostic as an active regression. Preserve all existing book authorization tests.
- Rollback: retain server preconditions and remove only unsafe client presentation if necessary; never revert to accepting private stale responses to mask a UX failure.
- Implementation evidence: `docs/performance/2026-10-19-bp13-request-context.md`. No migration; API support must ship before or with the new client. Remaining access-matrix checks are explicit in 02 §5.1.

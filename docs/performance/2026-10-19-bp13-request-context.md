# BP-13 · Stale account and business requests

19 October 2026. Approved access hardening: R-DEC-18. Delivery boundary: R-DEC-19, commit/push and hand off before Home. This is a shared transport/authentication correction, not a new dashboard design or an all-API privacy certification.

## Behavior and implementation

The BP-12 diagnostic reproduced user A's late unread count entering user B's store after logout/login into the same business. Business-only response checks could not distinguish them. Another regression reproduced an old-business 401 being refreshed and replayed after a business switch.

The shared transport now captures user, business and permission revision when issuing a request; rejects stale actor responses and older revision results; and refuses old-context requests/retries before replay. Party/item search source keys reuse that same identity. Optional `X-Expected-User-Id` and `X-Expected-Tenant-Id` are server-side intent preconditions: the authenticated token, membership and grants remain authoritative. A mismatch returns 409 **before the view executes**, preventing a stale form from creating data under another tab's cookies. Headers never select or authenticate a user/business. Scoped responses expose actor and membership revision, with CORS allowances. Login/OTP/logout and intentional business transitions retain their existing behavior; session discovery does not pin the old business.

The browser test found a further feedback defect after unit tests passed: a refused old form overwrote the account-change warning with its generic save error. The existing global snackbar now preserves an open account/business-change warning until dismissal/reload. This is shared behavior, not a second snackbar or feature-specific duplicate.

No new package, migration, financial rule, Library/Lending model, workflow or endpoint payload shape. Clients omitting the new preconditions remain compatible and do not receive the new stale-intent protection; deploy the server support before or with the browser release. Existing API authorization is not replaced by these optional headers.

## Evidence and gates

Fail-before evidence:

- Original late-account diagnostic populated the next actor with count 7. Active tests now live in `frontend/src/tests/lateAccountResponse.test.ts` (nine cases, covering late success/401, in-flight refresh, ended tenant, revision and session-discovery metadata).
- Two new API regressions answered 200 instead of 409 before the authentication guard; the four request-context API tests cover no-side-effect mismatches, correct/absent headers, response metadata and real CORS preflight.
- The new snackbar tests failed twice before the shared fix, matching the browser's refused-form failure.

Final frontend **400 suites / 4,505 tests pass**. Changed-file ESLint (`--fix --max-warnings=0`), TypeScript, production build, bundle gate, 174 contrast pairs and en/hi locale split/check (6,495 keys) pass. Full lint was not run; the documented cloud run exceeds 25 minutes. Existing React/console and open-handle warnings remain; Jest ultimately exits successfully. Jest and production build ran sequentially, and the standalone server was restarted after the build.

Full backend: **4,632 passed, 16 skipped, one timing failure**. The pre-existing 5,000-schedule dues test took 60.9195s against 60s; its isolated rerun passed in **49.73s**. This is not an all-green original full run. No timing threshold was weakened. The request-context and existing compatibility/contract checks pass; Library/Lending functional tests in the full run pass.

**96 measured browser states pass**: 390/320/1024/1280 light/dark English and 320/1280 light/dark Hindi. Three cases per viewport/theme: another actor in the same firm reading the old tab, another actor saving an old form, and the same actor saving an old form after a cookie business switch. The harness checks the real 409 code and original intent headers, zero matching saved suppliers, authorized reloaded requests and recipient-specific inbox rows. Zero measured page overflow, clipped text or sub-4.5:1 labels in the measured snackbar/main/inbox regions. Existing host business-name ellipses outside those regions remain documented shell work, not fixed here.

The account-change path clears private local state immediately; the existing auth guard briefly renders sign-in while the delayed reload bootstraps the new cookie session. The result returns to the authorized Supplier page. This is verified recovery, not a claim of a polished new account-switch animation or completed notification redesign.

The committed measurement JSON is alongside this report; raw images/contact sheets live in the task workspace `outputs/revamp/shots/account-context/`. All twelve final contact sheets were visually inspected. Idle navigation results follow below.

The first desktop no-write assertion was rejected as a harness defect: the existing party search interprets digits as a phone query, so viewport `1280` matched a seeded supplier mobile. A direct local database check confirmed zero `LED context` parties. The corrected sentinel uses alphabetic viewport names; this changes no application search rule. The final matrix is rerun rather than treating that aborted sweep as a pass.

Shared app gzip is **113.6 KB**, framework **127.3 KB**, combined first-load baseline **240.9 KB**, versus BP-12's 239.7 KB (rounded measurements). Actor/business guards must execute centrally before every authenticated call and cannot live in a deferred form. Only 93 exceeded shared/first-load scalars were raised to measured +0.5 KB, with the reason in bundle-budgets.json; no framework/route-chunk limits or dependencies changed. This is a disclosed small shared cost, not a claim of zero overhead.

## Scope limits and handoff

The verified boundary is request intent, stale responses/retries, source identity and account/business reload behavior. It is not proof of every screen's edge cases, every token consumer, every same-user re-login epoch or every concurrent Set-Cookie race. Imports/exports, public share/download tokens and remaining module action families still need explicit access-matrix coverage; inspect existing tests before creating more. Existing tenant/module authorization remains necessary even with these headers.

Per-user personal Udhaar ownership is still unimplemented; tenant-scoped books are not a substitute. Historical role-specific statements/aging (BP-10), explicit cross-role settlement (BP-08) and remaining dashboard data proposals retain their approval boundaries. Physical phones, installed-PWA lifecycle races and real merchant usability are unproven. No production deploy or production database operation was performed.

Home was not started. The current portable handoff is `docs/revamp/START-NEXT-SESSION-PROMPT.txt`; standing method is `AGENT_START_PROMPT.md`. The next agent must finish concrete access audit findings before Home, then the remaining Shop families under R-DEC-16. UI ratings from the Suppliers screen do not certify this security work or the entire Shop.

## Idle navigation comparison

Same local production machine, same two Supplier paths, 3 repetitions/profile/width, 24 samples total, after other verification stopped. Before: delivered BP-12. After: this build. Six samples per cell are a lab check, not evidence of merchant/device performance or a speed improvement.

| Width/profile | First change p50/p95 before → after (ms) | Content p50/p95 before → after (ms) |
|---|---:|---:|
| 390 unthrottled | 3 / 31 → 3 / 32 | 139 / 145 → 135 / 173 |
| 390 throttled | 5 / 35 → 5 / 33 | 519 / 1246 → 512 / 1186 |
| 1280 unthrottled | 2 / 30 → 1 / 30 | 134 / 475 → 130 / 508 |
| 1280 throttled | 3 / 31 → 4 / 31 | 839 / 1244 → 821 / 1215 |

F4’s broader throttled p95 was 168ms without Lending Today, versus 819ms in the pre-foundation baseline. Those cohorts differ from these two Supplier paths; they provide context, not a comparable before/after claim. No navigation sample timed out. See the committed raw navigation JSON.

## Reproducing the browser fixture

Use synthetic local data only. `e2e/revamp-shots.mjs --piece=account-context` uses
`E2E_EMAIL` for operator A and `E2E_PASSWORD` for both synthetic operators. Supply
`E2E_SCOPE_FIXTURE` as a JSON file containing `user`, `tenant`, `otherActor`,
`otherActorEmail`, `otherTenant`, `otherActorNotes` (two recipient-specific low-stock
notification IDs), and `notifications.own` (operator A’s notification ID).
Both operators need Shop-specific grants in the first firm; operator A also needs
a membership in the second, otherwise empty, firm. The two notifications must
remain visible only to operator B; identities/notes are assertions, not mock API
responses. Existing local fixture is `/private/tmp/bp12-fixture.json`; IDs and local
setup scripts are deliberately not committed as application data. On another
machine create equivalent synthetic fixtures in the isolated seeded database.
The active transport/API tests run without this browser fixture.

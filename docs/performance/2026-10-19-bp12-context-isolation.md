# BP-12 · Shared search and notification context

19 October 2026. Owner approval: R-DEC-18. Scope: correct Shop searches for app-specific staff, isolate source caches during business/book switches, prevent stale contact selection, and apply app/recipient scope to notification list/count/read/read-all. This is not a claim that every application endpoint or personal Udhaar ownership has been completed.

## What changed and why

The shared party search now accepts an explicit book. Shop purchase/customer/expense/payment consumers supply Shop; an omitted payment bucket follows the existing Shop default. Library's explicit payment context retains its existing request behavior. Header searches read the book from the existing app manifest, not literal app names. Supplier-only results open the supplier workspace; broad Shop identity search does not show a misleading netted customer/supplier figure.

Party and item sources key results by business, with book/type also in party keys. The shared paged source immediately hides old-source rows but retains previous-query rows within the same source. Both party picker presentations refuse click/Enter while those rows do not yet answer the new query. This prevents a fast typist choosing the previous name. Header names wrap; the shared list text gains an opt-in full-wrap mode, preserving existing defaults. Selected supplier names also grow naturally rather than ellipsize.

Notification module-origin types are resolved against app-specific grants at read time, including targeted rows; simply addressing a user cannot bypass a revoked app grant. The recipient/tenant predicate still applies. Count and read actions use the same scoped source. Existing never-configured membership compatibility and business/account event semantics remain; no model migration, posted amount or vertical endpoint shape changed.

## Fail-before evidence

- Shop supplier/header request tests fail before explicit book context; real API proof shows unscoped recent-activity ordering is 403 for Shop-only staff, while book=shop succeeds.
- The shared paged-source test fails because previous-business results remain visible after the source key changes.
- The fast-Enter test fails by navigating to the retained old contact.
- The notification API test exposes two forbidden rows before the fix: an Udhaar broadcast through shared ledger rights and a targeted Library notice. Fixed checks cover lists, unread badge, direct read and mark-all, plus app revocation/disablement and another recipient.
- Old phone purchase picker measured a 486 px name inside 228 px, nowrap; fixed browser measurements wrap it. The calibration screenshot/log are kept in the task evidence directory.

## Verification

The focused notification/access suite passes **82 tests**, including same-phone cross-business contact/owner and authorized role-list money without private main data. Full backend: **4,628 passed, 16 skipped, one timing failure** (dues 5,000 schedules: 60.93s versus 60s). That exact test passes alone in **51.99s**. Do not describe the original full run as all-green. Library/Lending tests in that full run pass; no accounting or workflow fix was needed for the timing check.

The first full frontend run exposed a manifest architecture violation (literal app names in shared header code); this now reads the manifest's book. Older interaction tests also clicked retained stale rows, so they now wait for the matching enabled option rather than bypassing the pending guard. Final frontend: **398 suites / 4,494 tests pass**, including default Shop payment search, manifest-owned search context and pending-choice guards. TypeScript, changed-file ESLint and production build pass; no locale changes were made. Full lint was not run (the documented cloud run can exceed 25 minutes). Existing console/open-handle warnings remain. Browser/performance evidence is appended below at delivery.

**60 measured browser states pass** in the final context matrix: 390/320/1024/1280, light/dark English; 320/1280 light/dark Hindi, using a real local Shop-only operator. Header search, fully loaded supplier workspace/record sections, purchase supplier picker, selected long name and default Shop payment picker have zero measured overflow/clipping/contrast violations in their scoped regions. Live API checks assert notification app/recipient scope, list/count agreement and forbidden direct reads with valid CSRF. These are context corrections in existing forms, not the completed Shop Home/purchase/notification visual redesign. Unit/API tests cover delayed source switches and denied-state variants; physical devices and real merchant usability remain unproven.

## Access audit boundaries and next work

Use revamp/02 §5.1 as the coverage matrix. Existing tenant transport teardown is tested, but a same-business account-switch diagnostic now reproduces a late previous-user unread count repopulating the new user after teardown. That diagnostic is saved for the next transport hardening piece, and must be fixed before whole-app privacy sign-off or resuming Shop Home. Imports/exports/public download/share-token boundaries and other module action families need explicit coverage as work continues. Per-user personal Udhaar ownership is still a separate gap; a contact/tenant authorization fix does not implement that data model. Never assert all-user/all-API privacy solely from these checks.

After delivering this fixes checkpoint, complete remaining access checks prioritized by R-DEC-18, then resume Shop Home and the remaining Shop families before other apps (R-DEC-16).

Visual review also identifies a pre-existing 320 px purchase-footer amount clamp outside the changed picker region. The whole purchase form is not redesigned or rated as complete by this scope patch; carry that defect into its form family.

## Cost and navigation comparison

Gzip framework/shared-app baseline remains **239.7 KB** (127.3 + 112.5); shared budgets stay unchanged. Explicit context, stale-choice guards and full identity labels add roughly 0.1–0.2 KB to the app layout/affected route chunks. The gate initially failed; only **144 exceeded route/first-load scalars across 77 routes** use measured gzip + 0.5 KB, with the reason written in bundle-budgets.json. No new package or eager form import. The exact adjustments are recorded alongside this report. This is a disclosed cost, not an unchanged-budget claim. Contrast gate: 174 pairings pass.

Idle local production navigation, same two Supplier paths, 3 repetitions/profile/width (24 samples). The earlier BP-12 run overlapped verification work and is excluded; use the idle file. Before is the delivered Suppliers piece, not a synthetic baseline. Six observations/cell are a small lab comparison; no speed improvement or real-device claim.

| Width/profile | First change p50/p95 before → after (ms) | Content p50/p95 before → after (ms) |
|---|---:|---:|
| 390 unthrottled | 4 / 33 → 3 / 31 | 126 / 153 → 139 / 145 |
| 390 throttled | 5 / 34 → 5 / 35 | 522 / 1218 → 519 / 1246 |
| 1280 unthrottled | 1 / 27 → 2 / 30 | 135 / 517 → 134 / 475 |
| 1280 throttled | 4 / 32 → 3 / 31 | 823 / 1249 → 839 / 1244 |

F4's broader throttled p95 was 168ms without Lending Today, versus 819ms in the pre-foundation baseline; cohorts differ, so those are context only. The scoped build retains prompt first feedback, with content tails documented above rather than rounded into a speed claim.

All twelve final context contact sheets were visually inspected; the initial supplier screenshots were rejected because some still showed the loading skeleton, and the harness now waits for both record sections. The final layout JSON and idle navigation file are alongside this report. Raw screenshots/contact sheets are in the task workspace outputs/revamp/shots/contexts. The earlier overlapping performance run is not used.

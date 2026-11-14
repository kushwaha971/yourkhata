# Personal Udhaar isolation and compact balance cards — 25 October 2026

## Requirement and implementation

The owner reported that Shop customers/suppliers appeared in the personal book.
The previous presentation checkpoint did not implement personal ownership. That
was an essential missing requirement, not a completed privacy boundary.

| Owner requirement | Implementation | Verification |
|---|---|---|
| Personal to the signed-in user | One `PersonalBook` per authenticated user, private storage scope, no business membership | Direct owner/staff access, same phone, guessed IDs, cross-business switch tests |
| No Shop contacts or counts | Explicit `/personal/` API namespace uses the private scope before permissions and selectors | Business list stays unchanged; personal list starts empty |
| Existing money rules | Existing Party, ledger, balance, audit, statement and reminder services reused within that scope | Real ₹500 given / ₹200 received; repeated key; optional note; statement/reminder access |
| Independent of business selection | Unique owner mapping, not active-business mapping | Same user switching business reads the same personal people |
| Two clear totals | Green To get / red To give cards; zero amounts retain direction colour | 12 measured EN/HI list frames pass; both cards 96px, zero clipping/low contrast |
| Remove extra text/divider | No repeated people counts, no summary separator | Component regression |
| One Back arrow | Local arrow beside full name, no duplicated header Back | Shell/person regressions |

## Storage decision

A dedicated storage scope lets the proven tenant-scoped financial engines remain
unchanged. `PersonalBook.owner` is unique and server-selected. The private scope
has no persisted business membership, so neither business switching nor an owner
role in a shared business grants access. Only the personal endpoint mixin creates
an unsaved owner permission context for the authenticated book owner. It exposes
contact, main-book ledger, statement and reminder endpoints; no business modules.
Personal book permissions are independent of the person's business staff role.

`X-Tenant-Id` continues echoing the authenticated business session for the existing
stale-tab guard, not an input selecting private storage. Requests keep the user
identity guard. Shared engine requests use an app-scoped transport snapshot;
responses from an app left behind are rejected, and app switching clears cached
feature data. Route ownership is read from the existing manifests, including the
first request on a direct /khata visit.

Additive migration only. Existing shared business contacts and main-book entries
are retained without guessing personal ownership from who typed an entry. No
automatic reassignment or deletion of ambiguous historical business records.
No Railway database or production messages are involved.

## Results

Initial private API regressions failed before implementation (routes absent).
Six focused ownership/money/reminder checks pass after implementation. Wider
contact, ledger, frozen contracts, frontend gates pass alongside real local browser journeys; final run details follow below. No whole-module score
or performance improvement is claimed by this checkpoint.

## Final verification

- Backend: 842 collected contact/ledger/frozen-contract tests; 838 pass, 4 skip.
  Six private-book regressions also pass independently, including ₹500−₹200=₹300.
- Frontend: final colour-inclusive run: 442 suites / 4,872 tests pass.
- Gates: changed-file lint/type-check, production build and 174 contrast pairs
  pass. No locale edits. The sandboxed CSS worker failed with EPERM; moving
  generated Turbopack cache aside allowed the standard build to complete.
- Initial resolver import added about 6KB shared and failed the bundle gate;
  removed it. Final request routing stays in the transport bridge; manifests
  register a route resolver only when the authenticated shell loads. Remaining
  shared privacy guard costs about 0.2KB gzip. Only measured overruns gain
  measured+0.3KB limits, with explicit reasons in bundle-budgets.json.
- 21 real-browser checks pass: identity-only contact POST, empty optional note,
  give/get balance read-back, three fast taps→one POST, unknown payment method
  remains NULL, editable WhatsApp/SMS drafts, edited SMS handoff URI. No external
  message was sent.
- 44 measured list/person frames (390/320/1024/1280, light/dark; Hindi320/1280)
  pass own-box text, computed contrast and page-width checks. Long names and
  ₹12,40,378.00 are included; four contact sheets and native frames inspected.
- R-DEC-49: Got money now uses surface-nav with white text; Gave stays red.
  A named regression fails on yellow and passes on sidebar teal. Final browser
  check compares the computed button background directly with the sidebar.

Source evidence is local QA only. Real installed PWA, physical keyboard/phone
contact picker, OS text scaling and rural-user research remain unproved. No
competitive-superiority or whole-module privacy certification is claimed.
Old shared records are retained; ambiguous history is not silently reassigned.


Final colour acceptance: 24 English and 8 Hindi person frames pass (zero
failures). Got money computes to rgb(11,63,69) light and rgb(14,36,39) dark,
matching the desktop sidebar. On phones, where the sidebar is not mounted,
compare against the documented sidebar palette. Button-label contrast also
passes the actual rendered-background check. Native390px light frame inspected.

Screenshots: Documents/Codex/2026-10-02/https-railway-com-project-386b1ca4-ae4a/
artifacts/udhaar-private-fix-2026-10-25/ (list frames and teal-person folders).
Committed machine evidence: docs/performance/data/2026-10-25-private-udhaar/.
No Railway/production data was read or changed; deployment must apply additive
parties.0013_personal_book before serving the new frontend.

## Quiet matched performance

Pre-fix b264ac7d4 and final build; isolated worktree with hard-linked dependencies,
ports3001/3000, same local API and matched QA data (one Ravi, two entries,₹300).
Run order old/new/old/new, three repetitions each, no build/test/browser tasks
competing. Earlier exploratory runs with screenshots competing are discarded.

| View | Profile | Old median ms | New median ms |
|---|---|---:|---:|
| 390px | unthrottled | 103.0 | 107.5 |
| 390px | throttled | 422.5 | 418.0 |
| 1280px | unthrottled | 80.0 | 84.5 |
| 1280px | throttled | 414.0 | 407.5 |

Six samples per cell. First repetition includes cold route code; this is person
navigation, not a whole-app or installed-PWA benchmark. Differences are small;
no speed-improvement claim. Functional isolation is the purpose of this fix.

## Scoped review (provisional self-assessment)

Only this correction is scored, not all Udhaar features or independent field research.

| Point of view | Score | Evidence | Still weak | Confidence |
|---|---:|---|---|---|
| Function, phone/desktop | 8.7 | Six ownership/API tests, server balance and retry journey | Legacy shared history needs explicit ownership review; no automatic migration | High for tested scope |
| Busy use, phone/desktop | 8.6 | One Add, amount/optional note, duplicate-tap lock, editable reminders | Physical phone contact picker and installed app unproved | Medium |
| UI/UX, phone/desktop | 8.6 | 44 measured frames, two 96px cards, one arrow, matching teal action | Shell still displays selected business; not part of this correction | Medium |
| Performance, phone | 8.6 | Quiet matched throttled418ms median, unchanged within small variation | Physical low-end phone unproved | Medium |
| Performance, desktop | 8.6 | Quiet matched throttled407.5ms median, unchanged within small variation | Wider workloads unmeasured | Medium |

Delivery gates: final442suites/4,872tests;838backend/contractpass,4skip;
changed-file lint, type-check, production build, bundle and174contrastpairs pass.
No locale changes. No speed or competitor superiority claim.

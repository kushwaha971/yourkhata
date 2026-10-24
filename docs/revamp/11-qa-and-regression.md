# 11 · QA, regression and rollout checks

Status: **plan**, 17 Oct 2026. Uses the existing gates in CLAUDE.md; adds only what the revamp needs.

## Existing gates (must stay green every phase)
- `backend`: `python3 -m pytest -q`.
- `frontend`: `type-check`, `lint`, `npm test`, `build`, `bundle:check`, `i18n:split`, `i18n:check`.
- e2e against a live stack served by `e2e/serve-api.sh` and `e2e/serve.sh`: journey, security, credentials, parties, tags, credit, ledger, statement; onboarding-apps; offline; desktop-unchanged; the `--shots` sweeps.

## Added for the revamp

| Check | What it proves | Phase |
|---|---|---|
| `e2e/perf-app.mjs` | 05 §5 metrics, before and after | 1, 7 |
| Double-tap script | every money form (receive payment, bill save, purchase record, Udhaar entry, Library fee/deposit, Lending collect, loan create) fires exactly one write when tapped twice fast and when retried after a forced failure | 4 |
| Navigation feedback check | every bottom tab, sidebar row and list row shows a pressed state within one frame and a pending state within 150 ms on a throttled profile | 4 |
| Keyboard overlap check | on 360 × 640 with the keyboard open, no docked bar is covered and the bottom nav is hidden | 4 |
| Measuring checks | `scrollWidth` vs viewport and every text node vs its box at 320/360/390/768/1280, both themes, English and Hindi (the LED-02 lesson) | every UI phase |
| Contract snapshot | Library and Lending request/response shapes unchanged | 6 |
| Figure parity | every figure on old and new Library/Lending screens equal on a seeded book | 6 |
| App switching | 1-app, 2-app and 4-app people; switch with unsaved form; deep link to an app you don't have; place kept per app | 4 |
| Notifications | popover and page; unread count; mark all; open cross-app item | 4 |
| Session expiry mid-form | sign in again returns to the screen; draft kept where drafts exist | 4 |
| Accessibility | axe at 390 and 1280 both themes; TalkBack pass on Android; large text 200% at 320 px | 3, 8 |
| Devices | one low-end Android (D-06), one iPhone, installed PWA, weak signal; 9-task script timed | 1, 8 |
| Data volume | 2k parties / 100k entries (existing scale seed); Library 2k members; Lending 3k loans | 1, 7 |

## Screenshots after each piece (R-DEC-07, owner, 17 Oct 2026)

Every UI piece that is built, whether a form, card, drawer, sheet, dialog, list or a whole screen, is photographed on the running app before the next piece starts, and the pictures go to the owner with the report for that piece.

- **Sizes:** phone 390 × 844 (plus 320 × 640 when the piece holds text that can wrap) and desktop 1280 × 800.
- **States:** each state the spec lists for that piece that can be reached on a seeded stack: empty, filled, loading, error, refused by validation, success, and long name / large amount (₹12,40,378.00). Light theme always; dark theme and Hindi for any piece with text.
- **How:** Playwright against the live stack served by `e2e/serve-api.sh` and `e2e/serve.sh` (never `next start`), the same way the existing `--shots` sweeps work, saved under `/tmp/e2e-shots/revamp/<piece>/` and copied to `/mnt/project-files/revamp/shots/<piece>/` so the owner can open them.
- **Read them before sending:** look at each picture against the spec, and run the measuring checks on the same pages. A screenshot nobody looked at proves nothing.
- Library and Lending pieces are photographed beside the current screen with the same data, so the figures can be compared (figure parity).
- The harness is `e2e/revamp-shots.mjs --piece=<loading|press|lock|apps>`. `lock` is also the double-tap check: it holds the save's POST, taps twice and presses Enter, counts the requests that left (must be 1), and replays a lost answer to prove the retry carries the same key and comes back `Idempotent-Replayed`. `apps` switches app and back on the phone sheet and the desktop tree and asserts the return lands where it left; it MEASURES rather than reads: the page and rail colours from the computed style, each rail label's contrast against the colour it sits on (≥ 4.5:1), and every text node against its own box (no cut or clamped word). Add `--locale=hi` for Hindi and `--widths=1024` for the narrowest desktop. A check that reads tokens passed while the light-theme rail drew dark ink on dark teal at 1.4:1.

## Exit criteria for rollout (Phase 8)
1. Every existing gate green.
2. Every added check green, or a written exception the owner accepted.
3. Contract diff empty and figure parity 100% for Library and Lending.
4. Performance targets met or the gap shown with numbers.
5. Rollback drill done on staging: flag off restores the old screens with no data change.
6. Staged rollout per app: internal → one friendly customer per app → all, with a watch period between.

## R-DEC-31 · Viewport behavior across all modules (21 Oct)

Owner explicitly wants this in every module, not only Purchases. Track the
rollout within this existing revamp; this is not a new redesign plan. Purchases and the already-redesigned Shop Customers/Suppliers/Bills registers
have been implemented/verified. Next: remaining sales-document lists. Then apply
and verify the same behavior on each remaining module's real list composition.
This shared behavior rollout does not certify or replace their full revamps.

| Surface group | Status | Guard |
|---|---|---|
| Purchases / shared orders and returns register | Verified in Purchases only;32px/44px correction passes |32px face,44px mobile hit area; pinned pager/toast clearance |
| Shop Customers, Suppliers, Bills | Verified:522 final frames,4,648 frontend tests;21Oct viewport-shop report | Preserve separate roles/books, filtering and row actions |
| Remaining sales documents | Pending | Shared list kinds, permissions and links unchanged |
| Items, stock, payments, expenses | Pending | No stock/pricing/payment calculations changed |
| Personal Udhaar people, aging, reminders | Pending | Independent personal book; no mixed Shop balances |
| Library members, catalogue, copies and other collection views | Pending | Presentation only; exact endpoints/bodies/calculations frozen |
| Lending borrowers, loans and Today collections | Pending | Preserve schedules/collections; inspect custom list/paging first |
| Reports and other register views | Pending | Keep exports/prints and report-specific horizontal-scroll exceptions |
| Embedded import/admin/team tables | Inventory separately | Bound their own container; do not turn a form or detail page into a register |

For each actual page: use UbViewportPageShell + UbDataGrid fillHeight where it
fits; keep existing paging APIs. Inspect custom/load-more/infinite lists first:
a pinned auto-load sentinel must not fetch every page merely because it stays
visible. Do not invent totals, pagination endpoints or new Library/Lending
workflows. Preserve current filters, context fences, financial facts and access.
Measure document height, rows-only scrolling, unchanged pager position, real
button hit-testing with toasts, short height and reference32px chip faces with
44px mobile targets. Run the standing gates/LOOK/performance/report loop per
verified group. An unchecked row remains pending, never implied complete.


## R-DEC-32 · Functional value, competition and requirement coverage

For each piece, put the following in its existing evidence report before
claiming completion. Reuse this structure rather than starting another plan.

| Required question | Evidence to record |
|---|---|
| Who needs this and why? | Role, business task, necessity and placement rationale |
| Does it work end to end? | Actual local UI/API/persisted readback, business effects and recovery |
| Does it make the user's work better? | Fewer steps/errors, clearer decisions; distinguish measured from assumed benefit |
| Is it feasible and maintainable? | Existing engines/components, data availability, performance/cost and boundaries |
| How does it compare? | Same task against relevant competitors; dated verified sources/observations; better/equal/worse and trade-offs |
| Are necessary requirements fulfilled? | Requirement → implementation → test/journey → passed/missing/deferred/unproven |

Research not yet performed is unproven. Requirements not implemented are not
passed. Preserve critical correctness/access/data-recovery gates independently
of ratings. Competition does not justify unnecessary features or copying another
product's appearance. No claim here that all modules have met these gates.


### R-DEC-33 amendment ·22Oct2026

Earlier mobile manual/arrow-pager matrix acceptance is superseded. Existing desktop verification remains; Customers/Suppliers/Bills/Purchases mobile follow-up is pending. Phone acceptance: joined cards, scroll-next with accessible fallback, one list-search field and compact global search icon. Measure header height, card-area share, offset preservation, no eager fetch-all, duplicate IDs, failed-append retry and filter/context reset. Desktop remains a table with reachable pagination. This is not a whole-module completion claim.


### Sales-document lists · 23 Oct 2026 (R-DEC-33, R-DEC-34)

| Requirement | Evidence | Status |
|---|---|---|
| Phone joined cards, no table/pager/FAB | mobile-sales-contract, 4 kinds × 320/390 × 2 themes | passed |
| Scroll-next, no eager page 2 | same | passed |
| Failed append keeps cards, 44 px retry, keeps scroll | same, real page-2 count | passed |
| New query resets | same | passed |
| One list search, 44 px global icon, active chip visible | same | passed |
| Cards ≥ 60% of a normal phone | 62.0% at 844 px | passed |
| Desktop table + visible pager | 1024/1280 | passed |
| No cut text/contrast/overflow EN/HI light/dark | revamp-bills, 4 kinds | passed |
| 1024 header density | rows 45% of viewport | weak, recorded |
| Phone nav speed vs 477916b | +50 ms median at 4x CPU | regression, unprofiled |
| Competitor comparison | none this session | unproven |

### Bills register on a phone · 23 Oct 2026 (R-DEC-33, R-DEC-34)

| Requirement | Evidence | Status |
|---|---|---|
| Phone joined cards, scroll-next, no pager/FAB | mobile-sales-contract invoices, 390/320 × 2 themes | passed |
| Failed append keeps cards, retry 44 px, keeps scroll; new query resets | same | passed |
| Cards ≥ 60% of phone | 390: 62.0%; 320: 58.5% with crore totals | weak at 320 |
| 1024 long numbers whole | revamp-bills invoice 1024 light/dark | passed |
| EN/HI, light/dark, all states | revamp-bills invoice | passed |
| Phone open speed vs 7b27948 | −200 ms median at 4x CPU, both rounds (n=6) | passed, small sample |
| Competitor comparison | none this session | unproven |

### Purchase registers on a phone · 23 Oct 2026 (R-DEC-33, R-DEC-34)

| Requirement | Evidence | Status |
|---|---|---|
| Phone joined cards, scroll-next, no pager | contract purchase-bills/orders/debit-notes 390/320 × 2 themes, EN and HI | passed |
| Failed append keeps cards; new query resets | same, plus slice/page tests | passed |
| Cards ≥ 60% of phone | 47.0% before → 64.6% (390), 61.5% (320) | passed |
| Debit note card wording | LOOK: "to pay" → "open credit" | fixed |
| Speed vs 5714a94 | phone −58 ms; desktop 4x CPU +75/+129 ms, unexplained | open |
| Competitor comparison | none this session | unproven |

### Purchase detail §6 · 23 Oct 2026 (R-DEC-34)

| Requirement | Evidence | Status |
|---|---|---|
| Money first, Pay supplier, chooser, links, lines | e2e/purchase-detail.mjs 390/320/1280 EN/HI | passed |
| Pay, refused void, void→advance, order→bill, delete draft | same, read back from the local API | passed |
| Archived supplier refusal | unit test only | partial |
| Speed vs 216d456 | phone −93 ms both rounds; desktop mixed | passed, small sample |
| Competitor comparison | none | unproven |

### Items list on a phone · 24 Oct 2026 (R-DEC-33, R-DEC-34)

| Requirement | Evidence | Status |
|---|---|---|
| Joined cards, chips, no pager/FAB, page fits | contract items 390/320/1280 × 2 themes, EN and HI | passed |
| Low chip, open item, code + Enter, unknown code | e2e/items-phone.mjs 6/6 | passed |
| Desktop pager in reach | contract 1280 | passed (regression fixed) |
| Speed vs 925b2b3 | 4x CPU list open slower, round 1 heavy | open |
| Competitor comparison | none | unproven |

### Item detail · 24 Oct 2026 (09 §8.2, R-DEC-34)

| Requirement | Evidence | Status |
|---|---|---|
| Phone order, no cut text, 44 px actions, EN and HI | e2e/item-detail.mjs at 390/320/1280 × goods/service/archived | passed |
| Adjust stock from the page; server on-hand and the page agree | e2e/item-detail.mjs journey | passed |
| ⋯ → Edit opens its drawer (17 Oct capture-phase defect) | e2e/item-detail.mjs journey | passed |
| Margin permission-gated; below cost in words | ItemDetailPageContent.test.tsx | passed |
| A tab failing alone offers Try again | ItemDetailPageContent.test.tsx | passed (was a defect) |
| Rows name and link their bill | needs BP-19, not on dev | awaiting approval |
| Several stock locations | QA tenant has one | unproven |
| Offline state | code path only | unproven |
| Speed vs 0dea7c1 | page open 933 → 904 ms at 4x CPU | unchanged |
| Competitor comparison | none | unproven |

### Item form · 24 Oct 2026 (09 §8.3, R-DEC-34)

| Requirement | Evidence | Status |
|---|---|---|
| Fast path order; Includes GST beside the price | e2e/item-form.mjs; ItemPriceFields.test.tsx | passed |
| Cost and margin, Category folded; no cost fold without permission | e2e/item-form.mjs; ItemPriceFields.test.tsx | passed |
| Margin from cost; 100% refused in words | e2e/item-form.mjs | passed |
| Used barcode links to its item | e2e/item-form.mjs | passed |
| Leave without saving on a dirty Cancel | e2e/item-form.mjs | passed (new) |
| Save creates the item on the server | e2e/item-form.mjs read-back | passed |
| No sideways scroll or cut text, Save target ≥ 44 px, EN and HI | e2e/item-form.mjs at 390/320/1280 | passed |
| Drawer-open speed | no harness | unproven |
| Competitor comparison | none | unproven |

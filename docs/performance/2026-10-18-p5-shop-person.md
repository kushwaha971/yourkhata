# Phase 5 · Shop person page

18 October 2026. Approved by R-DEC-10; role-specific composition clarified by the owner in **R-DEC-13**. Continues the Counter Mode plan rather than starting another design system. Scope: the person opened from Shop Customers/Suppliers, its primary actions and existing form handoffs. Udhaar keeps its existing workspace; Library/Lending endpoints and calculations are unchanged.

## Owner-directed composition correction (R-DEC-14)

The live Claude artifact was opened and inspected directly in the browser, including Step 5's 440 px drawer, phone sheet, amount-first hierarchy and More details fold. The customer person page is an extrapolation of that visual language, not a screen explicitly drawn in the artifact.

- Remove the permanent Shop contact/settings rail. Secondary details are collapsed before the source records at every width. The primary phone number appears once; the payment promise is adjacent to the overview for customers, rather than buried among settings. Supplier view has no customer promise or customer price-list control.
- Compact the Shop identity/balance card into one wrapping row. Reuse the existing source-record list, controls and independent role facts.
- Recompose the existing payment form for `bucket=shop`: 440 px desktop panel, amount before the UI-kit method select in both DOM and focus order, existing split-payment support, existing FIFO/manual matching, date and private note inside More details, remaining due/advance plus a direction-specific primary action in the pinned footer.
- New optional keyboard-aware geometry in the existing overlay primitive uses VisualViewport only when a phone keyboard reduces the visible area. It resets on keyboard close and unmount. Other consumers retain their existing geometry.
- A dirty Shop payment asks before discarding and cannot close while saving. Existing validation errors inside More details force it open.

The correction is built and verified below. The older person-build evidence is preserved afterward as history; it does not replace the final correction measurements. Real-device and merchant-study limits remain.

### Final correction verification

| Check | Final result |
|---|---|
| Full frontend Jest | **397 suites / 4,484 tests passed**; existing console/timer/open-handle warnings |
| Changed-file lint / types / production build | Passed. Full repository lint not claimed (over 25 minutes in cloud); frontend restarted after the last build |
| Locale / token contrast | 6,481 en/hi keys in 54 catalogues; 174 token contrast pairings passed |
| Browser | **210 measured captures: 142 English + 68 Hindi**, all with zero measured overflow, text cuts or contrast failures. English: 320, 390, 1024, 1280, light/dark. Hindi: 320, 1280, light/dark. Header/dock, ready/loading/failed-read/retry, invalid/advance, expanded details/discard, supplier, archived/empty/error, long names/₹12,40,378, real busy/saved checks |
| Financial interaction | Real ₹1 receipt only in isolated scale book; two Save taps produced one POST; customer dues refreshed and supplier amount stayed unchanged; billing shortcuts preserved selected identity |
| Access control | 122 selected backend tests passed; **not** a complete shared-book/privacy certification (BP-11 below) |
| Before-fix regression proof | Six new tests failed on the previous staged code and pass now. The full suite caught removal of an existing module-role badge; that badge was restored and its existing regressions pass |
| Bundle | Final person route **112.1 KB**, first load **351.8 KB** (prior person build 111.7 / 351.4). Shared app **112.5 KB**, unchanged 113 KB ceiling. Only 54 distinct exceeded route/first-load scalars raised to measured +0.2 KB, with reason in bundle-budgets.json |

Visual review found a snackbar masking the phone Discard changes action. The existing overlay footer now publishes clearance through useBottomInset, and modal toasts clear the actions on phone and desktop. A real elementFromPoint hit-target check failed on the old build and passes with the fix. Reusing the hook adds about 1 KB on the landing route; the shared-app ceiling stays unchanged.

Screenshot harness checks use the topmost dialog, wait for actual invalid/valid/disclosure states, assert the 440 px desktop drawer and amount focus, and inspect computed text/background contrast and bounds. Chromium shutdown occasionally hung after all assertions completed; `e2e/browser-cleanup.mjs` supplies one reusable cleanup deadline for screenshots and performance. It never shortens or bypasses an assertion.

#### Measured navigation cost

Same local machine, isolated book, three Shop navigation cases, 3 repetitions, 36 samples; no other test/build/screenshot job running. Compare the previous person build's checked-in `2026-10-18-person-after.json` with `2026-10-18-person-correction-after.json`. F4/cloud figures remain historical context, not an absolute same-machine comparator. **No speed improvement is claimed.**

| Width/profile | First visible change p95: prior → correction | Content settled p95: prior → correction |
|---|---:|---:|
| 390 / unthrottled | 29 → 30 ms | 438 → 441 ms |
| 390 / throttled | 32 → 31 ms | 1411 → 1363 ms |
| 1280 / unthrottled | 34 → 33 ms | 555 → 539 ms |
| 1280 / throttled | 34 → 35 ms | 1421 → 1427 ms |

#### Final review

Provisional review of this page/form piece, not the entire Shop or a merchant usability study:

| Mobile 20% | Ease 15% | Visual 15% | Feedback 15% | Accessibility 10% | Desktop 10% | Safety 10% | Reuse 5% | Weighted |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 8.7 | 8.8 | 8.6 | 9.0 | 8.3 | 8.8 | 8.3 | 9.3 | **8.7/10** |

The earlier 8.97 is withdrawn, not rounded into this score. Tested payment/billing handoffs: 9.0 provisionally; feature completeness: 8.2 while BP-10 statements and BP-11 shared-book authorization are unresolved. No whole-platform security score or verified 9/10 claim.

Known difference from the live artifact: the existing saved-payment confirmation with View receipt remains; the artifact's close-plus-actionable Share receipt toast is not implemented by this piece. Real Android/iPhone keyboard behavior, large text, screen-reader use, offline recovery and merchant task studies remain unproven. In the new Shop drawer, saving is deliberately blocked until its unpaid bills have loaded successfully; recording through this entry point without an available bill read (including offline) is not certified or silently treated as an advance. Geometry is opt-in and simulated viewport regressions pass, but that is not a real-device certification. The unchanged shell's long business name can still end in an ellipsis; the measured content scope is main/dialog, not the whole shell.

Final images and 12 reviewed contact sheets are in the attached chat workspace under `outputs/revamp/person/` and `outputs/revamp/shots/person/`. Source-controlled numeric evidence uses the `2026-10-18-person-correction-*` files in this report's data folder.



### Access-control verification requested by the owner

122 selected backend regressions passed: common authentication/permission/tenant checks, per-app grants, module-role scope, cross-tenant payment recording/allocation and Shop facts. Tenant IDs resolve from authenticated membership, not a client-supplied tenant header; queries are tenant-scoped; unmapped actions fail closed. Module roles cannot acquire shared party-read access through overrides. Core read rights intentionally allow the authorized records of that business, not just records created by that staff member. This is not a platform-wide penetration-test claim or a claim that selecting an app itself is an authorization boundary. **Follow-up BP-11 is necessary:** Shop/Udhaar share core contact/ledger rights, and shared contact responses can contain both balance fields under that broad permission. Per-app financial-field/bucket authorization and per-user private Udhaar ownership are not certified by these tests. No unauthorized-access guarantee is claimed for all platform APIs.

## Product decisions — why these features are here

| Merchant's job | Kept/changed | Why |
|---|---|---|
| Collect from a customer | One customer balance, unpaid customer bills, receipts received, Receive payment + New bill | The amount, evidence and next action belong together. A supplier amount does not help this task. |
| Pay a supplier | One supplier balance, unpaid purchase bills, payments made, Pay supplier + Purchase bill | This is a different task, even when the contact has both flags. The customer figure/actions never appear in this view. |
| Use a shared contact | Reuse the existing identity, number, editing form and contact picker | Sharing a name/phone does not require sharing a screen or netting money. No second customer/supplier master is created. |
| Find financial evidence | Real source documents/receipts with links, using their existing Redux queries/services | A migrated or seeded book can have bills without matching ledger activity lines. An empty timeline is not proof that no bill exists. |
| Record a payment quickly | Existing lazy payment form, prefilled with the selected role's dues; phone dock and desktop header share one action component | Removes the overflow-menu tap. Pending feedback starts before the form chunk arrives. Read-only users get no empty dock. |
| Start billing this person | Existing sales/purchase editors with a one-time person seed | No second picker. Saved drafts still win. The existing sales place-of-supply rule handles both picker choices and preselected customers; a late lookup cannot overwrite an invoice-specific adjustment. |
| Review less-used facts | Existing Details panel on desktop, disclosure on phones | Contact/address/GST/collection/price-list facts stay available without dominating the counter task. Udhaar credit/opening controls are hidden in Shop. |
| Remind a customer | Existing editable Shop reminder and honest handoff log, only in Customer view | A supplier payable must not become a customer reminder. No messages were sent to external recipients during verification. |
| See both roles together | **Removed from this page** | Owner explicitly rejected "As a customer / As a supplier". The origin is carried through supplier links and dashboard supplier links, using `partyPath` once. |
| Shared Shop activity stream | **Not used in these focused views** | It mixes customer and supplier events/running balances. Source bills and role-specific receipts/payments answer the task directly. Udhaar retains its ledger timeline. |
| Shop statement | **Withheld here, known feature gap** | The legacy Shop statement nets the shared ledger. It is not an accurate role-specific customer/supplier document. Individual bill/receipt pages retain their existing sharing/printing; Udhaar's statement stays available. Build an accurate role-scoped statement as a separate piece rather than relabelling the old one. |
| Cross-role settlement | Not added | BP-08 remains unapproved. Two independent balances are never silently settled. |

The page has a wrapping name, one amount with its direction word, useful financial records and the next action. There is no new KPI strip or combined-role summary. The phone action bar clears the page/snackbar through the existing bottom-inset mechanism; desktop uses the same controls beside the title.

## Reuse and implementation

- `ShopPersonOverview` composes existing `UbCard`, `UbAmount`, contact/link/tag/badge/text primitives and the existing balance-tone helper. It does not calculate dues.
- `ShopPersonActions` is the one header/dock composition, taking one role, never a customer/supplier pair. Permission gates are shared by both placements.
- One lazy `ShopPersonRecords` renders unpaid bills and payments. It dispatches the existing Sales, Purchases and Payments thunks/services, reuses the existing query registry and refreshes on the existing person invalidation sequence. No duplicate endpoint adapter, arithmetic, Redux store or package was introduced.
- Existing payment, edit, archive, QR and reminder overlays stay lazy. Existing sales/purchase form fields, tax/stock/posting rules, validation and idempotency remain with their owning modules.
- `usePartyEditorSeed` is the shared URL contract for a fresh sales/purchase editor. No existing invoice is repriced or changed by opening a shortcut.
- Small **optional** read filters complete BP-09's role separation: sales `book=shop` excludes vertical source invoices; payment `trade_role=customer|supplier` chooses the role's Shop direction and excludes refund vouchers. The panel asks for recorded payments. Absent filters preserve the previous query/results; no response field/model/migration changes.
- The shared archive guard also refuses zero-net contacts whose two Shop roles remain unsettled. It reuses the BP-09 facts. The bulk path annotates the batch rather than querying financial sources per row. Shop cannot open an Udhaar write-off/entry drawer to resolve a refusal; a Shop refusal hands over to its existing payment form. A refusal from another book names that book instead.

**Archive remains a shared-contact action, not a new per-role detach/delete.** Per-role retirement would need its own product rule and migration/compatibility review; this piece does not invent one.

## Earlier person-build verification (before R-DEC-14 correction)

Local production standalone frontend :3000; API :8000; isolated seeded database `revamp_20261018`; test database `test_revamp_bp09`. Existing user development servers and original database were not replaced. The scale dataset has 2,000 contacts, 20,000 invoices and 100,000 ledger rows. Browser payment checks record disposable ₹1 receipts in this local test book only; no real-world customer messages or production records were touched.

| Check | Result |
|---|---|
| Frontend full Jest | **397 suites / 4,478 tests passed**; existing timer/open-handle warnings remain |
| Frontend changed-file ESLint | `--fix --max-warnings=0`; full lint not claimed (over 25 minutes in the cloud environment) |
| Type check and production build | Passed; frontend restarted after build |
| Locales / contrast | en/hi split/check, existing token contrast gate, plus browser computed contrast |
| Backend full run | 4,596 passed, 16 skipped, one timing failure in the unchanged dues scale test while other checks were running |
| Timing failure follow-up | The exact unchanged `test_five_thousand_schedules_run_under_a_minute` passed on an idle host. The 60-second threshold was not weakened. This is not represented as a wholly clean original run. |
| Affected backend regression/architecture run | **880 passed, 3 skipped** after final optional Shop read filters; covers parties, sales, payments and architecture. New cases cover zero-net archive rejection, Shop invoice origin isolation and excluding customer refunds/Udhaar vouchers from supplier payment history |
| Schema / Python style | makemigrations --check --dry-run: no changes; changed Python files checked with existing black/isort. Local ruff/mypy unavailable; not claimed |
| Bundle | See measured section below; global ceilings unchanged |

### Browser evidence

`e2e/revamp-shots.mjs --piece=person --widths=390,320,1024,1280`; Hindi at 320/1280; both themes. Reuses the existing measured text/contrast/page-width harness rather than adding a second measuring implementation. Covers live, large amount/long name, explicit supplier view for the same dual-role fixture, single role, advance, settled, archived, error, loading and menu. Additional real-flow captures include the existing payment form, busy/saved/after-payment, supplier payment and selected-person bill editors.

The old build failed on the long person name at 320 px in both themes. The new role-context assertion also rejects a two-figure overview; it is not a check that passes merely because a screenshot file exists. Before finalization the browser found clipped old activity document numbers; the combined activity stream was replaced by role-specific source record panels, whose complete document numbers wrap.

Real journeys: Customer Receive payment opens the existing prefilled drawer; New bill opens the existing editor with the selected person. At 320 a held POST plus repeated Save taps creates exactly one ₹1 receipt, then the actual customer figure drops by ₹1 while the supplier figure remains unchanged; the overview refreshes without reloading the page. Supplier Pay opens the outgoing form; Purchase bill opens the existing editor with that supplier selected. No WhatsApp/SMS/call handoff is clicked. Receipt cancellation/void behavior stays with the existing payment suite, rather than a second implementation here.

**126 measured captures passed**: 86 English and 40 Hindi. Zero measured page overflow, clipped visible main-content/dialog text or computed contrast failures. The shared global shell is outside this piece’s text sweep. In addition, the handoff editor screenshots show the selected customer/supplier; they are integration evidence, not a claim that those editors have already been redesigned.

Screenshots/contact sheets are in the host workspace `outputs/revamp/shots/person/`; final page previews in `outputs/revamp/person/`. They use local seeded data, not new real customers. `/mnt/project-files` is a cloud path unavailable on this macOS host. Raw measurement JSON is checked in under `docs/performance/data/2026-10-18-person-*`.

## Performance and bundle costs

Fresh prior commit `187266cc` and final production builds, same macOS host/isolated scale dataset. Three Shop navigations × three repetitions × 390/1280 × unthrottled/throttled = **36 samples per build**. Commands use `e2e/perf-app.mjs --reps=3 --only=nav --cases=shop.home→customers,shop.customers→bills,shop.customer row→person`; benchmark ran after builds/tests/browser captures finished. Raw before/after JSON is checked in.

| View/profile | First change p50 before → after | First change p95 | Content p50 | Content p95 |
|---|---:|---:|---:|---:|
| 390 normal | 23 → 22 ms | 30 → 29 ms | 222 → 223 ms | 450 → 438 ms |
| 390 throttled | 28 → 26 ms | 33 → 32 ms | 772 → 626 ms | 1,207 → 1,411 ms |
| 1280 normal | 25 → 25 ms | 33 → 34 ms | 431 → 434 ms | 557 → 555 ms |
| 1280 throttled | 28 → 29 ms | 36 → 34 ms | 883 → 822 ms | 1,221 → 1,421 ms |

There is **no claimed speed improvement**. First feedback remains about one frame/p95 29–34 ms, while real bill/payment panels add source reads and linked-record prefetching. The throttled aggregate content p95 grows to about 1.42 s; this is a real measured cost, not hidden by the new visual design. The sample is too small for statistical conclusions. Historical F4 cloud measurements (`2026-10-18-f4-app-button.md`, baseline `2026-10-17-app-baseline.md`) use a different host/full-app set; they describe the method but are not an absolute controlled comparator. No cross-app or installed-device speed claim is made. Speculative record-link prefetching is a follow-up optimization to measure before rolling the pattern out more widely.

Prior → final measured gzip: person route **109.8 → 111.7 KB (+1.9)**, first load **349.6 → 351.4 KB (+1.8)**; Customers shared list route **88.4 → 88.8 KB (+0.4)**; shared app **112.5 → 112.4 KB**, still under the unchanged 113 KB ceiling. Source record queries/catalogues and all forms are lazy. Four exceeded scalars across person/design-system/tags were recorded at measured +0.3 KB; no framework/shared/default budget was raised. Exact adjustments are in `2026-10-18-person-budget-adjustments.json`. `bundle:check` passes.


## Review and limits

**Withdrawn after owner review:** the following 8.97 self-rating overrated visual fidelity and treated reused old drawer presentation as an acceptable deferral. The owner correctly rejected the permanent secondary rail and the mismatch with the live Claude artifact. It is retained as history, not the current assessment.

Original provisional self-review of **this person-page piece**, using revamp/09's rubric; not a whole-Shop score or a merchant user study:

| Mobile 20% | Ease 15% | Visual 15% | Feedback 15% | Accessibility 10% | Desktop 10% | Safety 10% | Reuse 5% | Weighted |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 9.0 | 9.1 | 8.9 | 9.0 | 8.7 | 9.0 | 8.9 | 9.2 | **8.97/10** |

Functionality of the implemented role-scoped counter flows: **9.0/10 provisionally**. Feature completeness: **8.7/10**, held down by the missing accurate role-specific statement and remaining historical report consumers. Do not round this into a claim that the entire Shop revamp is complete or validated at a real counter.

Still unproven: installed low-end Android/iPhone behavior, large system text, TalkBack/VoiceOver, a full accessibility audit, offline payment queue behavior from this new placement and the planned shopkeeper task study. Existing payment/receipt form presentation is reused; its full Counter Mode redesign belongs to the payments piece. Historical Shop aging/statement consumers still need source/role/as-of design and tests; the old net statement is not exposed here. No settlement feature is implied.

## Next

Deliver/report/push this piece before another. Next approved presentation piece: Suppliers list, reusing the Customers register composition with the supplier task and its own data/actions; then Udhaar. Schedule an explicit role-specific statement/read-consumer piece before calling Shop complete. Library/Lending workflows remain frozen. See R-DEC-13 before any next person-related screen: choose the user's task, not every capability of the shared data model.

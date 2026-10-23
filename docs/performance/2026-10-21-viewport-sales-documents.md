# Remaining sales lists — approved composition and bounded rows

21 October2026, parent477916b1; R-DEC-29/31/32. Review09 §1 before building.
Estimates, Orders, Challans and Credit Notes share SalesFlowListPageContent,
not the delivered Bills register. Code still uses tall stat cards and hides
phone status inside Filters. This disagrees with the approved visible-status,
compact register composition. Record it here and in12 rather than polishing it.

| Requirement | Reuse/implementation | Check | Status |
|---|---|---|---|
| Approved phone/desktop register | UbViewportPageShell, UbDataGrid register/stacked cards, RecordTotals |320/390/1024/1280 themes +Hindi |Pending|
| Status within one tap;32px face/44px target | Existing UbChoiceChips; status retained when period applies | Actual per-kind API tab query +hit tests |Pending|
| Pinned paging; rows only scroll | Existing fillHeight and clearance | Footer hit test, second page, short/offline |Pending|
| Correct document identity and financial meaning | Existing kind/status/route and server totals | No invoice debts on an order/quote; no generic New return |Pending|
| Search survives URL/clear updates | Existing useCommittedSearch | Fail-before external-query reset +browser query |Pending|
| Kind-specific read/write access | Existing useSalesFlowList permissions | No-read/write states and section links |Pending|
| No word cut | Existing wrapping text and formatters | Long RKE electrical/electronics names and₹12,40,378.00 |Pending|

Need: counter staff must find a pending quotation/order/delivery/return without
an extra status-filter trip, and page without scrolling the whole document.
No new financial workflow, conversion rule, API shape or engine is authorized
by this layout piece. Customer/Supplier/Udhaar roles stay separate. No claim of
competitor superiority or whole-module completion without evidence.

Review found/reproduced before correction: old query text survives an external
URL change (5 component regressions including four visible-status checks fail);
Challans fall into the credit-note Open credit column (1 failing regression);
a slow same-filter total and previous-kind failed request overwrite newer state
(2 failing reducer regressions). Use the existing Purchases latest-request
pattern, not a second cache/engine. No backend or financial posting change.


## Owner correction ·22Oct2026 (R-DEC-33)

First frame sweep is NOT accepted: desktop names inherited nowrap, the old FAB blocked the phone pager, and duplicate global/list search consumed height. Stop the earlier QA run and retain its red frames/logs. The owner now explicitly requires distinct phone cards with scroll loading.419 suites/4,656 tests and the prior build are intermediate gates only, not final delivery.

The fixture helper's initial challan404 was its wrong helper URL, corrected to the existing /sales/delivery-challans.104 draft-only local API fixtures (26/kind) exist for real paging; no issue/payment/stock-posting action was requested. Parent477916b1 rebuilt; populated320px checks fail with1741px document overflow, cut names and missing compact summary/status. No final sales-list score is assigned.


##23Oct owner-requested IN-PROGRESS Git checkpoint

Not delivered acceptance. Exact current source has the1280 breakpoint/identity-date correction; fresh complete browser sweep/LOOK/A-B remains required. Previous full gates421/4663 predate this final compact fix; latest focused11 tests and production build pass.75 backend checks passed before these presentation-only changes. Preserve original red1024 frames and infrastructure failures. The23Oct continuation appended to BOTH revamp prompts is authoritative for next steps. No final score assigned.

Exact23Oct checkpoint verification: changed-file lint0, type-check0,7 focused suites/84 tests pass (3.864s); latest production build passed. Full final browser/LOOK/A-B remains pending.


## 23 Oct 2026 (afternoon) · Sales-document lists verified on the exact checkpoint

Scope: Estimates, Sales orders, Delivery challans and Credit notes registers
(R-DEC-33). Feature by feature (R-DEC-34): this closes this list group only.
Bills, Customers, Suppliers and Purchases mobile follow-up is NOT done.

**Gates on 4c73fe5 + budget note:** type-check 0, lint 0, Jest 421 suites /
4,667 tests, production build, i18n split/check (6,685 keys). Bundle: 35 routes
were up to 0.1 KB over first load from the shared list composition; only those
scalars raised to measured + 0.3 (a59cfab). Real JS asset served 200.

**Fixture defect found first.** In a fresh container the QA tenant had 20,013
invoices and none of the four kinds (`seed_scale` writes invoices only), so the
first sweep's every "ready" frame was really first-use and all widths failed
"missing compact summary". `e2e/seed-sales-flow.mjs` now fills each kind through
the real API (60 each; nine in ten sent/confirmed/issued, credit notes as drafts
against paid bills to a saved customer — the server correctly refuses a return
against a quick sale). Challan issue moves stock on the local QA tenant only.

**Sweep (`revamp-bills.mjs`)**, all four kinds, English 390/320/1024/1280 light
and dark, Hindi 320/1280, states ready, long name + large amount, offline,
short 600 px (phone), filtered-empty, loading, first-use, error and filters:
**all passed** — no cut text, no low contrast, no overflow, no page scroll, 32 px
chip faces with 44 px phone hit, no blocked footer action. The earlier red 1024
frames (clipped dates, clipped challan title) are fixed: LOOK at 1024 shows the
date joined under the customer and long numbers wrapping.

**Mobile contract (`mobile-sales-contract.mjs`)**, four kinds × 390/320/1024/
1280 × light/dark: **passed**. Phone: 25 joined cards, no table, no pager, no
FAB, one list search (40 px, matching the 40 px Filters), 44 px global search
icon, active chip visible, cards 62.0% of the viewport, no eager page 2, a failed
append keeps every card and offers a 44 px Try again that appends the real page
2 without resetting scroll, a new query resets. Desktop: table and pager. The
harness asserted exactly 26 cards (the writer's tenant size); it now adds the
page-2 answer's own row count.

**LOOK findings fixed:** Hindi "Draft" was spelled ड्राफ़्ट on the chip and
ड्राफ्ट on the badge beside it; twelve strings now use the plain form already
used by thirty-three (8ad6ae2). Rechecked at 320/1280 after a rebuild.

**Performance, old 477916b vs new, alternated old/new/old/new, 3 reps × 4
cases × 2 rounds = 24 per cell** (`perf-app.mjs --only=nav`, bills → each list;
data `data/2026-10-23-sales-lists-nav-ab-*.json`):

| viewport | profile | content p50 old → new | p95 old → new | INP max old → new |
|---|---|---|---|---|
| 390 | 4x CPU | 756 → 805 ms | 1151 → 1124 | 104 → 96 |
| 390 | unthrottled | 137 → 138 | 409 → 435 | 32 → 56 |
| 1280 | 4x CPU | 737 → 765 | 1142 → 1277 | 96 → 96 |
| 1280 | unthrottled | 144 → 149 | 186 → 192 | 24 → 16 |

The phone 4x-CPU median is slower in BOTH rounds (733/763 old vs 805/794 new),
about +50 ms (+6%); old's own round spread is 30 ms, so this is recorded as a
small regression, not noise. Cause not yet profiled (likely the joined-card
rendering). Desktop differences are mixed within spread.

| Point of view | Score | Evidence | Still weak | Confidence |
|---|---|---|---|---|
| Function | 8.6 | Live API paging, search, status chips, append failure/retry, query reset, desktop pager, 4 kinds | No new write workflow in scope; credit-note open/applied tabs empty in QA data | Medium-high |
| Busy shop | 8.3 | 62% of phone viewport is cards; one search; scroll-next | 1024 px stacks header on three lines, rows get 45%; desktop credit-note draft row says Draft in caption and badge | Medium |
| UI/UX phone | 8.5 | Sweep clean EN/HI, light/dark, 320/390 | Chip strip edge-cut is the scroll cue only | Medium |
| UI/UX desktop | 8.3 | Sweep clean 1024/1280 | 1024 header density as above | Medium |
| Performance | 7.9 | 24-sample A/B per cell | Phone 4x CPU +50 ms median, unprofiled | Medium |

Competitor comparison: no new dated competitor evidence was gathered this
session, so any advantage over Vyapar/myBillBook lists is **unproven**. Not
above 8.5 overall; not a whole-Shop or all-module claim.

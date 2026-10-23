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

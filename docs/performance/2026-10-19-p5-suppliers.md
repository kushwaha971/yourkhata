# Phase 5 · Suppliers register

19 October 2026. R-DEC-16. Scope: Shop Suppliers register, filter/sort, and opening the existing outgoing Shop payment flow. Customers, Suppliers and Udhaar remain separate; no posting engine or Library/Lending contract changes.

## Design and product result

Suppliers now uses the same Counter Mode register composition as Customers: connected phone rows, desktop table, compact search and equal-height filter control, scoped totals, draft filter sheet and URL-backed search/sort. Four customer-named compositions were renamed to shared ShopParty components rather than copied. A supplier debt leads with red **To pay** and **Pay**; an advance is explicitly **Advance with supplier**. Dual-role contacts show **Also a customer**, with only supplier money here. A row opens the existing supplier person context; Pay does not also navigate the row.

The backend's supplier count aggregation previously treated its negative list projection as a customer debt: owing and advance counts were reversed. Counts now aggregate the underlying role-specific positive supplier liability. Sorting also translates supplier liability magnitude to the signed server order. Neither change rewrites financial records.

Visual review found customer words left in the supplier summary, error and phone loaded footer; regression coverage now identifies those states by role. Last activity remains honestly named **Last Shop activity**, since that fact is shared within Shop rather than a supplier-only historical statement.

## Provisional review

Scope is this piece, not Shop overall; these are design/engineering assessments, not merchant-study scores. Rubric: revamp/09 §1.

| Mobile | Ease | Visual | Feedback | Accessibility | Desktop | Safety | Reuse | Weighted |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 8.7 | 8.8 | 8.8 | 9.0 | 8.6 | 8.9 | 9.0 | 9.0 | **8.83/10** |

Implemented functionality: **8.8/10**. Whole-spec feature coverage: **8.4/10**, held down by the server-backed future “Due this week” filter (P-08-03), historical role statements (BP-10), and explicit cross-role settlement (BP-08). None is simulated by filtering one downloaded page or netting balances. Real-device PWA keyboards, assistive technology, large system text and 5–8 merchant task sessions remain unproven. Phone quick chips still scroll horizontally.

## Verification

Final frontend gates: **398 suites / 4,489 tests passed**, changed-file ESLint `--fix --max-warnings=0`, TypeScript, production build, bundle budgets, 174 contrast pairings and split/checked locales (6,494 keys) passed. Full lint was not run: it can exceed 25 minutes in the cloud container; changed files were checked as instructed. Existing console/open-handle warnings remain. The initial complete frontend run passed 398 suites / 4,487 tests. Visual review then added two role-copy regressions; an intermediate run exposed a test setup retaining the same-query cache, corrected by isolating the two cases. Do not present that intermediate run as green.

The narrow backend regression passed 12 tests and demonstrably fails against the previous supplier counts. Live local browser checks verify debt and advance filters, outgoing Pay, cancellation, supplier person context and Back. On the isolated revamp database a ₹1 supplier payment with a double tap produced one POST, reduced supplier liability by ₹1 and left customer balance unchanged. No production payment was made.

Old-build calibration: stress text clipping was detected at 320 and 1280; new geometry checks measure text-node boxes and actual ancestor clipping, page overflow, and computed foreground/background contrast. They do not substitute for a general accessibility audit. Form/error/empty/loading/busy states use explicitly intercepted responses and are labelled presentation fixtures; ordinary live rows and payment writes use the real local API.

### Browser evidence

- **123 measured Supplier states**: 390/320/1024/1280 light/dark English; 320/1280 light/dark Hindi. Includes live, large amount/long name, filter, empty, no matches, error, loading, busy/refreshed and outgoing-payment states; the 320 light case additionally captures busy/save/receipt. **Zero page overflow, measured clipped text or low-contrast labels** in this matrix. The English role-copy assertion fails against the previous build (six states); the fixed matrix passes.
- Real flows verify signed debt/advance server results, no customer reminder on Suppliers, Pay versus row navigation, supplier person context and Back, unique phone append paging, one outgoing POST for a double tap, correct Shop/selected supplier payload, balance persistence after reload, and receipt navigation. ₹1 local test payments only; not production.
- **72 measured Customer regression states** (320/1280, en/hi, both themes), plus Customer network/user-journey checks, pass after the shared-composition reuse. Existing Customer search, filter draft cancellation, Back, paging, editable Shop reminder and cancel-without-send checks remain green.
- Final contact sheets were generated and all twelve Supplier sheets visually inspected. Images live in the task workspace `outputs/revamp/shots/suppliers/`; raw layout results are the two `2026-10-19-suppliers-layout-*.json` files alongside this report. The historic `/mnt/project-files` location does not exist on this Mac, so the task workspace is used.
- Receipt navigation works, but the existing receipt document layout is not the completed Counter Mode receipt redesign; that remains the payments/receipt piece. Screen-reader, physical-device and merchant usability studies are not represented by these browser checks.

## Business coverage added at the owner’s request

`apps/purchases/tests/test_shared_products.py` records a complete Radhe Krishna Enterprises API scenario: Supplier A and Supplier B both sell the same LED bulb and electrical switch, at different costs; Customer X and Customer Y buy those same products at different prices. Each document has multiple lines. The test independently checks weighted-average inventory cost, remaining quantities, the first purchase bill retaining its original prices, invoice overrides preserving item defaults, distinct supplier/customer liabilities, and correct role-filtered lists. No product is restricted to one supplier or customer.

Expanded backend gates: all party/payment tests and query budgets **544 passed**, book access/app grants/tenant-data tests **62 passed**, all purchase/sales tests **322 passed**, new shared-products business test **1 passed**. These are API/domain tests, distinct from the real browser payment journey. Existing Django converter deprecation warnings remain. No production database was used.

## Remaining work

Finish Shop Home next, then remaining Shop billing/purchase/item/stock/money/report families under R-DEC-16, before another app. Unapproved backend business-rule proposals stay proposals. No whole-Shop or whole-app completion claim; no production deployment/migration claimed by this piece.

## Navigation and delivery cost

`e2e/perf-app.mjs --reps=3 --only=nav --cases=shop.home→suppliers,shop.supplier row→person` on idle local production builds: 24 samples each, 390/1280, unthrottled and simulated throttling. Same two paths measured before and after; raw files alongside this report. Six samples per cell are a small lab comparison, not a production percentile claim. No measured speed improvement is claimed.

| View/profile | First visible change p50 / p95 before → after (ms) | Content p50 / p95 before → after (ms) |
|---|---:|---:|
| 390 unthrottled | 3 / 31 → 4 / 33 | 135 / 196 → 126 / 153 |
| 390 throttled | 7 / 33 → 5 / 34 | 530 / 1246 → 522 / 1218 |
| 1280 unthrottled | 2 / 34 → 1 / 27 | 128 / 473 → 135 / 517 |
| 1280 throttled | 2 / 29 → 4 / 32 | 841 / 1247 → 823 / 1249 |

First feedback remains within the existing foundation's envelope; content varies, including the 1280 unthrottled tail increasing 44 ms. F4's broader 48-path throttled p95 was 168 ms (excluding Lending Today); the pre-foundation baseline was 819 ms across 57 paths. Those cohorts differ from these two Supplier paths, so they are context, not a like-for-like claimed improvement. No real-device or cold-start speed claim.

Bundle gate: baseline every route 239.7 KB gzip (framework 127.3 + shared app 112.5), within unchanged budgets. Existing payment/filter overlays remain dynamic imports. No package, schema migration or budget increase.

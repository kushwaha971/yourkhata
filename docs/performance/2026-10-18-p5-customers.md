# Phase 5 · Customers register and approved BP-09

18 October 2026. R-DEC-10/11/12. Scope: **Shop Customers list, its filter drawer and customer-level reminder**, with the role-aware reads required to keep its person header and Shop home totals consistent, and an explicit Shop reminder/history context on the existing person page. This is not the completed person-page redesign, Suppliers redesign, whole Shop or whole-app revamp.

## Result and design review

The list now uses the approved Counter Mode artifact's composition: search and quick views, scoped sentence below the controls, a register table on desktop and connected name/amount/action rows on phones. No KPI-card strip. The main action is marigold; applied views use teal. Long names wrap; money retains Indian grouping and decimals. The existing app shell/tab order is retained under R-DEC-09; the artifact's older shell is not copied.

At 1024/1280 the toolbar wraps into search/actions and a separate quick-view row, so filters do not disappear behind a tiny remaining lane. At wider desktops the controls share a row. The table gives money and late badges enough room at 1024. The existing Add/Import/Export/Tags, selection/bulk tools, searchable tag picker, URL filters, permissions and global error handling remain reachable. Phone Show more appends unique records and a new search replaces the set.

The filter drawer uses draft chip choices and a debounced server count. Closing cancels the draft; Reset edits it; Show applies once. It includes authoritative bill-age filters as well as the existing collection-date filter, explicitly named separately. The selected Shop sort is present in its menu.

### Provisional review — this piece only

These are engineering/design self-assessments, not measured merchant satisfaction or a rating of the whole application. Rubric: revamp/09 §1.

| Mobile | Ease | Visual consistency | Feedback | Accessibility | Desktop | Safety | Reuse | Weighted |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 8.8 | 9.0 | 8.9 | 9.1 | 8.7 | 8.8 | 9.2 | 9.0 | **8.93/10** |

Functionality review: **9.0/10 for the implemented list/filter/reminder scope**. Feature coverage against the artifact: **8.8/10**: explicit cross-role settlement is not approved/built (BP-08), so a dual-role customer has an honest Remind/View bills action rather than a fake Settle action. The full person-page redesign and the rest of Shop remain next. Do not describe the entire revamp as 9/10 or complete.

The strongest remaining limitations are real-device/PWA keyboard testing, TalkBack/VoiceOver, larger system text, and the 5–8-shopkeeper task study. Desktop retains more existing utility actions than the artifact. A count/contrast sweep is evidence of those properties, not proof of overall accessibility or delight.

## Approved Shop facts and compatibility

`apps/parties/selectors/shop.py` is one deferred-import read seam, not another posting engine. SQL aggregates existing outstanding bills, remaining credits and usable recorded advances separately by role. Existing refund/earmark exclusions are reused. No posting, allocation, stock, document or cached balance is rewritten; no model/migration added.

- Customer due ₹1,000 and supplier payable ₹600 remain ₹1,000 and ₹600, never ₹400. A supplier payable cannot become customer advance. Customer/supplier list totals, person role header and Shop home collection/payment panels use the same facts.
- Bill lateness uses the tenant's date and actual unpaid due dates, excluding drafts and settled balances. It is not the collection promise date or a browser-clock calculation. Null due dates are named honestly.
- Shop activity is derived from Shop ledger/document events; Udhaar and vertical documents do not supply the Shop fact.
- Optional `book=shop` reminders compose from the fresh customer-role Shop figure. The existing editable shared message box passes the merchant's final words to WhatsApp/SMS and the log. Opening/cancelling creates no reminder. Manual handoff is not delivery. No-book requests keep Udhaar behaviour; source-based Library/Lending reminders are unchanged.
- Existing Shop `shop_balance` remains for old consumers. The new additive `shop` fields are authoritative for the updated screens. No silent data migration or destructive conversion from the combined cache.

**Remaining read-consumer gap:** historical Shop aging/report drill-downs still use the older net ledger aging selector, rather than the new role-specific outstanding-document facts. They are not claimed fixed by this Customers piece; the reports screen needs its own specification and regression coverage, including dual-role/as-of behavior. The new role-aware headline should not be used as proof that every existing historical report reconciles. Person actions/timeline also still await their dedicated redesign and consumer audit.

## Verification

Isolated local PostgreSQL database `revamp_20261018`, seeded scale owner; original development database untouched. Scale book: 2,000 parties, 5,000 items, 100,000 ledger lines, 20,000 sales documents. Separate reused test database `test_revamp_bp09`. Local API :8000, production standalone frontend :3000. Existing user servers :3100/:8100 untouched. No real customer messages sent.

| Gate | Result |
|---|---|
| Full backend pytest | Exit 0; 4,596 passed, 16 skipped; existing deprecation/unordered-test-query warnings |
| BP-09 focused backend tests | 9 passed; separate roles, dashboard/list reconciliation, credits, advances/refunds, due filters, tenant isolation, constant SQL query count, fresh reminder snapshot/final text and book history |
| Full frontend Jest | 394 suites / 4,467 tests passed; existing timer/open-handle warnings. Includes the Shop person reminder, book-scoped history, stale cross-book response, selected sort and row-action permission regressions |
| Changed-file ESLint | `--fix --max-warnings=0` passed. Full lint is not claimed; it takes over 25 minutes in the cloud environment |
| Type check / production build | Passed; frontend restarted after each build |
| Bundle gate | Passed with explicit measured route-budget adjustments; global framework/shared ceilings unchanged |
| Locales / token contrast | i18n split/check and check:contrast passed |
| Schema | makemigrations --check --dry-run: no changes |
| Python formatting | Changed files checked with existing black/isort; ruff/mypy were not available in the local venv |

The report tests previously set only `Party.shop_balance`, with no bills behind it. Fixtures now explicitly create matching historical documents/adjustment advances; tests already creating bills do not add them twice. The randomized reconciliation test replays source rows independently in Python, rather than calling the production SQL or trusting the cache.

### Browser evidence

`e2e/revamp-shots.mjs --piece=customers --widths=390,320,1024,1280`, then Hindi at 320/1280, light/dark. **108 state captures**: live, long-name/₹12,40,378.00/dual-role stress, filters, first-use empty, filtered empty, error, loading, busy, refreshed. Zero measured page overflow; zero clipped visible text in the new main content/dialogs (the existing global shell is outside this sweep); zero computed label contrast below 4.5:1 in the final sweep.

The harness measures text-node rectangles against their own boxes and clipping ancestors, computed foreground/background colours, and page width. Responsive screen-reader-only labels are excluded using their computed clipping/1px geometry, not by ignoring visible text. The old layout failed at 320 with 16 clipped names, and the first BP-09 build failed at 1024 on amounts/late badges; the same checks pass after the fixes. This is calibration against actual failures, not a screenshot-exists test.

Real seeded user journeys at 320/1280 verified draft cancellation, network-backed Shop-only search, opening a person and Back restoring the query; phone Show more adds rows without duplicates; Shop preview carries book=shop, its text is editable, the WhatsApp URL carries the edited words, and cancellation sends no reminder-create/send request. No external handoff is clicked. Saved-money behavior is covered by existing regression suites, not falsely represented by the read-only refreshed screenshot.

Final demo images use intercepted presentation responses with the artifact's example names/₹18,450; they do not represent newly created business records. Actual journeys and performance use the real scale API. Two additional integration screenshots show the existing person page’s Shop reminder at 320/1280; that action was previously hidden in Shop, and now uses the same approved Shop preview/send flow. Both its history strip and the Udhaar Sent tab name their book explicitly; legacy no-book service calls retain their old query shape. Host screenshots: workspace `outputs/revamp/customers/`; state/contact sheets: workspace `outputs/revamp/shots/customers/`. The Linux `/mnt/project-files` path is not available on this macOS host.

## Performance and bundles

Fresh original HEAD and changed production builds on the same macOS host, same seeded database, three repetitions per navigation, 390/1280, unthrottled and the harness's throttled profile, otherwise idle host. Only `shop.home→customers`, `shop.customers→bills`, `shop.customer row→person`: **36 samples per build**. Raw results and measured budget adjustments: `docs/performance/data/2026-10-18-customers-{before,after}.json` and `...-budget-adjustments.json`.

| View/profile | First change p50 before → after | First change p95 | Content p50 | Content p95 |
|---|---:|---:|---:|---:|
| 390 normal | 24 → 24 ms | 30 → 31 ms | 91 → 221 ms | 106 → 449 ms |
| 390 throttled | 28 → 26 ms | 31 → 32 ms | 775 → 763 ms | 1,184 → 1,230 ms |
| 1280 normal | 23 → 24 ms | 35 → 33 ms | 99 → 442 ms | 420 → 550 ms |
| 1280 throttled | 29 → 29 ms | 35 → 35 ms | 864 → 884 ms | 1,212 → 1,250 ms |

There is **no claimed speed improvement**. Immediate feedback remains prompt; authoritative role/age/count reads and the larger screen chunk increase unthrottled content readiness. Throttled tails increase by 38–46 ms in this small sample. Inspect per-route samples before interpreting an aggregate; three repetitions cannot establish statistical significance or low-end device behavior.

The F4 reference is `2026-10-18-f4-app-button.md`, with the full method/baseline in `2026-10-17-app-baseline.md`: its cloud host/full-app cases are not a controlled absolute comparator for this Mac/three-Shop-case run. Library/Lending are not enabled in this isolated scale tenant; no cross-app speed result is claimed and no app was enabled just to produce a benchmark.

Fresh same-host HEAD → final: Customers/Suppliers/Khata shared route chunk **83.6 → 88.4 KB gz (+4.8)**. Framework **127.3 KB**; shared app **112.1 → 112.5 KB (+0.4)**, still below unchanged 113 KB ceiling. Customers final first load **328.2 KB**, below existing 344 KB ceiling. A lazy reminder wrapper keeps the composer/share controls out of the list's static chunk. The opt-in grid/display changes affect other routes; 167 exceeded per-route/first-load scalars (including four sub-rounding excesses) were explicitly updated to measured +0.3 KB in bundle-budgets.json, with the reason beside them. No framework/shared/default ceiling was raised.

Reproduce Shop timing with `NODE_PATH=<existing Playwright runtime> CHROME=<Chrome executable> node e2e/perf-app.mjs --reps=3 --only=nav '--cases=shop.home→customers,shop.customers→bills,shop.customer row→person' --out=<json>`. Do not benchmark during Jest/build/screenshots.

## Next

Deliver this piece and push dev before building another. Next approved piece: the full Shop person page, following `07-screens/08` §3 and Counter Mode composition, including its forms/actions/remaining Shop read consumers. Then Suppliers and Udhaar, separately. Remaining shell features, BP-01…07 and BP-08 settlement are not approved. Library/Lending presentation work stays separate and their contracts remain frozen.

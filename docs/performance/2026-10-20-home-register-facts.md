# Home register source facts and Shop read boundaries

20 October 2026. BP-15 read follow-up, with the standing R-DEC-18 source-access
corrections. Read checkpoint verified; do not call the full Home feature set complete.
The owner approved BP-08/16/17 in R-DEC-26; those new workflows remain next.

## Review and change

The Home register had no source-backed status/item count. The existing Counter
read now optionally accepts at most ten kind/UUID references from the already
visible activity feed. No-parameter responses retain their shape. Each source
needs its own module/read permission, trusted tenant and Shop origin; foreign,
unreadable or unsupported source records reveal no facts. One grouped query per
readable document type counts lines, not quantity or stock units. Amount due is
the stored source value. Overdue uses the existing read-time overdue predicate,
not a second formula or a guess from the screenshot.

The UI requests the bounded IDs with the existing Counter read, adds count and
current status to the existing responsive register, and hides unknown/pending
facts rather than inventing Paid or zero items. A credit note is not called an
unpaid sale. A cancellation event does not repeat its own cancellation label.
The hook keys results by actor/business/revision, dashboard generation and source
IDs, so a same-actor payment refresh cannot briefly keep an old paid/unpaid badge.
Detail-only words use a route catalogue, not every report's first-load strings.
Existing components, money formatting and editable reminder flow are retained.

## Source defects reproduced

The read audit reproduced Library-origin sales in the Shop register and billed
figure: a₹100 Shop bill plus a₹900 Library-origin bill returned₹1,000. The old
sales graph independently failed the same₹100 expectation. Shop queries now
reuse one origin predicate across feed/tiles/periods/order counts/first-use,
chart sales/profit/top items/customers and the existing Shop party/list/repeat
filters. Only another app's data is excluded; no document, ledger, stock, tax,
Library or Lending posting/calculation/workflow is modified. The dashboard
snapshot version changes so old unscoped cached data is not reused.

The graph's all-time range also started at a personal Udhaar payment date. A
fail-before test reproduces2001-01-01 instead of the empty Shop's current date;
its first-payment query now uses the same Shop bucket as the money series.
This is a read-source correction, not a new financial business rule.

## Verification

- Full backend: **4,673 passed, 16 skipped, 8 warnings**, 473.97s, isolated
  from frontend/build/browser workload. This run includes the previously timing
  sensitive scale test. Focused source/metadata group:58 passed.
- Full frontend: **408 suites, 4,547 tests passed**, 89.281s. Changed-file ESLint
  with `--fix --max-warnings=0`, type check, production build, bundle check,
  174 contrast token pairs and i18n split/check pass (6,602 keys,57 catalogues).
  No bundle ceiling raised. Full cloud lint exceeds25 minutes; changed files
  were linted as required. Black/isort pass; Ruff is absent in both local venvs.
- **168 Home frames**:390/320/1024/1280 light/dark English and320/1280 both
  themes Hindi. Measured0 page overflow,0 cut text,0 low-contrast labels.
  Includes metadata-loading/failure, source status/count, empty/first-use,
  loading/error/offline, tabs, expanded reports and long names/large row amounts.
  Twelve contact sheets were inspected; native register crops were inspected too.
- Fixtures explicitly bind two feed rows to independently readable **real** sales
  and purchase IDs; line counts are checked against each source's detail API.
  This prevents a receipt-only feed from vacuously passing metadata acceptance.
  Some source fixtures are drafts; their actual status/zero lines are retained.
- Fail-before evidence: Shop feed/tile/graph isolation; all-time Udhaar date;
  UI status/item count; same-actor refresh freshness. The browser acceptance also
  fails the old build with missing bounded source facts. An initial receipt-only
  baseline was vacuous and was replaced before accepting that evidence.

## Navigation and limits

Quiet12-sample Home→Customers run, three repetitions each; ms p50/p95 first change
and p95 content:

|Viewport/profile|First change|Content p95|
|---|---:|---:|
|390 unthrottled|31/32|240|
|390 throttled|30/32|773|
|1280 unthrottled|29/33|566|
|1280 throttled|28/29|1132|

F4's different48-route sample had throttled first-change p95 168ms excluding
Lending Today; baseline was156ms. These narrower local samples cannot establish
an improvement over those runs or over the immediate parent (no same-parent
before was taken). No speed-gain claim. Raw data is committed beside this report.

Artifacts: `artifacts/shop-home-register-2026-10-20/` in the chat workspace,
including final mobile/desktop captures,168 state frames and contact sheets.
Physical phones, installed PWA, TalkBack and merchant research remain unproven.
This fixes source accuracy and two missing register facts; it does not certify
all Home features. Keep the prior scoped8.76 screen/8.8 implemented-flow review
and8.2 whole-reference-parity score until the newly approved workflows are built
and assessed. Library/Lending financial contracts are unchanged.

## Real payment refresh

Phone320 and desktop1280: one local₹1 payment each in the final flow run,
rapid double tap yields one POST, correct Shop/customer allocation, source due
falls by exactly₹1, and Home reads the new amount due and actual line count.
Twelve flow frames plus two dark read frames pass geometry/contrast checks.
Two earlier local₹1 payments also posted before harness corrections: the first
failed reading a response body after navigation; the second used an invalid
fixture event name. Neither was a product save failure; all four local writes
remain in QA history (216→215→214→213→212). No external message was sent.
The final harness retains the payment body before navigation and uses the real
`sale` event type. Production/Railway data was not touched.

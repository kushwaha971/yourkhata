# Purchase register — mobile-first revamp and acceptance

21 October2026, dev; continues1d7b09ec, R-DEC-27/29/30. Scope is07-screens/09 §5:
Purchases register and the shared order/return-list presentation. Purchase
editor §7 is already delivered. Purchase detail, actual order conversion and
return workflows remain the next pieces; this is not whole-Purchases completion.

## Review and product purpose

The old phone design hid status choices inside Filters, used large stat cards,
cut long suppliers, omitted the supplier's paper number and left pagination
below a page-growing list. The old390px browser check measured1229px document
overflow and a pager at y1907–1984 on an844px viewport. Existing tests passed.

The new composition uses a compact server summary, search/period, visible
sideways status chips, readable supplier/paper/status/due rows, header Record
bill and section links. On phones the section links stay in a worded More
sheet, while Record stays in the header; no FAB covers rows or pagination.
The two money figures use columns at phone widths. Desktop has full columns
from1280; at1024, paper identity/date join the supplier cell so money stays
readable. No primary register needs sideways table dragging.

R-DEC-30's available-height frame accounts for actual header/notices, dynamic
visual viewport and the existing nav offset. Only rows scroll; pagination and
primary actions stay outside. The scroll region has a name and keyboard focus;
new pages reset its row offset without scrolling the document. Table headings
stay sticky. Ordinary pages do not opt in or acquire this sizing behavior.

Value at a busy counter: identify a supplier's actual paper number, reach Record
without scrolling, switch To pay/Overdue directly, page without losing controls,
and return from a real bill with query intact. No speculative bulk payment or
unsupported next action is added. The report is a local self-review, not field
research with merchants.

## Shared architecture and business safety

Reused UbDataGrid, UbChoiceChips, UbPeriodSelect/FilterSheet, RecordTotals,
useCommittedSearch, existing date/money helpers and purchase API/slice. New
UbViewportPageShell reuses UbPageShell markup and owns only the opt-in measuring
hook. DataGrid fillHeight owns the row region/pager. Future register migrations
use these; previously delivered Customers/Suppliers/Bills are not all migrated
by this piece. No copied table, search engine, financial engine or new package.

Meaningful failures were reproduced before corrections:

- Shared page/grid tests fail on old components. Real old-build scrolling and
  supplier text checks fail. The first new layout also let absolutely positioned
  screen-reader text escape its scroller; a relative row boundary fixes it.
- Only due-window changes kept stale totals because sameFilters omitted due
  fields. An isolated regression clears old totals on that change; request IDs
  also reject late failures/fulfilments. It does not claim all API access audited.
- Empty months claimed first-use; Clear filters retained the empty period.
  Used-book emptiness now gives filtered recovery and Clear returns to the
  existing FY default through the shared date resolver.
- A new page kept the prior row scroll offset: failing regression, then reset.
- A newly inserted offline banner on desktop did not resize the list. The
  browser sweep fails before observing the containing shell column, then passes.

Financial meaning stays server-owned: bought/due totals cover the filtered set,
not just25 rows; customer money and personal Udhaar are not added. Orders do not
owe money; return credit stays neutral and is not called a supplier payable.
Plain list words say Record bill, To pay, Cancelled and Returns to supplier;
API statuses, routes, request/response keys and statutory documents stay intact.
Cost remains available only under existing purchase read rights. No backend
app code/schema, stock/pricing/allocation, weighted-average returns or
Library/Lending endpoint/workflow changed. No production or Railway data.

## Verification and LOOK

Final416 suites /4,647 frontend tests pass (104.104s); changed-file ESLint
--fix/max-warnings0, types, locale split/check, standard production build,
bundle gate and174 contrast pairs pass. Full cloud lint exceeds25minutes;
changed-file lint is used. Existing worker/act/network-test warnings remain in
raw logs. One intermediate full run includes the deliberately failing new
page-scroll regression; it is retained rather than relabelled green. Full Jest and build ran sequentially. Standalone frontend restarted after build.

All80 purchase backend tests pass in an isolated test database; only existing
Django converter deprecation warnings. They cover list filters/totals, access,
stock/prices, duplicate number rules, many suppliers/products and returns.
No new backend behavior is implied by rerunning that suite.

Final effective240 frames:390/320/1024/1280 light/dark plus Hindi320/1280
light/dark. Real list, row/keyboard scroll, page2, real supplier-paper search,
loaded detail→Back with query preserved, To pay, mobile filter sheet, loading,
first-use, filtered/period-empty, recovery, large/long rows, short600px phone,
offline banner, orders and returns entry states. Actual reads on the local
scale book; loading/error/empty/stress are explicitly intercepted UI fixtures.
No bill, payment or message is created by this harness.

Measured: page width, actual document height, each text node against its own
box, computed foreground/background contrast, row scroll and pager position.
Final zero page overflow, cut labels, active-label contrast failures and runtime
errors. Pager position is unchanged when rows scroll. Sideways chip options are
measured against their own boxes; intentional scroll exposure is not counted
as a cut by a distant clipping ancestor. The old supplier's own truncation still
fails, so this correction does not excuse clipped row text.

LOOK caught harness issues too: Back was checked before detail had rendered;
clear/retry snapshots raced ahead of loaded rows; a visual fixture said Overdue
while using a future due date and stale totals. Final harness waits for the
real screen/rows and uses a consistent75-bill fixture (₹12,40,378 each,
₹9,30,28,350 total/due, past due dates). A new hit-test also proves error toasts covered Next page before the fix. The
pinned footer now reuses UbBottomBar/useBottomInset with an explicit clear-to-
viewport-bottom option; existing bars keep their default behavior. The final
clean240-frame sweep includes pager hit-testing, loaded recovery rows and the
consistent visual fixture. Earlier reds/corrections remain separate data.
Six contact sheets and native phone/desktop/Hindi/short-height frames inspected.

Artifacts: chat workspace artifacts/purchase-register-complete-2026-10-21/.
Reproduce: e2e/revamp-purchases-register.mjs, then --locale=hi --widths=320,1280.
Optional --states isolates captures while retaining the read journey. Raw
results/logs and final performance data are in data/2026-10-21-purchase-register/.

## Bundle and performance

Measured register83.4KB route/324.8KB first load, versus same-machine clean
worktree83.9/325.3. Shared app114.2KB/framework127.3 unchanged. The unsplit
viewport experiment exceeded157 existing ceilings; separating the measuring
component reduced that to35 before the final toast-clearance guard. Final61 exceeded scalars
use measured+0.3KB with rationale in bundle-budgets.json; no default/framework
ceiling or package added. A clean baseline worktree itself exceeds101 tight
ceilings by mostly rounding-sized amounts; that red budget result is retained,
not attributed to this feature. The final production build's gate passes.

Same Mac/API/QA data/browser, otherwise idle: clean1d7b09ec worktree and final
build alternated old/new/old/new, reps3,390/1280, unthrottled and CPU×4 /
150ms RTT /1.6Mbps down. Phone measures selecting Purchases in the already-open
App sheet; it does not include opening that sheet. Desktop uses the sidebar.
Controls are Home→Customers and Home→Suppliers. **144/144 samples, no errors or
timeouts.** Each comparison pools six purchase samples. p95 uses nearest rank
(the max for six); cold first samples are retained. All values below are ms.

|Purchase navigation|Old content median /p95|Final content median /p95|Final first-change max|
|---|---:|---:|---:|
|390 unthrottled|80 /84|77 /87|5|
|390 throttled|529.5 /928|538.5 /936|12|
|1280 unthrottled|380 /423|378.5 /414|32|
|1280 throttled|827 /1243|837 /1254|28|

Throttled content increases9ms phone (+1.7%) and10ms desktop (+1.2%). This is a
small measured cost, not a speedup or a statistical proof of identical speed.
Controls: phone Customers531→533 /Suppliers526→527.5; desktop842→831 /
844→842.5. Their repeated-run spread reaches22ms, illustrating background noise.
First throttled purchase samples remain~0.94s phone /1.25s desktop. No navigation
long task≥50ms in the measured purchase windows; observed navigation Event
Timing max48ms phone /16ms desktop, not a whole-app INP certificate. Pending
feedback appears within12/28ms even when data takes longer. Footer placement
is a usability improvement, not a fabricated millisecond task-time claim.

F4's without-Lending first-change97→91ms median and17Oct363ms baseline are
historical controls over different case sets/environments; they do not prove
this register got faster. Today's same-machine A/B is the comparison. Final
frontend restored after the run. Raw samples and control requests are committed.


## Provisional ratings and limits

|Point of view|Score /10|Evidence|Still weak|Confidence|
|---|---:|---|---|---|
|Function · phone|8.8|Real search/paging/Back/period recovery, server totals tests and80 backend checks|Saved-time identity for identical drafts is BP-18|High for local tested flows|
|Function · desktop|8.8|Same API/engines, due/request fences, readable paper identities, rights tests|Not an all-API or every-staff browser certificate|High for tested scope|
|Busy counter · phone|8.6|Visible status/Record, fixed paging, full paper number, short-height and hit tests|Very long names show fewer rows; no merchant task study|Medium|
|Busy counter · desktop|8.8|Keyboard row scroll, sticky headings, page-reset and error-safe pager|No field study of real counter workload|Medium-high|
|UI/UX · phone|8.7|320/390, Hindi/dark, full words/large money, no page growth|Software keyboard and OS text scaling unproved|Medium-high|
|UI/UX · desktop|8.8|1024 compact identity/1280 full columns, measured contrast and hit tests|Independent usability research absent|Medium-high|
|Performance · phone|8.7|538.5ms throttled pooled content;≤12ms feedback; no measured nav long tasks|+9ms content; first~0.94s; emulation only|Medium|
|Performance · desktop|8.7|837ms throttled /378.5ms unthrottled content;≤28ms feedback|+10ms throttled; first~1.25s|Medium-high, local|

09's separate design weights20/15/15/15/10/10/10/5 use mobile8.7, ease8.7,
visual8.7, feedback8.8, accessibility8.6, desktop8.8, safety8.9, reuse9.0:
**8.75/10 provisional design self-review**. Lowest aspect8.6. This is the
register's measured scope, not the historical quick-add component8.75 or an
entire purchase-family/Shop rating. Performance remains separately scored above.


These are self-assessments for this register, not an independent user study or
whole-Shop certification. Software keyboard/installed PWA/physical phones,
OS text scaling and TalkBack remain unproved.600px short height and simulated
visual-height sizing are checked, not a physical keyboard certificate. Existing
shell name/email truncation is separately scoped. Very similar unnumbered drafts
cannot be distinguished by saved time because the current list API exposes no
created/updated timestamp; paper number/date/supplier remain visible. BP-18 records the additive read-field proposal, not approved/built. Do not
invent timestamps or call this source gap solved. Actual order conversion,
return issue/refund and purchase detail acceptance remain next.


## Owner correction: reference-size chips and all-module scope (R-DEC-31/32)

The prior implementation incorrectly made chip faces44px; the reference and
DESIGN-SYSTEM specify32px visuals with44px mobile targets. This was an error,
not an approved reference change. Removed the min-height override and reserved
6px vertical room for the existing transparent hit area. Browser checks measure
32px faces and hit-test ±21px from the centre; they fail on the44px build.
The current clean240-frame en/hi sweep passes size/hit/pager/overflow/contrast
checks. All416 suites/4,647 tests, lint/types/locales/build/bundle/174 contrast
pairs pass again (104.299s). Final artifacts now live in
artifacts/purchase-register-reference-chips-2026-10-21/.

The144-sample A/B above predates this appearance correction and is retained as
such. Current-build quiet navigation:36/36 samples, no errors/timeouts;
purchase content medians81/531ms phone unthrottled/throttled and387/829ms desktop;
maximum first feedback6/10ms phone and31/29ms desktop. This follow-up is not a
new controlled speed-improvement claim. The full all-module behavior is NOT
implemented: only Purchases. The next rollout group is existing Shop Customers,
Suppliers and Bills, then11's module matrix; user/book/role boundaries remain.

### Requirement coverage and end-user value

| Need | Why necessary / value | Evidence / status |
|---|---|---|
| Find a supplier paper bill | Avoid guessing our number from their paper | Actual supplier-number search and loaded-detail Back; passed |
| See what is owed | Prioritize supplier payments without mixing customer money | Server-filtered totals and80 backend tests; passed within purchase scope |
| Reach paging/actions | No page-length scroll or toast blocking Next | Real scroll/position/hit tests, including error retry; passed |
| Mobile readability | Full names/money; reference-sized controls with usable targets |320/390 en/hi, themes,32px face/44px hit; passed |
| Correct context/failure handling | Prevent old windows/errors replacing current data | Due-window/request regressions, retry/clear tests; passed |
| Distinguish otherwise identical drafts by saved time | Reduce ambiguity when several drafts look alike | Source missing; BP-18 proposed, not claimed implemented |
| All-module viewport behavior | Predictable navigation throughout the app | Purchases passed; other groups pending in11 |
| Physical keyboard/PWA/assistive use | Validate actual devices beyond emulation | Unproven; not covered by the provisional rating |

### Competitive check,21 October2026

Official evidence confirms this is a competitive baseline, not a unique
purchase-accounting invention: [Zoho Inventory payables documentation](https://www.zoho.com/us/inventory/help/reports/payables-reports.html)
describes vendor dues/payment/credit reporting; [Vyapar's official feature list](https://vyaparapp.in/blog/vyapar-app-features/)
includes purchase returns and outstanding-balance information. These establish
capability overlap only, not equivalent implementation or full product parity.
Our pinned mobile pager,32px visuals/44px targets and recovery behavior are
measured against our old build. Whether they beat those competitors' current
mobile layouts, task steps or speed is UNPROVEN without comparable hands-on
tests. No unsupported superiority claim. Full purchase/detail/return workflow
acceptance is still required before broader feature-parity claims.

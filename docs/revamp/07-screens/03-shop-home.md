# Shop Home · `/dashboard`

Visual reference: Counter Mode design page, revision 3 and later (the published artifact; source copy `/mnt/project-files/shop-design-direction/counter-mode.html`). This spec records the decisions; the page shows them.

| Field | |
|---|---|
| Purpose | At a busy counter: start the next task in one move, and see today's money and who owes what, without reading a report. |
| Who and when | Owner or counter staff, many times a day, often mid-sale. |
| Phone layout | Header (shop name, date and time, bell). Find-or-start box. Two actions: Receive money · + New bill (marigold). Day figures as a 2 × 2 grid: Billed, Received, Paid out, Cash by your records — each with one line saying what it counts. Two lanes: To collect (customers) · To pay (suppliers), separate. Segmented Register · Follow-ups · Insights. Bottom bar. |
| Desktop layout | Sidebar; header row with title and three actions (Receive money, Pay supplier, + New bill); find-or-start box with `Ctrl K`; "Repeat" chips with where they come from; one ruled line of four figures and the per-hour chart (stops at the current hour; "Show as table"); main column with Register / Follow-ups / Insights tabs; side column with the two lanes and the dual-role note. |
| What matters most | find-or-start and the two actions → today's four figures → who to collect from → the register. |
| Components | `UbHomeBlocks`, `UbStatSummary`, `UbAmount`, `UbGroupedBars` + `UbChartTable`, `UbAgingBars`, `UbPanel`, `UbTabs`/segmented, `UbAsyncCombobox` (find-or-start, new composition), `UbFilterChip` (repeat). |
| Main / other | + New bill / Receive money, Pay supplier, Remind, Pay, open any row. |
| Navigation | rows open the bill, receipt or person; lanes open Customers or Suppliers sorted most late first; Remind opens the Shop reminder flow (needs TV-02 fix). |
| States | **First day**: ₹0 figures, "No bills yet today", three setup steps, no chart. **Loading**: skeletons shaped like the figures. **One part failed**: only that panel says "Couldn't load supplier dues · Try again" (existing `unavailable` parts). **Staff with limited access**: totals hidden for their role with a lock line. **Offline**: last loaded figures with "As of 4:12 pm, no internet". |
| Accessibility | figure line is a group with labels; chart has an `aria-label` sentence and a table view; register rows say their type in words; status as words, not colour only. |
| Must keep working | each app's own book (DEC-019); customers and suppliers never netted (D-03, TV-01 server fix pending); dashboard per-part availability. |
| Fewer taps | "mohan 2000" in find-or-start opens Receive payment filled for Mohan with ₹2,000 (nothing saved until Receive); Repeat chips open filled forms. |

Tracking: problems — TV-01 netting, TV-02 Shop reminders (server) · decisions — four-figure line kept over the big sentence (the owner liked the sentence; R-DEC-03 open: offer the sentence as a phone-only header line above the grid) · dependencies — TV-01, TV-02, per-hour series read · risks — find-or-start discoverability · approval — direction approved 17 Oct (colours, sidebar); details pending · build — R-DEC-21–24 responsive implementation; final delivery evidence in the dated report · tests — dashboard e2e, figure-sum check, 320 px Hindi · outcome — —

## Data available for Home (verified against the API, 19 Oct 2026)

Use only these facts; anything in the visual reference without a source below is withheld, not approximated.

| Reference element | Source today | Status |
|---|---|---|
| Billed today | `GET /reports/dashboard` `tiles.today_sales` (net of credit notes) | available |
| Received today | `tiles.today_received` (Shop bucket) | available; **no cash/UPI split** — show the total only |
| Paid out today | `GET /reports/dashboard/charts?range=7d` `money` last point `out` (Shop payments out + paid Shop expenses; Shop-only since c4c55deb) | available as one figure; **no suppliers/expenses split** |
| Cash by your records | `tiles.shop_cash_in_hand` `{amount, since}` — never `cash_in_hand` (every book; hidden from Shop-only readers since 3be71500) | available |
| Per-hour chart | — (charts group by day/week/month/year only) | **missing**: needs an 08 proposal; until approved, Insights shows the existing "Billed per day" trend |
| Repeat chips | — | **missing**: needs an 08 proposal; omit |
| To collect lane | `tiles.to_collect {amount, advances}`, `top_debtors`, Shop receivables aging from `charts.receivable_aging` | available; days-late per row not in `top_debtors` |
| To pay lane | `tiles.to_pay {amount, advances}`, `top_creditors`, `tiles.supplier_bills` overdue / due this week | available |
| Register | `recent_activity` (typed events with per-event permission) | available |
| Follow-ups | overdue bills, supplier bills due, `low_stock_items`, `tiles.open_orders` | available; **promise dates are the Udhaar book's (DEC-019)** — not on the Shop Home |
| Dual-role "Settle…" | — | **withheld**: BP-08 unapproved; never net roles |
| First day | `first_use` | available |
| One part failed | `unavailable[]` per part | available |

Verification constraint recorded 19 Oct: the claude.ai sandbox cannot download a Playwright browser (network allowlist), so the required real-browser matrix, screenshots and computed-contrast checks for Home must run on a machine with a browser (local `e2e/revamp-shots.mjs`). Unit tests and type checks alone do not prove this screen.

## Independent readiness review · 19 Oct 2026 (R-DEC-20)

Claude's seven commits provide access corrections, an API-source table and a
baseline harness, not the rebuilt Home. BP-14 independently corrected further
stored-export/report/book/history failures; the full final backend passes
4,661 tests with 16 skips and no failures. See the dated review follow-up.

The Home harness now measures loading and first-use frames rather than merely
saving PNGs, awaits the measured page root, retains per-locale results, and
requires the specified tabs outside baseline mode. The old screen's clipped
chart labels remain a baseline defect to fix in the actual Counter Mode rebuild.
Do not rate or ship the old layout as the completed redesign on the strength of
API tests or baseline-mode output. The `build — not started` tracking remains
accurate for the redesigned Home; preparation and data verification are complete.

## Implementation decisions · 19 Oct 2026

R-DEC-21–24 supersede the first composition. The global Shop header now owns
Find or start (full-width in the phone header); Home does not duplicate it.
Phone uses a joined bordered 2×2 figure card, compact independent money lanes,
filled segmented tabs and a separate register/content card. Desktop uses the
ruled figures + compact graph, normal-weight Repeat pills, underlined tabs and
independent lanes with full names/amounts. A main panel never stretches to the
side column's height. The defaults of shared UI-kit controls stay unchanged.

The owner replaced hourly with period/group filters. Home's default seven-day
billed series is reused from the existing charts read; This week/month/calendar
year/all/custom and Day/Week/Month/Year request the existing report endpoint.
The compact controls share one row; chart and table use identical data. Original
extended reports/period comparisons remain available under More reports.

BP-15 adds a permission-projected, private/no-store Counter read for role lanes
and eligible Repeat sources. No model/posting or vertical contract changes.
Role bands group net balances by each person's oldest open bill, not invoice-age
allocations. Repeat proposes fresh forms through shared mappings/hooks, preserves
manual input and never copies old ids/numbers/dates/payments or silently posts.
Search reuses the existing paged Shop sources and role-specific pages/forms.

BP-15 register follow-up reads bounded current source statuses and line counts,
with source permissions and freshness guards. Unknown facts remain absent.
Cash by records is not a physical count. R-DEC-26 approves Shop promises, cash
observations and explicit settlement; these workflows are next, not delivered.
Historical role statements and personal Udhaar ownership remain separate.
Evidence and exact remaining parity limits: docs/performance/2026-10-19-p5-shop-home.md.

20 Oct BP-15 follow-up: source facts and Shop-origin read fences verified;
168 measured English/Hindi states,4,547 frontend and4,673 backend tests pass.
Evidence: docs/performance/2026-10-20-home-register-facts.md.

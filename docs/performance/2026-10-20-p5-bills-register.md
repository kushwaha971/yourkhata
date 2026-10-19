# Bills register · Counter Mode

20 October 2026. R-DEC-16/25. Status: implemented and verified; delivered on dev. This piece is the Bills list, not the invoice editor,
POS, purchasing or the whole Shop.

## Review and change

The previous phone view hid All/Unpaid/Overdue/Paid/Draft/Cancelled in Filters;
its old summary-card treatment and inline grid also cut contact/bill names.
The Counter Mode register keeps status decisions visible, leads with a compact
filtered-total line, and uses the existing responsive register grid. The date
period is one dropdown on desktop; advanced dates/origin stay in the shared
phone drawer. The phone's New bill is in the header rather than a floating
button over the list. Existing per-kind sales destinations remain in More.

The existing UI-kit choice chips, period selector, filter sheet, register grid,
status badges and money formatting are reused. A small reusable RecordTotals
composition replaces the invoice-specific summary-card markup so later purchase/
payment registers can reuse the same shape. No backend API, accounting rule,
model, money calculation, permission or historic-document change.

All figures and counts remain API meta over the filtered set, never client
sums. Status choices call the existing hook/URL query; changing advanced filters
preserves the current visible status. Server paging remains unchanged. Long
names wrap in desktop cells; phone cards use the shared stacked layout. Bill
number/date/status and amount due remain visible; no avatar for a document.
Internal status key `void` remains unchanged; its user-facing label is Cancelled.

## Fail-before regressions

- Direct Paid choice failed on the old screen because no radio group was visible.
- Browser acceptance failed old summary/visible-status checks and found long
  names cut at 320 and1280. The same measured checks are rerun after the fix.
- Typing `n` in the header command invoked the Bills New shortcut too. A test
  failed before adding the typing/dialog/defaultPrevented/Alt guards.
- Moving New to the phone header exposed that its descriptor needed onClick.
  The navigation regression failed with the old href-only descriptor; onClick
  now invokes the existing newBill action. The focused phone-header regression passes.

- At 1024 px, the header's intrinsic action width overflowed by33 px. The
  shared header action group now constrains itself to its available width and
  wraps, retaining full labels. The existing page-overflow assertion fails on
  the prior build. Date strings also used the table's default ellipsis; their
  width and explicit wrapping now preserve the full date. The strengthened
  ellipsis check fails before that correction.
- URL/Back searches were overwritten by the stale local debounce. A regression
  failed before using the existing useCommittedSearch hook; it passes afterward.

## Verification

Final gate, screenshot and live behavior results are recorded below. Earlier
Home acceptance does not certify this screen. Full frontend regressions were
rerun; no backend source changed in this piece.

Use the same local scale owner/database, four widths and two themes, Hindi320/
1280, states ready/status/advanced filters/long name+₹12,40,378.00/offline/
filtered empty/loading/first use/error. Every frame measures actual text boxes,
page overflow and computed contrast. No financial writes from this list audit.

## Remaining family work

Next after commit/push/report: invoice/POS editor and detail actions, including
pricing overrides, tax/rounding, discounts, payment/receipt/share/print/privacy,
returns and stock effects. This list change is not that end-to-end certification.

## Final acceptance · 20 Oct 2026

Changed-file ESLint --fix --max-warnings=0, type check, full Jest, production
build, bundle, contrast and locale checks pass. Full frontend: **406 suites /
4,536 tests**, 96.374 s. No backend source/contracts changed in this piece;
the Home backend timing-test caveat remains in its report.

**102 measured browser states**: English68 at390/320/1024/1280 light/dark;
Hindi34 at320/1280 light/dark. Ready, direct Paid, advanced phone filters,
long electrical-business names/₹12,40,378.00, offline, filtered empty, loading,
first use and whole error. **Zero** overflow, cut/ellipsized data or computed
text-contrast failures. Actual interactions verify tab=paid succeeds, applying
Filters retains Paid, header n typing stays on Bills, and phone New opens the
editor. No bill was issued or payment posted by this list audit.

All102 final frames/contact sheets were opened for review, plus native ready
views. JSON: `docs/performance/data/2026-10-20-bills-*.json`. Screenshots:
`/Users/akashkushwaha/Documents/Codex/2026-10-02/https-railway-com-project-386b1ca4-ae4a/artifacts/shop-bills-register-2026-10-20/`.
**174 contrast pairs** pass; **6578 en/hi keys /55 catalogues** remain complete
and chunk-loaded. Changed-file lint is per project rule; full cloud lint can
exceed25 minutes. Jest/build are sequential; standalone is restarted each build.

Bills route gzip **85.1→83.5 KB**, first load **326.1→324.4 KB**, versus the
committed Home bundle. No budget increase. Existing controls/defaults remain.

### Navigation

12 samples, three repetitions, Customers→Bills, no competing build/test/browser
work. Source: `data/2026-10-20-bills-nav.json`.

| Width/profile | First change p50/p95 ms | Content p50/p95 ms | Loading |
|---|---:|---:|---:|
| 390 unthrottled | 29/31 | 91/93 | 3/3 |
| 390 throttled | 29/32 | 528/979 | 3/3 |
| 1280 unthrottled | 32/35 | 88/121 | 3/3 |
| 1280 throttled | 37/38 | 550/970 | 3/3 |

Historical baseline for this route: 390 throttled first-change median291 ms,
content611 ms (worst1096);1280 median508/834 (worst1071). F4's different broad
cohort excluding Lending was first-change91/168 p50/p95. Those old runs include
the shared-foundation changes: **no speed gain is attributed to this register**,
and no fresh same-parent before/after timing claim. Current feedback is visible
in all12 taps. Chromium lab results are not physical-device/PWA certification.

### Provisional review and limits

09 rubric: mobile8.6, workflow8.9, visual8.6, feedback8.8, accessibility8.7,
desktop8.8, preservation9.0, reuse9.0; weighted **8.77/10**. This is a screen
self-review, not independent merchant research. Register preservation8.8/10;
whole invoice/POS functionality is not scored from this list.

Local search truthfully supports number/name/mobile; the planning table's
amount lookup is not claimed. Existing offline draft entry is retained; no
offline issued bill is posted here. Physical phones, assistive technology,
large OS text and merchant-task research remain. Invoice/POS editor/detail,
returns, tax/rounding, payments, stock and sharing/print/privacy are next.

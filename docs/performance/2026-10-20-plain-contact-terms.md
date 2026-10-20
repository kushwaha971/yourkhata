# Plain customer/contact terminology across the application

20 October2026. R-DEC-28. **Label checkpoint verified locally; delivery on dev.**

Owner requested Quick Sale / Saved customer, then the same plain words across
the entire project. Use Customer for sales, Supplier for purchases and Contact
for neutral identity, shared pickers, tags, activity and errors. Hindi equivalents
are reviewed for grammar. A quick-sale customer is still shown as Customer on a
receipt; the transaction label does not become a person's name. Saved customer
still uses the existing `party` billing mode; Quick Sale still uses `walkIn`.

Change visible labels, plural messages and server presentation text only. Keep
ICU variable names, model names, permission codes, route/response/request keys,
CSV import headers and stored names/records. The import sample gets an electrical
business name instead of a misleading Walk-in customer-name example. Default
wholesale/trader/other customer nouns become Customer for newly read defaults;
no saved business setting or record is rewritten. Module/admin display labels
use Contact(s), while the actual Django Party model and `parties` module remain.

Existing copy assertions and browser selectors are updated for the approved
words. No new per-label unit tests; locale/ICU checks, existing business tests,
source review and live geometry checks provide the relevant verification.


## Verification

-100 English and94 Hindi visible strings updated. The final English catalogue
 scan finds no remaining Party/Parties or Walk-in display words after preserving
 ICU variable identifiers. Hindi gender/phrasing reviewed. No new locale keys.
- Changed-file ESLint --fix --max-warnings=0, type check, locale split/check,
 **408 suites/4,550 tests** (115.265s), standard production build, bundle check
 and174 contrast pairs pass.6,602 keys/57 catalogues stay disjoint and loaded.
 No bundle budgets raised. Full cloud lint exceeds25min; changed-file lint used.
- Backend AST review: executable structure unchanged after normalizing string
 constants; dictionary keys and model lookup calls preserved. No migration:
 makemigrations --check --dry-run reports no changes. Black/isort pass. Tests
 retain source/role/tenant/ledger assertions; only display expectations change.
- An early overbroad display replacement reached admin/audit model lookup names;
 their tests caught it. Those lookups are restored to the actual Party model,
 while separate display dictionaries say Contact. Relevant137-test recheck
 passes. No such change was committed or deployed during the failed iteration.
- Full backend: **4,670 passed,16 skipped,3 failed**,8 warnings,496.13s. Two
 failures were old display assertions (missing mobile, notification title).
 The existing5,000-schedule timing ceiling failed63.3s against60s. Corrections
 and isolated regression group: **59 passed**, including imports preserving
 names supplied in CSV, notifications/recipients and scale40.37s (43.23s group).
 Final count-neutral notification title recheck: **11 passed**,0.80s. The original
 full run remains red in this record; isolated green is not a full-run green.
 No timing threshold, financial service or test business assertion was weakened.
- **48 read-only browser states**:32 English at390/320/1024/1280 light/dark;
 16 Hindi at320/1280 light/dark. Quick Sale and Saved customer explicitly select
 their existing modes; picker requests still use book=shop and type=customer.
 The neutral contact form opens in both languages.0 detected overflow, cut labels
 or low-contrast text on the reviewed form/picker surfaces.0 business writes.
 Final selection screenshots wait for the existing chip transition to settle;
 twelve contact sheets and native states were inspected.
- The initial body-wide popup diagnostic saw the already documented320px shell
 business-name ellipsis. Final checks measure the actual popover and main form,
 not an unrelated header. The known shell truncation is not claimed fixed.
 Physical-device/PWA/keypad/screen-reader/merchant research remain unproven.

Artifacts in the chat workspace:
`artifacts/plain-contact-terms-2026-10-20/`, with final frames, viewport crops,
contact sheets and raw results. Committed measurements:
`docs/performance/data/2026-10-20-plain-terms-{en,hi,nav}.json`.

## Quiet navigation

12 same-route Home→Customers samples, three per viewport/profile, no competing
build/test/browser workload. After first-change p50/p95 and content p95, ms:

|Viewport/profile|Before first change|After first change|Before/after content p95|
|---|---:|---:|---:|
|390 unthrottled|32/34|28/31|244/537|
|390 throttled|31/33|31/32|774/770|
|1280 unthrottled|29/29|31/32|562/543|
|1280 throttled|28/29|28/29|1127/1128|

Before is407d9caa's quiet same-case run. The one slow unthrottled phone sample
and three-repetition spread prevent a broad speed claim; this is copy, with no
navigation logic change. F4's different48-route sample p95 was168ms excluding
Lending Today versus156ms baseline; these narrow results are not interchangeable.

No new whole-Shop score from labels. The editor/source workflows remain the
next work under R-DEC-27. The continuation prompt preserves the exact status,
permissions boundaries, evidence limits and deferred Home approvals.

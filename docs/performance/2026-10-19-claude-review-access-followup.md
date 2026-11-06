# Review of Claude's dev changes · access follow-up

19 October 2026. Pulled `1435d29a..7de05d53` by fast-forward: seven commits, 28 files. Reviewed the application changes, new regressions, API-source inventory, evaluation and Home harness against R-DEC-18 and the existing handoff. The changes are useful, but the access checkpoint was **not fully correct**. Home remains the old screen; adding a screenshot harness is not a redesign.

## Findings, reproduction and correction

1. **Legacy stored exports bypassed the new guard.** Missing `params.books` deliberately retained the old behavior. Removing the metadata from a generated main-book file and revoking Udhaar still allowed download. Files now recheck their original source's current policy, including legacy rows.
2. **Export rights did not protect sensitive columns or source rows.** A generated item CSV and stock report still downloaded purchase costs after financial-read was denied. A day-book file still downloaded sales rows after invoice-read was removed. The current source read/column permissions now govern the whole immutable file. Regenerate a new file with current rights; never silently rewrite an existing document.
3. **Capturing every grant over-restricted unrelated files.** Removing Udhaar access blocked a Shop CSV because the queue stored all books the requester could read. The download now checks the actual saved source/filter/columns, not unrelated grants. Shop party exports also consistently omit Udhaar promise/last-activity fields even when the requester originally held both grants. Existing older mixed-column files may require regeneration.
4. **Report aging was a separate unguarded entry point.** `/reports/receivables-aging` and `/reports/payables-aging`, in JSON and CSV, bypassed the book authorization on `/ledger/aging`. These views now reuse BookAccessMixin for `ledger.entry.read`; the separate report capability retains its existing check. Shop aging returns null for Udhaar-only promise dates and credit limits, preserving the response shape and the Shop amount. Main-book reports retain those fields.
5. **Disabled-app history could re-enter global cash.** The aggregate's permission guard checked only currently running apps. Turning off Udhaar/Library removed them from the required set without removing their historical payments from the figure. Global cash now requires access to every known book. Owners and legacy broad readers retain their authority; the Shop-specific cash figure/calculation is unchanged and is still what Shop UI must use.

Nine assertions failed on the exact pulled `7de05d53` code, with three compatibility controls passing. Two more fail-before tests proved the Shop aging field leak, and one proved disabled-app historical cash leakage. Active test docstrings describe the defects. The initial 759-test affected-module run passed before the final two aging-field tests were added; the final affected-module run passes **761 tests**, and the complete focused export/dashboard set passes **18 tests**.

## Architecture and compatibility

The list replay already rebuilt its view for async generation. That construction is extracted as `export_list_view` and reused for download permission checks; the worker still uses the same source and column definitions. The report branch resolves the registered exporter's existing view and uses its permission classes and column formatter. Day-book row rights come from the existing SOURCE_PERMISSIONS registry, not a duplicate map. Module disabling and source read revocation are checked, not only the merged export codename. Old snapshot fields are not treated as authorization.

No migration, package, financial posting/calculation change, production data operation or deployment. No Library/Lending endpoint/workflow/model change. Shop aging's private main-book fields become null; Shop CSV removes those cross-book columns. Unchanged valid files remain downloadable; files whose source/columns cannot be authorized fail closed with a regenerate instruction. Existing outer missing-export permission remains 403; unauthorized source/files are 404.

## Verification

- Isolated PostgreSQL: `test_revamp_review_1019`, separate from local demo/production.
- API tests run actual request authorization, async eager job generation, storage and FileResponse downloads; no mocked permission resolver or pretend CSV result.
- black, isort, flake8 and diff whitespace checks pass on changed Python files.
- Final full backend: **4,661 passed, 16 skipped, zero failures**, in **436.33s**, against the final code. This includes Library/Lending and architecture/query-budget checks; both previously reported sandbox failures pass in this local run. An earlier partial full run was deliberately stopped before the final aging/privacy correction; it is not counted as completed evidence. `makemigrations --check --dry-run` reports no changes.
- No frontend application file changed. The frontend gates/screenshots in Claude's evaluation are prior evidence, not a new UI verification by this patch. No new UI rating, speed claim or whole-Shop completion claim.
- Home harness review found loading and first-use PNGs were not measured, despite the header comment claiming every state. They now use the same measuring path as their screenshots, await their actual roots, preserve results per locale, and require the specified tabs outside baseline mode. The current old Home is evaluated in explicit baseline mode; its known defects do not count as a redesigned-screen pass.

## Next

After delivering this correction, resume the approved Shop Home redesign using the artifact/committed Counter Mode reference and the verified source table in `07-screens/03-shop-home.md`. Today's Home is not the redesign. Preserve independent customer/supplier lanes, Shop-only figures, role-aware actions, per-part retry, first-use and offline behavior. Reuse existing components; no fake hourly series or repeat suggestions where the required sources are absent. Home must get the complete phone/desktop/theme/Hindi browser matrix, not just unit tests.

Keep the broader limits explicit: personal per-user Udhaar ownership is still unimplemented, historical role-specific statements/settlement have their existing approval boundaries, and this review is not a penetration-test certificate. Notification payloads such as generic export-ready notices still need context-specific review as their screens are changed. Do not infer every action or module is safe from this checkpoint.

## Home baseline harness verification

Ran the unchanged production frontend against the corrected local API: **60
measured states** (five per width/theme/locale: ready, full page, loading,
part-failed, first use). English 390/320/1024/1280 light/dark: 40; Hindi 320/1280
light/dark: 20. All twelve contact sheets were visually inspected. Per-locale
JSON is committed alongside this report; raw images are in the task workspace
`outputs/revamp/shots/home-baseline-review/`.

These are baseline findings, not passes for a rebuilt Home: the populated/partial
states still clip three chart labels (`2,50,000`, `1,25,000`, `5,00,000`) at every
size/theme/locale. No viewport overflow or sub-floor contrast was measured in
those main regions. Loading and first-use regions measure without clipping.
The long old-page stack, period cards and lack of Counter Mode tabs remain visible.

Calibration without `--baseline` at 320 light **fails five checks as intended**:
three frames with chart clipping and the two missing required tabs. A baseline
run's “all cases passed” means the harness finished recording; it cannot be used
as evidence that the old Home meets the redesign. The initial stricter loading
selector matched nested skeletons too; it now targets the outer busy region.
One browser cleanup exceeded its deadline after Hindi assertions completed;
completed evidence is retained, not reclassified as a failed layout check.

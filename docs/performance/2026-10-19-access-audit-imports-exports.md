# Access audit · imports, exports and stored files

19 October 2026. Continues R-DEC-18 after the BP-13 checkpoint (R-DEC-19), before Shop Home. Backend-only. No frontend, payload shape, financial posting rule, migration, package or Library/Lending calculation changed.

## Defects found, each reproduced before fixing

1. **Party import wrote the Udhaar book on a Shop-only grant.** The party drawer requires main-book `ledger.entry.write` (BP-11). The import engine checked the merged codename set, so a member with only a Shop admin grant uploaded and committed a party file and a ₹2,300 opening entry was posted with `bucket=main`. The same member could open the owner's party import jobs, row previews and problem file, which carry Udhaar opening balances.
   Fix: `ImporterSpec.book` names the book a kind posts into; party imports declare `main`. Reading and writing such a kind also require that book through BP-11's `allowed_books`. Items, students and loans are unchanged.
2. **A background export kept the access its requester had.** The download checked only the export codename. After the member's Udhaar grant was revoked, an earlier main-book parties export still downloaded.
   Fix: list and report exports record the books the requester could read with the codename when queued; the download requires them again and answers 404 otherwise. Rows queued before this change carry no `books` and keep their earlier behavior.
3. **`/files/{id}` streamed any stored file to any member.** The proper export route refused a Shop-only member (404) while `/files/{export attachment id}` returned the same main-book CSV with balances. The route is the branding-image route; the API publishes URLs only for logos and signatures.
   Fix: it serves only `logo` and `signature`; import and export files stay on their own permission-checked routes. No API response was found exposing import/export attachment ids, so this needed a known id; direct ids are in the audit's scope regardless.

Checked without a defect: a Shop-only member's own parties export (direct and background) contains only the Shop balance; invoice share (`/public/d/`) and pay (`/public/pay/`) tokens are hashed, expire, revoke and resolve inside their tenant.

## Evidence

- New regressions: `apps/imports/tests/test_import_book_access.py` (4), `apps/reports/tests/test_export_book_access.py` (2), `apps/files/tests/test_attachment_kind_scope.py` (1). The three denial cases failed on unchanged code; the grant-holding controls pass before and after.
- Full backend, run in chunks against an isolated sandbox PostgreSQL 16 (one CPU; commands are limited to 300 s, so one run was not possible): **4,656 tests, 4,638 passed, 16 skipped, 2 failed.**
  - Library 20,000-copy close wall-clock test: 14.7 s in the chunk against a 5 s ceiling; passed alone afterwards (5.45 s including setup). Same pre-existing timing test BP-11 recorded. Not relabelled green.
  - `tests/integration/test_sprint1_matrix.py::test_the_matrix_has_a_row_for_every_sprint_1_route` reports the OTP request/verify routes undeclared. It fails identically on unchanged `1435d29a` in this sandbox and did not fail in BP-13's local run, so it is treated as environment-dependent and pre-existing; not investigated further here.
  - Totals reconcile with BP-13's 4,649 plus the 7 new tests.
- black, isort and flake8 pass on all changed/new Python files; `makemigrations --check` reports no changes. Ruff/mypy are not installed and not claimed.

## Limits and open questions

- The frontend still draws Import on the Shop parties list from merged permissions, so a Shop-only member now gets a permission error instead of a silent Udhaar write. Hiding it needs the client to know per-book grants; not done here.
- Party import is presented as the Shop's customers/suppliers but posts openings to the main (Udhaar) book. Which book it should post to is a financial behavior change and needs an 08 proposal.
- Invoice share links keep working while a business is suspended or pending deletion; pay links stop only once it is deleted. Product decision, not a demonstrated defect.
- Not yet covered: the whole-business backup export, and the remaining §5.1 action families. Per-user personal Udhaar ownership remains unimplemented.
- No browser matrix or frontend gates were run because no frontend file changed. No deployment, production database or credentials were used.

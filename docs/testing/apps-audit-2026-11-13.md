# QA audit — Lending, Library, Money Book and Business (12–13 Nov 2026)

The owner asked for a production-readiness audit of the four apps: as a real
user, as an automation and manual tester, and as someone trying to break them;
with team members added and signed in to their own accounts; and every defect
found fixed, with a test, and re-tested.

**Result: 12 defects found in the product and all 12 fixed. Nothing critical
or high is open. Combined rating 9.0 / 10.** What is not proven is listed in §7.

Everything ran on the local stack (API :8000, frontend :3005, the built
production bundle) against the QA business, plus freshly registered businesses
for the server tests.

## 1. What was tested

| Part of the brief | How | Result |
| --- | --- | --- |
| Roles, in the member's own account | `e2e/team-roles.mjs`: the owner adds an admin, a staff member and an accountant; each signs in with their own mobile and code and opens every page of all four apps at 390 and 1280 | 1023 / 1023 |
| Roles at the server | `tests/integration/test_apps_audit.py`: every route of the three apps as each role, allowed or refused exactly as the role table says | pass |
| Functional journeys | `lending-round` 64/64, `library-round` 72/72, `moneybook-round` 97/97, `lending-new-checks` 24/24, `apps-primary` 37/37; Shop `a3-functional`, `a4-functional`, `a4-money` at 390 and 1280 | all pass |
| Apps kept apart | A member's Money Book has none of the owner's people; another business gets 404 for every id of the first; an app switched off answers nobody; a member given one app reaches only that app | pass |
| Sums | `e2e/audit-dump.mjs`: every figure the three apps show, recomputed from the raw rows by a second route | 141 checks, 0 wrong |
| Reminders | Message previews in both languages at 390 with the longest names; nothing is sent by itself (the screen only opens WhatsApp or SMS for the person to send) | pass |
| Screens, phone and desktop | Every page per role at two sizes measured for anything wider than the screen; lists paged in the rounds | pass |
| Failure handling | Offline save keeps the sheet and stores nothing; back online stores once; three fast taps store once; reload keeps work; blocked member is out on the next request | pass |
| Monkey | `e2e/monkey.mjs` on `/lending`, `/lending/loans`, `/lending/borrowers`, `/library/fees`, `/money-book` | all PASS (seeds 11, 12, 13, 23, 31) |
| Junk input | Every write route sent junk in every field and bodies that are not objects; every read route sent junk in every query key | no 5xx |
| Security | `e2e/security.mjs` | 10 / 10 |
| Server suite | full `pytest` | 4567 pass, 1 timing test fails (§7) |
| Frontend suite | jest 439 suites / 4349 tests; type-check; i18n 7986 keys in 64 catalogues; build and bundle check | all green |

## 2. Results by role

| Role | Lending | Library | Money Book | Business |
| --- | --- | --- | --- | --- |
| Owner | everything | everything | own book | everything |
| Admin | everything | everything | own book | everything |
| Staff | reads; takes a collection; adds a borrower and gives a loan (owner, 14 Nov); no route, closing a loan or settings | reads; enrols, takes a fee, attendance, books; no expenses or settings | own book, empty of the owner's | pages open, no refused request |
| Accountant | reads only | reads only | own book | reads |

Each cell was checked twice: at the server (allowed or 403) and on screen (the
action is not shown, and a page the role may not use says "Only the owner can
do this").

Changes while signed in: a blocked member, a member moved to one app, and a
role changed from staff to accountant all lose the open session on the next
request, and a new sign-in gets the new rights.

## 3. Results by app

| App | Functional | Sums | Roles | Phone | Monkey | Rating |
| --- | --- | --- | --- | --- | --- | --- |
| Lending | 64/64 + 24/24 | exact | pass | pass after fix 10 | PASS | 9.0 |
| Library | 72/72 | exact | pass | pass after fix 10 | PASS | 9.0 |
| Money Book | 97/97 | exact | private per person | pass | PASS | 9.2 |
| Business (Shop) | billing, payment, stock and print read back from the API at both sizes | exact for the bills tested | pages open for each role | pass | not re-run in this audit | 8.8 |

Business by kind of shop: this audit ran the Shop on the QA business's own
kind only. The per-kind rounds are in `shop-round-2026-11-11.md`; they were not
repeated here (see §7).

## 4. Defects found and fixed

| # | Severity | What a person saw | Cause | Fix | Test that fails without it |
| --- | --- | --- | --- | --- | --- |
| 1 | High | A wrong value in a form or link (text where a number goes, a list, an empty body) made Lending, Library or Money Book answer "server error" | The three apps' views read request fields with no guard | `apps/common/plain_requests.py`, used by every view; junk now gets a plain 400 | `test_no_junk_body_crashes_any_route`, `test_no_junk_query_crashes_any_route` |
| 2 | High | Staff and accountants saw every owner button (add route, settings, add or remove expense, new loan). They typed, tapped, and were then refused | Screens did not ask what the role may do | `useLendingAccess`, `useLibraryAccess`, `OwnerOnly`; the action is hidden and owner pages say so | `appsHideWhatTheRoleMayNot.test.tsx`, `team-roles.mjs` |
| 3 | Medium | A closed loan could be closed again (losing the first day and reason) or marked "not paid today" | No check on the loan's state | Refused in `lending/services.py` | `test_a_closed_loan_cannot_be_closed_again_or_marked_not_paid` |
| 4 | Medium | "Collect on Sundays too" sent as text still skipped Sundays | `bool("false")` is true | Proper yes/no reading | `test_skip_sundays_false_sent_as_text_is_still_false` |
| 5 | Medium | Correcting an old entry of a person who was put away moved their balance off ₹0 while they stayed hidden | Put-away people were not guarded | Refused in `moneybook/services.py` | `test_a_person_put_away_keeps_a_zero_balance` |
| 6 | Medium | "Hold" on a student who had left brought them back with no seat; a hold could end on a day already gone | No state or date check | Refused in `library/services.py` | `test_a_student_who_left_cannot_be_put_on_hold_and_a_hold_ends_later` |
| 7 | Medium | Editing a student onto another student's mobile was accepted, so one number got two fee reminders | Only enrol checked the mobile | Edit checks it too | `test_two_students_cannot_be_edited_onto_one_mobile` |
| 8 | Medium | Before 5:30 in the morning the Shop's short book said nothing had been asked for today | The server's day (UTC) was used, not the shop's | `tenant_timezone` in `inventory/services/short_book.py` | `test_asked_today_is_the_shops_day_before_half_past_five` |
| 9 | Low | A Lending import before 5:30 dated collections on a different day from the rest of the app | The importer had its own clock | It uses the app's one clock | `apps/lending/tests/test_import.py` |
| 10 | Medium | On a phone, a long name pushed Messages, the loan page, New loan, the student page and Seats wider than the screen | A grid with no column below desktop grows to its longest row | `grid-cols-[minmax(0,1fr)]` on the five pages | `messagePreviewFitsAPhone.test.tsx` (scans the five files), monkey seed 11 |
| 11 | Low | The size check for app pages had been failing unseen since the three apps were rebuilt under new page names | The budget file still named the old pages | `bundle-budgets.json` re-based, with the reason written in it | `npm run bundle:check` |
| 12 | Low | The Library's Expenses and Books pages downloaded their add forms even for a member who can only read | The forms were written inside the page files | `ExpenseSheet` and `BookDrawer` are their own files, loaded when opened; the scanner's words are in one hook (`useBookScanLabels`) | `npm run bundle:check` |

Before and after, for the two that matter most:

- **1.** Before: `POST /lending/loans` with `"lent": ["x"]` answered 500. After:
  400 with a plain message; 0 server errors across every route and junk value.
- **2.** Before: a staff member on Library → Expenses saw "Add expense", filled
  the sheet, and was refused. After: no button; the row does not open; Settings
  reads "Only the owner can do this".

Faults in the checks themselves, also fixed: a Library check waited for the
wrong request (the preview, same address) and so failed on desktop only; a test
used the server's day; the first fix for defect 10 named the wrong cause and the
monkey caught it.

## 5. Regression

- Rounds after the last change, one at a time on the final build: team-roles
  1023/1023, lending-round 64/64, library-round 72/72, moneybook-round 97/97,
  monkey `/lending` seed 11 PASS.
- Shop: `a3-functional`, `a4-functional`, `a4-money` PASS at 390 and 1280.
- Server: full `pytest`: 4567 passed, 14 skipped, 1 failed. The one failure is the timing test in §7 item 6; it touches no code changed here.
- Frontend: jest 439 suites / 4349 tests (full run before the last two small
  changes; the two changed test files re-run, 13/13), type-check clean, lint 0
  errors, i18n green, build and bundle check green.

## 6. Ratings (P0 standard §8)

| App | UI | Function | Busy shop | User's view | Overall |
| --- | --- | --- | --- | --- | --- |
| Lending | 9.0 | 9.2 | 9.0 | 8.8 | 9.0 |
| Library | 9.0 | 9.2 | 9.0 | 9.0 | 9.0 |
| Money Book | 9.2 | 9.3 | 9.2 | 9.0 | 9.2 |
| Business | 8.8 | 9.0 | 8.8 | 8.8 | 8.8 |
| **Combined** | | | | | **9.0** |

Business is below 9 because this audit did not repeat its per-kind rounds or
its monkey (§7; its older regression set is green again, 301/301). That is a limit
of the evidence, not a known defect.

## 7. Not done, and limits

1. **The old regression set (`e2e/run-regression.mjs --quick`) was out of date
   (180/183, 3 failing and 6 crashing jobs) and is now rewritten and green:
   301/301 across 14 jobs** (13 Nov, after the audit). None of the nine was a
   product defect. Three started a browser that is not installed here; the
   rest waited for words or pages the rebuilt apps changed ("Gave money",
   "Paid cash", the reworded credit-limit hint, `/khata` gone, only the open
   Old dues tab carrying a total). They now wait on the control, not the
   sentence. **Removed on the owner's word (13 Nov):** the old Udhaar person page, its
   statement and its credit-limit form no longer open outside the Shop
   (`parties/components/ShopBookOnly`, `e2e/old-udhaar-gone.mjs`); the `statement`, `credit`,
   `ledger` and `writeoff` harnesses that only tested them are deleted. The
   same day role hiding was extended to Business: short book Add, price-list
   Export, expiry Export and Return, and Collect by UPI are not shown to a
   role the server would refuse (`shopHidesWhatTheRoleMayNot.test.tsx`).
2. **About 56 harnesses work out "today" in UTC**, so they give false failures
   between midnight and 5:30 in the morning India time. The product code found
   with the same fault is fixed (defects 8 and 9).
3. **Staff could not add a borrower or a loan in Lending.** Changed on the
   owner's word (14 Nov, "Yes, let staff add"): staff now hold
   `lending.loan.create`. Routes, closing or writing off a loan and settings
   stay with the owner and admins; an accountant only reads.
   `e2e/staff-lends.mjs` 42/42, `team-roles` 1023/1023.
4. **Business per-kind and monkey rounds were not repeated**; see
   `shop-round-2026-11-11.md` for the last ones.
5. The monkey cannot run its reload-and-return check on `/library`,
   `/library/students` and `/money-book/report`; that is a limit of the tool.
6. `apps/dues/tests/test_run_scale.py` (5,000 schedules under a minute) fails in
   the full run on this machine (66.5 s and 70 s against a 60 s limit, with the
   API, the frontend and browsers also running) and passes when run alone. No
   dues code was changed. It needs timing on a quiet machine before it is
   trusted either way.
7. "Turn this app off / Leave this app" is not on the Apps page. It was
   brought back on 14 Nov and removed again the same day on the owner's word.
   Instead, switching to another business from Apps asks first and names both
   businesses (`e2e/apps-primary.mjs` 47/47).

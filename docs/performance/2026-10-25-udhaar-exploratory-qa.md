# Udhaar exploratory user QA — 25 October 2026

Build: dev5094e1d40. **Not ready for whole-feature sign-off.** This supersedes
any assumption that the preceding scoped green tests prove every user task.

Interactive, action-by-action headless Chromium session on the local production
build at127.0.0.1:3000 and local API8000, database revamp_20261018. Mobile390×844,
320×844 for another user, desktop1280×800. Real UI forms and persisted entries,
not component mocks. Playwright drove an isolated QA browser because the user's
desktop browser connector was disabled; this was not manual physical-phone use.
The user explicitly requested the agent's own environment. No production data,
external messages, calls or money transfers. All names/accounts here are QA.

## Confirmed defects

| ID | Priority | Defect | User impact |
|---|---|---|---|
| UQA01 | P1 | Report CSV link uses business endpoint and returns404 | User cannot download their personal statement |
| UQA02 | P1 | Personal printout uses selected business name and business phone | Private personal statement identifies an unrelated business |
| UQA03 | P1 | Unsaved entry lost after reload | Amount and optional note disappear without recovery |
| UQA04 | P1 | Business read-only role removes personal Add person | Independent personal-book user cannot start using it |
| UQA05 | P2 | Escape closes dirty entry with no confirmation or retained draft | Accidental dismissal loses typed amount/note |
| UQA06 | P2 | Offline Save remains enabled after No signal banner | Click gives no useful offline explanation; form values stay |
| UQA07 | P2 | Incorrect amount-limit validation text | Oversized integer gets a two-decimal error; negative says Enter0or more though zero is refused |
| UQA08 | P2 | Correction/report retain superseded UI and words | Reverse/Reversal/transactions/Export CSV/You gave/You got remain; correction Date returns; no reason chips |
| UQA09 | P2 | Printed Gave total green, Got total red | Personal red-Gave convention differs between page and print |

P1 means fix before release sign-off, not proof of cross-user data disclosure.
No successful cross-user read was observed in this pass.

### UQA01 — reproduction

1. Open a person created in the personal book.
2. Report → More actions → Export CSV on phone (inline Export on desktop).
3. Browser download URL is `/api/v1/parties/<personal-id>/statement?...&format=csv`.
4. Download reports `statement.json`, canceled. Read-only request to that same
   observed URL confirms404 JSON: not_found / Not found.

Expected: private `/api/v1/personal/parties/...` download with correct CSV.
Root-cause check: statementCsvUrl composes a raw anchor URL, bypassing Axios's
personal URL routing. The secure business scope correctly refuses the private ID.

### UQA02 and09 — reproduction

Log in as personal QA user under Radhe Krishna Enterprises, open a personal
friend → Report → inspect actual print-media rendering. Header and footer say
Radhe Krishna Enterprises; business phone+919876500000 appears. User's personal
identity is different. Gave150 is green and Got100.12 red, unlike the entry page.
Expected: personal account identity, no active-business letterhead, consistent
personal money direction. No product/domain was present in the printed content.

### UQA03 and05 — reproduction

Open Got money. Type12.75 and note Draft must survive reload. Blur the note and
capture the filled form. Reload; reopen Got money. Both fields blank, no restore.
Separately type7.50 plus note, Escape, reopen: fields blank, no discard warning.
No Save was pressed; there is no claim that a posted entry was lost.

### UQA04 — reproduction

Create disposable accountant/read-only business member in the same local QA
business. Sign in normally and open /khata. Screen: No people yet / Add a person
to start this book. Add person button count0. This is the user's own empty book,
not another person's book. Backend private scope grants the personal owner;
frontend still reads business permissions. Expected: business read-only rights
must not prevent the person managing their independent personal book.

### UQA06/07/08 — details

- Set browser offline after filling3.50 and note. Once No signal is visible,
  Save remains enabled; after click it returns to Save without a useful
  offline explanation in the sheet. Values stay in the open sheet. Reconnecting
  was not treated as authorisation to send a queued entry; no false balance
  change was observed.
- Negative−20 → Enter0or more. Zero→must be more than zero. Oversized integer
  999999999999999 → Use up to two decimals, like500.00. Messages do not explain
  the actual boundary. Typing100.123 saved100.12; silent precision reduction is
  additionally a usability concern, not an arithmetic-loss assertion.
- Empty history says No transactions yet. Row menu says Reverse this entry;
  confirmation says Reverse entry. Correction requires typed audit reason and
  displays Date/Today/Yesterday. Required audit reason is correct; absence of
  quick reason chips and older wording conflicts with the approved minimal flow.

## Exercised coverage

| Area/case | Result | Observed evidence |
|---|---|---|
| Normal account sign-in | Pass | Isolated QA login and /khata open |
| Another user's people | Pass | Different list; QA friend absent |
| Another user's direct person URL | Pass | This contact was not found; no private history rendered |
| Business read-only role, own personal book | Fail | UQA04 |
| Empty name | Pass | Name error, form stays |
| Name-only contact | Pass | Created without phone; opens settled at0 |
| Optional phone absent | Pass | No Call/reminder handoff offered |
| Invalid short mobile | Pass | Clear10-digit Indian mobile error |
| Duplicate mobile through normal UI | Pass | Number already in book, Open it; no duplicate saved |
| Rename and add phone | Pass | Saved, correct identity after reload |
| Initial Got money / negative net balance | Pass |100.12 received→To give100.12 |
| Decimal Gave25.10 | Pass | Balance To give75.02, persists after reload |
| Zero amount | Pass | Refused |
| Negative amount | Partial | Refused, misleading zero boundary text |
| Oversized amount | Partial | Refused, incorrect decimal error |
| Optional blank note | Pass | Entries saved with no note |
| Correction missing reason | Pass | Required audit reason enforced |
| Correct25.10→30.10 | Pass | Net To give70.02; replacement in history |
| Cancel corrected30.10 with reason | Pass | Net To give100.12 |
| Show corrections in report | Pass | Refetch shows original, reversal, replacement and reason |
| Gave150 after negative balance | Pass | Direction crosses to To get49.88 |
| Lost server reply, retry | Pass | First POST saved1.25, response dropped, UI Retry/Save; one1.25 entry, balance48.63 |
| Edit WhatsApp text / empty message | Pass | Editable; empty text disables handoff with explanation |
| Phone-number search | Pass | Matching people shown |
| To give filter, Apply, reload | Pass | URLbalance=i_owe; correctly empty after both people are positive |
| CSV download | Fail | UQA01 |
| Print rendering and money totals | Partial | Totals right, UQA02/09 |
| Dirty Escape and reopen | Fail | UQA05 |
| Filled draft reload recovery | Fail | UQA03, reproduced after blur |
| Offline form feedback | Partial | UQA06; open values retained |
| Phone/desktop entry and detail use | Partial | Workflows exercised; above defects remain |
| Session expiry during Save | Inconclusive | Cookies cleared after offline test; client state confounded result; no pass claimed |

## Coverage still required

Physical Android/iOS contacts, unsupported-picker fallback, real keyboard and
OS back, installed PWA/update/cache, actual WhatsApp/SMS/call launch, real print
hardware, accessibility/TalkBack/OS text scaling. Also: deliberate401/403/409/
429/500 matrix, expired-session re-login draft recovery, multi-tab/account and
business-switch races during writes, pending close/back behavior, double-tap
all mutations, pagination thousands of people/entries, next-page failure,
full Unicode/maximum note/name boundaries, malicious text rendering, hide/
restore non-zero refusal, exports across roles, report ranges/timezone edges,
slow first use and locale-by-state matrix. Prior automated checks are separate
evidence, not a substitute for completing these user journeys.

No claim to have tested every imaginable case. This report is an exploratory
pass with explicit coverage, not a complete regression sign-off. Fix P1s first,
retain failing regressions, then repeat affected journeys and complete this
remaining matrix. No application code was changed during this audit.

## Evidence

Screenshots in local artifacts/udhaar-exploratory-2026-10-25 under the chat
workspace: print-desktop, export, draft-before/draft-after, duplicate, offline,
cross-user and readonly-business. No external message sent. Test contacts and
entries remain in local QA for reproduction; no destructive cleanup performed.

## Mobile tap/navigation follow-up — 26 October 2026

Owner additionally reports odd taps/card/menu navigation and needing refresh.
Repeated the real phone-sized UI journeys with touchscreen taps, then CPU4×,
150ms latency and approximately1.6Mbps download. Measurements below are single
exploratory observations, not a stable benchmark or a physical-device claim.

**UQA10 — P1: correcting a personal Got money entry forces payment method.**
Open a Got money row → three dots → Correct this entry. Change amount and give
a valid audit reason; Save correction. The form says Choose how you received
the money and refuses the correction until Cash/UPI/Bank/etc is selected.
Original entry had no method, deliberately stored NULL. The correction surface
reintroduces Received via and UTR/cheque number, besides Date. Expected: an
unspecified personal receipt remains unspecified; audit reason remains required.
The new simple entry path and old correction form are inconsistent. No invented
payment method was selected during this test. Screenshot got-correction-blocked.

**Stale-list observation, accurately distinguished from permanent failure:**
Save0.63 then Back: the person's detail immediately showed48.00 but the list
initially painted cached48.63 and total348.63. Later observation showed48.00/
348.00 without reload. Reproduced with another0.25 save: first list48.00/348.00,
then47.75/347.75 automatically, matching a later reload. A final0.01 save with
CPU/network throttling reached47.74 in the list within860ms from Back tap; total
347.74. No permanent refresh requirement was reproduced on these journeys.
Transient old money while a list refreshes is observed; further testing must
check the busy/old-data indication during that exact interval. Do not label this
a permanently stale cache or an arithmetic defect on this evidence.

**Tap/overlay results:**
- Card opened the intended person, no reload; first unthrottled observation869ms.
- Three dots opened the correct action sheet; first52ms, reopen48ms. One sheet,
  no accidental entry action; Escape closed it. Throttled observation269ms.
- Entry drawer first open831ms on this session. Lazy first-open delay is visible;
  don't conclude a tap was ignored merely because a chunk is still arriving.
- Rename → detail updated without reload → Back list had new name and balance.
- Save → detail amount and entry count updated without reload.
- Back after entries, reopening person, and repeated menu open/close all worked
  in this sample. Physical OS Back/gesture, installation and touch hardware remain
  untested; do not dismiss the owner's report because this desktop emulation passed.

Coverage addition: mobile card tap, three-dot open/reopen, correction of receipt,
local Back after save, rename propagation, transient cached money, slow CPU/network.
UQA10 joins UQA01–04 as a fix-before-release finding. This is an audit-only
checkpoint; no application code changed and no fresh passing whole-module score
is assigned. Existing scoped8.6–8.8 ratings do not override these discovered gaps.

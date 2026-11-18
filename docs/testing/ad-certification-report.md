# A–D certification report (31 Oct – 1 Nov 2026)

**Verdict: ready for Part G, with the open items in §6.** Every critical and
high defect found in scope (Parts A–D) is fixed and retested on the live
stack. Nothing in G was started; it waits for the owner's word.

Stack: local Django API (:8000) + the production Next build (:3005), real
PostgreSQL. Test data: isolated QA businesses and people
(`e2e/fixtures/ad_cert_people.py`) plus the existing scale test business.
No production data was touched.

## 1. Results at a glance

| Area | Harness / run | Result |
|---|---|---|
| Roles × businesses, isolation, switching, two tabs, session | `e2e/ad-certify.mjs` | **77/77** (`--skew` fails 3, so the read-backs can fail) |
| Onboarding of 8 kinds by one person, switching | `e2e/ad-onboard.mjs` | **34/34** |
| Every A–D piece's own harness | `e2e/b-regression.sh` (37 harnesses) | **37/37** (a7-measure after a harness fix, §4) |
| Brutal monkey, owner: 12 areas × 2 seeds × 390/1280 | `e2e/monkey.mjs` | **47/48** pass; 1 = check not applicable (§4) |
| Monkey as Staff (5 areas × 2 sizes) | `--login=qa-staff…` | **10/10** |
| Monkey as Accountant (5 areas × 2 sizes) | `--login=qa-acct…` | **8/10** pass; 2 = no-access page, check not applicable (§4) |
| D screens monkey (8 screens × 3 seeds × 2 sizes) | earlier in D | **48/48** |
| D look sweep (320/390/1280 × light/dark × EN/HI) | `e2e/d-look.mjs` | **300/300** |
| D edge cases (catalogue E1, E9, E11, E17, E19) | `e2e/d-edges.mjs` | **10/10** (`--skew` fails 2) |
| Older suites | security / journey / parties / credentials | **10/10, 56/56, 30/30, 21/21** |
| Older suites | ledger, statement, tags, credit | **blocked** — stale harnesses (§5) |
| Earlier revamp-wave suites | revamp-customers, revamp-person, revamp-bills | pass |
| Earlier revamp-wave suites | revamp-udhaar-person, personal-udhaar-journey, revamp-khata-people, revamp-purchases-register | **blocked** — stale harnesses (§5) |
| Backend unit suites touched | purchases, inventory, sales, ledger, platform | pass, except 1 pre-existing (§6) |

## 2. Scenarios — expected vs actual (all passed unless marked)

**Onboarding & business set-up** — One person adds kirana, medical,
electronics (mobile), garments, auto parts, hardware, food, jewellery. Each is
created, active, the list grows by one, its features are its own (medical
batches; mobile serials + orders; clothes variants; auto parts numbers +
orders; food add-ons; kirana none), the medical store says "Distributors",
and its menu has its rows and not another kind's. Switching medical → mobile
keeps each one's features.

**Roles in one business (QA Kirana)** — expected from the role matrix
(`apps/common/permissions_registry.py`), checked by API, sidebar and typed URL:

| Action | Owner | Admin | Staff | Accountant |
|---|---|---|---|---|
| Create item | ✓ 201 | ✓ 201 | ✗ 403 | ✗ 403 |
| Adjust stock | ✓ | ✓ | ✗ 403 | ✗ 403 |
| Start a bill | ✓ | ✓ | ✓ | ✗ 403 |
| Void a bill | ✓ | ✓ | ✗ 403 | ✗ 403 |
| See cost price | ✓ | ✓ | hidden | ✓ |
| Team list | ✓ | ✓ | ✗ 403 | ✗ 403 |
| Business settings | ✓ | ✓ | ✗ 403 | ✗ 403 |
| Sidebar Settings / typed `/settings/team` | shown / opens | shown / opens | hidden / nothing of the team | hidden / nothing |

**Mixed roles** — qa-mixed is Staff in QA Kirana and Owner of QA Mobile: in
Kirana item 403 and team 403; switched to Mobile item 201 and team 200; back in
Kirana 403/403 again; the sidebar differs between the two. Nothing carried over.

**Isolation** — From QA Kirana, QA Medical's item, customer and bill are 404
by id; editing the item and deleting the bill draft are 404; item and customer
search find nothing; a Kirana bill cannot use the Medical item or name the
Medical customer; qa-staff (Kirana only) cannot switch into QA Medical and
lists only QA Kirana; typing the Medical item's URL shows nothing of it; a
QA Mobile item is 404 from QA Kirana for the same person.

**Role change** — the owner makes qa-staff an Admin: their next request (after
the app's token refresh) may create an item; back to Staff: refused at once;
qa-mixed stays Owner of QA Mobile throughout.

**Two tabs** — a bill draft open in QA Kirana while another tab switches the
session to QA Medical: the save is refused (409 `tenant_context_changed`) and
nothing is written into QA Medical.

**Session** — signed out mid-bill: a write is refused (401/403) and the bill
screen sends the person to sign in.

**Kinds** — Medical has Expiry and batches; Mobile has Find by IMEI; Kirana has
neither; nobody has jewellery screens. The item form shows MEDICINE DETAILS
in a medical store and PHONE DETAILS in a mobile shop, saves tracking and
warranty (read back), and hides Opening stock for a tracked item; a kirana's
form has neither.

**Monkey** — random taps, typing, keys, scrolls, reloads, Back/Forward and
wandering, failing on any crash, console error, 5xx, overflow or lost bill
lines: /dashboard, new bill, bills list, new purchase, contacts, items, stock
summary, payments, expenses, reports, settings, Udhaar book — as owner, staff
and accountant, phone and desktop.

## 3. Bugs found, severity, root cause, fix

| # | Severity | Bug | Root cause | Fix | Retest |
|---|---|---|---|---|---|
| 1 | **High** | No way on screen to make a batch- or IMEI-tracked item; batches, Expiry, IMEI unusable for a real shop | The design's per-kind item-form groups (MEDICINE / PHONE DETAILS) were never built; D harnesses created tracked items by API | `ItemTrackingFields.tsx`; Opening stock hidden when tracked; server message names batch vs IMEI | ad-certify K, unit tests |
| 2 | **High** | Return to distributor refused every medicine ("Enter the batch number") and phone ("Enter 1 IMEI"); had it passed, the batch/IMEI stayed in stock | A debit note re-validates its lines like a purchase but carried no batch/IMEI, and never touched the batch or serial ledgers | The note names the bill's batch and the bill's IMEIs on the shelf; takes them out; a void puts back exactly that | d4-batches, d3-imei, unit tests |
| 3 | Medium | New medical / mobile / clothes businesses did not get batches / IMEI / sizes; Expiry and Find by IMEI in every business's menu | Presets lacked the features; the menu rows had no feature gate | Presets + new feature `serials`; migration `platform 0022` turns on the false older medical/clothes businesses were given unasked; rows gated | ad-onboard, ad-certify K |
| 4 | Low | A phone sent back read "No phone with this IMEI" | The serial row was deleted on return | Marked `returned`; shows "Returned to supplier · Debit note DN/… · date" | d3-imei |
| 5 | Low | Camera scan of an unknown code only buzzed; "not found" appeared after closing | The not-found state was shown only outside the camera sheet | "Not found: <code>" in the camera tray | c1-scan |
| 6 | Low | Two words cut at 320 px ("Saved custom…", "In books 4 · Not cou…") | Fixed padding / truncating card meta | Narrow padding below 360 (14 px kept); compact card | d-look, a3 |

All fixes are committed with a test that failed before them and pushed to
`dev` and `shop/a2`.

## 4. Harness corrections (not product defects)

- a7-measure measured the empty-state cell of an empty "This month" Expenses
  register on the 1st of the month as a data row (0 px padding); it now
  measures data cells only → 32/32 views.
- The monkey's "no reload/return ever happened with lines on the bill" fires
  on pages with no bill (a list page; an accountant's no-access new bill). It
  is the bill-lines invariant not applying; no crash, error or 5xx occurred.
- Eight older suites launched a browser this machine does not have, and
  credentials read the API log from the wrong folder; both now configurable.

## 5. Blocked (stale harnesses, to be maintained — not product failures)

These predate the A–D revamp of the same screens and wait for selectors,
ports or data the revamp replaced; the current screens are covered by the
A–D harnesses above:

- `ledger.mjs`, `statement.mjs`, `tags.mjs`, `credit.mjs` — wait for pre-revamp
  test ids (`text=Transactions`, `filters-button`, `ub-grid`).
- `revamp-udhaar-person.mjs`, `personal-udhaar-journey.mjs` — hard-code
  `127.0.0.1:3000`.
- `revamp-khata-people.mjs`, `revamp-purchases-register.mjs` — wait for a
  response / pagination that their earlier data produced. *Unproven*: not
  re-baselined in this pass, so treat their screens as covered only by the
  A–D harnesses.

## 6. Remaining risks / open items

1. **Personal Udhaar (Money book) table not in tenant export/deletion** —
   `test_tenant_data.py` fails on `parties.PersonalBook`. Data-integrity risk
   for export and account deletion. From the personal-Udhaar work, outside
   A–D; needs its owner thread.
2. Architecture rules broken by the same work: `parties/urls_personal.py`
   imports ledger, `personal_book.py` imports DRF; a stray `.claude` folder
   under `backend/apps`; a pending `parties 0014` migration.
3. Debit note picks the bill's IMEIs on the shelf automatically (lowest
   first); there is no screen to choose WHICH phone goes back. Fine for one
   phone per return; a choice is a later improvement.
4. Exclusions (later parts): all of Part G (jewellery, short book, Schedule H,
   repairs, sites, vehicle history, schemes, advance orders, loose/phone
   orders), D15 messages needing those records, print Size/Part no. columns
   and warranty/licence footer lines, B3 feature switches in Settings, Parts
   F, H, I and E.

## 7. Readiness for G

Ready. Role isolation, business isolation, switching and the A–D workflows
hold on the live stack; the two high defects are fixed and retested. Items 1–2
in §6 belong to the personal-Udhaar work and should be fixed there; they do
not block G. **G starts only on the owner's instruction.**

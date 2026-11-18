# Home 2 of 3 · Shop promises · 25 Oct 2026 (BP-16, R-DEC-26, R-DEC-32, R-DEC-34)

Scope: a new `parties_shop_promise` table (one open promise per contact AND
role) with `GET/POST /parties/{id}/shop-promises`, `PATCH
/parties/shop-promises/{id}`, `POST …/{id}/kept`, `POST …/{id}/cancel` and
`GET /parties/shop-promises` (open ones due within a week, for Home); on the
Shop person page a promise card in place of the Udhaar book's collection date;
on Home's Follow-ups a Promises panel, and the lanes' captions.

Who needs it: the shopkeeper or counter staff who hear "I'll pay 1,500 on
Friday" from a customer, and the owner who promises a supplier a date. Before
this the Shop borrowed the Udhaar book's collection date for it (DEC-019
forbids that), it had no amount, no history and no place on Home. What it
saves them: remembering who said what on paper, and on the day, a row on Home
saying who promised what with what they owe NOW, one tap from Remind or Pay.

## Spec-to-check map

| Requirement | Source | Check | Status |
|---|---|---|---|
| Separate Shop record: business, contact, role, date, optional amount, state, actor/history | 08 BP-16 | model, migration 0012, audit rows with before/after; `test_every_change_is_audited_with_before_and_after` | passed |
| Do not reuse Party.collection_date or Udhaar promises | 08 BP-16 | `test_a_promise_moves_no_money_and_leaves_the_udhaar_date_alone`; the Shop page no longer shows the Udhaar date | passed (deviation 2) |
| Record/edit/complete without altering invoices, due dates, balances | 08 BP-16 | no Payment or LedgerEntry written (test); e2e reads Home's figures before and after | passed |
| Home and person pages use the same source | 08 BP-16 | both read `selectors/shop_promises.py` | passed |
| No automatic SMS/WhatsApp; manual reminder keeps the composer and fresh Shop amounts | 08 BP-16 | Home's Remind opens the existing `ShopCustomerReminder` with the server's current balance; e2e opens it | passed |
| A person in both roles | acceptance | `test_a_person_in_both_roles_holds_one_promise_per_role`; supplier page "Your promise to pay" live | passed |
| Archived / removed role | acceptance | archived refused (409 `party_archived`); a role the contact lacks refused (400) | passed |
| Expired promise | acceptance | late computed on the business's clock (`test_a_promise_is_late_by_the_businesss_clock`), said "Promise 2 days late" | passed |
| Partial / full payment before reminder | acceptance | Home shows today's balance; no Remind/Pay when nothing is due (`HomePromises.test.tsx`) | passed (unit; not reproduced live) |
| Concurrent edits | acceptance | version check, `stale_version`; one open per role under a race (partial unique index → `promise_already_open`); the card reloads | passed |
| Duplicate submit / retry | R-DEC-32 | idempotent POST/PATCH/close; control keeps the key on retry; e2e double taps record one and close once | passed |
| Shared owner/staff permissions; another business; business switching | acceptance | staff write, accountant reads only, deny-override 403, other tenant 404/empty; Home's read is keyed by the business scope | passed |
| Tenant timezone/date boundaries | acceptance | past date judged by `tenant_today`; dates formatted as calendar dates (UTC) so a browser west of Greenwich cannot shift them | passed by construction, not by a midnight test |
| No customer document exposes the internal note | acceptance | note not on Home, not in the reminder text (e2e) | passed |
| Notification recipients | acceptance | no notification is sent for a promise | not applicable |
| Migration, rollback, feature-off keeps history | 08 BP-16 | additive table; rows stay when unused; export `shop_promises.csv` and deletion via the PLT-10 registry | passed (no rollback test) |
| Home Follow-ups row "X promised ₹1,500 today · Owes ₹3,100 · 42 days late · Remind" | Counter Mode rev 3, line 887 | HomePromises tests; e2e; screenshot at 1280 | passed |
| Lane caption "42 days late · promised ₹1,500 today" | rev 3, line 914 | lane test path; shown only when that customer is one of the lane's rows | passed (not seen live: the promised customer was not in the lane's top three) |
| 44 px, no cut text, no broken figure, EN/HI 320–1280 | R-DEC-32 gates 3, 7 | e2e measuring checks, 70/70 | passed (finding 2) |

## Found by measuring and by the live run

1. **The card cost the person page 5.3 KB.** A build of 9bdb109 measured the
   route at 114.1 KB and this piece at 119.4; 4.2 KB of it was the parties
   catalogue carrying the card's 27 strings in two languages. The card reads
   its own record after the page paints anyway, so it is `dynamic()` with its
   own catalogue and a placeholder its size (114.0 KB now). The form's words
   load with the form, Home's with Home.
2. **Phone tap areas.** Promise kept, Remind and Pay were 28 px faces with no
   hit area; then, with one, the wrapped Cancel promise covered Promise kept's
   lower edge (12 px between lines, 8 px overhang each). Both fixed; the
   harness had also measured Home's buttons while below the fold, where
   `elementFromPoint` returns nothing, and now scrolls them into view.
3. **The catalogue check** caught Home rendering the parties catalogue and the
   person page the reports one, through one shared view-model; the words were
   split by screen, and the key-free facts both use are a module of their own.
4. **The shared app chunk** went fractionally over its ceiling for two API
   paths; they moved to the promise service rather than raising a shared limit.

## Deviations and decisions recorded

1. **No automatic close on payment.** A payment can be partial, or for another
   bill, so the shopkeeper taps Promise kept; the snackbar says to record the
   payment, and Home stops offering Remind once nothing is due.
2. **The Udhaar date is off the Shop person page, but not yet off the Shop's
   form and list filter.** `PartyFormDrawer` (Shop) and `ShopPartyFilterDrawer`
   still read `collection_date`. Removing them removes a capability, so it is
   left for the owner's word.
3. **Writing is `parties.party.write` in the Shop book**, the same pair that
   lets counter staff set a collection date: taking "I'll pay Friday" is
   counter work. No new permission was invented.
4. **Cancel promise has no confirmation.** It closes, keeps the promise as
   history, and a new one is one tap away.
5. **Saving needs a connection** (`online-only`), because one open promise per
   role cannot be enforced against a queued write.
6. **Bundle**: /dashboard route 93.4 → 95.2 (measured 94.9), first load 336 →
   337.1; /parties/[id] first load +0.1 for the loader. Three pages with none
   of this code moved 0.0–0.2 KB, as 9bdb109's own build did on two others.
   Raised by measured + 0.3 with a note.

## Performance

`data/2026-10-25-shop-promises/spab.sh` and `spperf.mjs`: 9bdb109 (old,
worktree) against this build, four alternating rounds, six opens per page per
viewport per round, 4x CPU throttle, QA book. The person page is timed to its
balance drawn, Home to its cash figure drawn. n = 24 per cell.

| | old median (range) | new median (range) | |
|---|---|---|---|
| Person page, phone 390 | 1,204 ms (1,013–1,811) | 1,217 ms (1,064–1,415) | level (+1.0%) |
| Person page, desktop 1280 | 1,268 ms (1,172–1,450) | 1,312 ms (1,126–1,661) | +3.4%, slower in 3 of 4 rounds |
| Home, phone 390 | 901 ms (818–1,889) | 931 ms (826–1,855) | +3.3%, slower in 3 of 4 rounds |
| Home, desktop 1280 | 896 ms (793–1,976) | 925 ms (729–2,039) | +3.2%, slower in 2 of 4 rounds |

Recorded as a small cost of up to about 3%, possibly real, not as level: Home
now makes one more request (the open promises) and the person page loads one
more chunk. Neither is on the path to the figure measured, so the cause is
inferred, not traced.

## Competitor comparison

Not done for this piece; unproven.

## Gates

| Gate | Result |
|---|---|
| `test_shop_promises.py` | 16 passed |
| Backend suite (whole) | 2 known failures that predate this piece (`test_shop_aging_does_not_expose_udhaar_promise_or_limit[csv]`, `test_five_thousand_schedules_run_under_a_minute`); 14 more failed because settlement work was being written in the same tree while the suite ran (a new table its migration had not yet created, and a payments import rule). Those 14 were rerun with that work in place and pass. |
| `ShopPromiseControl.test.tsx` + `HomePromises.test.tsx` | 8 + 5 passed |
| `npx jest` (whole frontend) | 433 suites, 4,819 tests passed |
| `npm run type-check`, `npx eslint --max-warnings=0` (parties, reports) | clean |
| `npm run i18n:split && npm run i18n:check` | pass |
| `npm run build` + `npm run bundle:check` | pass (deviation 6) |
| `node e2e/shop-promises.mjs` (live stack, QA book, writes promises locally) | 70/70 |

# Home 3 of 3 · Customer–supplier settlement · 25 Oct 2026 (BP-08, R-DEC-26, R-DEC-32, R-DEC-34)

Scope: a `payments_shop_settlement` row linking two existing adjustment
payments (a receipt from the person as a customer, a payout to them as a
supplier), `GET/POST /payments/shop-settlements`, `GET …/candidates` (Home),
`POST …/{id}/share` (the message); cancelling either half through the existing
`POST /payments/{id}/void` cancels both. On screen: the "Settle two balances"
dialog (Counter Mode `#customers`), reached from the person page ⋯ and from a
note on Home under the two lanes, "Ramesh Traders is in both lists".

Who needs it: a shopkeeper who sells to somebody who also supplies the shop —
the wholesaler who buys a few cases back, the farmer who sells grain and buys
seed. Each side is its own list and its own figure (D-03, DEC-019), so until
now the only way to square them was to record a cash receipt and a cash payment
that never happened, which put fictional cash into the drawer, the day's
"Received" and the cashbook. What it saves them: one confirmation that settles
the bills on both sides, keeps the cash figures honest, and leaves a linked
record that can be undone as one.

## Spec-to-check map

| Requirement | Source | Check | Status |
|---|---|---|---|
| Lists never netted; settling only by an explicit step | 02 §1.4, D-03, 08 §3.3 | role selectors untouched; the note and the dialog are the only entry points | passed |
| Two figures side by side, amount prefilled with the smaller and capped | Counter Mode `#customers`, 08 §3.3 | dialog test; e2e reads both boxes and the prefill against the server | passed |
| "After this" before anything is written | `#customers` | `balancesAfter` test; e2e | passed |
| Keep separate has the focus | `#customers` | e2e reads `document.activeElement` | passed |
| Audited, idempotent, atomic non-cash source through the existing allocation rules | 08 BP-08 | `settle_shop_roles` locks the party, re-reads both balances, writes two `record_adjustment` payments (FIFO over open invoices and bills) and the settlement row, audit `SHOP_SETTLEMENT_RECORDED` with before/after; `@idempotent` | passed (23 tests) |
| No stock, tax, revenue or cash movement | 08 BP-08 | dashboard `money_received_today`, `period_figures` and `money_series` exclude `primary_mode=adjustment`; e2e compares received, period received and Shop cash before and after | passed |
| Current balances at confirm; two devices | 08 BP-08 | `expected` figures checked under the lock (409 `settlement_balances_changed` with the new figures); threaded test settles no more than the smaller | passed |
| Partial / full / zero / negative / over | 08 BP-08 | tests and e2e (over refused on screen and by the server) | passed |
| Customer-only contact, archived, other business, module off, no permission | 08 BP-08 | 409 `settlement_not_dual_role`, 409 `party_archived`, 404, 403 tests; e2e: a customer-only contact is not offered it | passed |
| Reversal by the immutable correction rules | 08 BP-08 | cancelling either half voids both and stamps the settlement; e2e cancels through the receipt and reads both balances back | passed |
| Merchant-readable record, message signed only by the business | 08 BP-08, CLAUDE.md | each half's receipt says "Settled, no cash"; share text test and e2e (no product name) | passed |
| Data export and deletion | PLT-10 | `tenant_data` registers `shop_settlements.csv` | passed |
| Offered from Customers/Suppliers rows and the bill "Something's wrong" sheet | 08 §3.3 | — | not built (deviation 1) |
| 44 px targets, no cut text, no broken figure, EN/HI 320–1280 | R-DEC-32 gates 3, 7 | e2e measuring checks | passed |

## Found by looking

1. **The dialog's test id never reached the page.** `UbDialog` does not
   forward `data-testid`, so the harness's first run waited 30 s for a
   dialog that was on screen. The dead attribute is gone; the harness finds
   it by role.
2. **Home's register labelled a settlement "Settled with their customer
   balance"**, which wrapped to four lines in the register's narrow kind
   column at 1280 and made two rows the tallest on the screen. Now "Settled,
   paid" / "Settled, received" (Hindi "बराबर किया, दिया / मिला").
3. **"After this" sat on the same line as the first result** and the second
   result wrapped under the caption, so the two figures did not line up on a
   phone. The caption has its own line now (320 px screenshot checked).
4. **"Traders's"**: the reference's possessive title broke on names ending
   in s. The title is "Settle two balances" with the name in the subtitle.
5. **The share message went to the server in `en-IN`**, which the server does
   not know, and fell back to the business's language. It sends the app's
   `en`/`hi` now.

## Deviations and decisions recorded

1. **Not offered from the Customers/Suppliers rows or a bill's "Something's
   wrong" sheet.** The person page ⋯ and Home's note reach every dual-role
   contact; the other two are more doors to the same dialog, left for the
   owner's word rather than added on spec.
2. **The day book lists the two halves** as a payment in and a payment out of
   ₹0 cash and ₹0 bank. They are labelled, they move no cash total, and
   hiding them would hide a record from the book the accountant reads.
3. **Print** uses each half's existing receipt; there is no combined
   settlement print. The message (share sheet, editable) is the customer-facing
   record.
4. **Permission** is `payments.payment.write` plus `parties.party.read` in the
   Shop book — what recording either half on its own needs. No new codename.
   Cancelling is owner/admin, as for any receipt.
5. **Home names one person** (the most to settle) and counts the rest: a list
   of everyone in both lists would push the lanes below the fold on a phone.
6. **Bundle**: /dashboard route 95.2 → 95.8 (measured 95.5), first load
   337.1 → 337.8; /parties/[id] route 114.3 → 114.6 (measured 114.3);
   /reports/day-book moved by rounding only. The note, the dialog and their
   words are all `dynamic()`: with the note imported statically Home's route
   grew 0.8 KB, lazily 0.3.
   Raised by measured + 0.3 with a note.

## Performance

`data/2026-10-25-shop-settlement/ssab.sh` and `ssperf.mjs`: c4f37e1 (old,
worktree, the commit before any settlement code) against this build, four
alternating rounds, six opens per page per viewport per round, 4x CPU throttle,
QA book (which has nobody in both lists, so Home makes the candidates request
and draws no note). The person page is timed to its balance drawn, Home to its
cash figure drawn. n = 24 per cell.

| | old median (range) | new median (range) | |
|---|---|---|---|
| Person page, phone 390 | 1,323 ms (1,189–1,550) | 1,314 ms (1,189–1,599) | level (−0.6%, slower in 2 of 4 rounds) |
| Person page, desktop 1280 | 1,499 ms (1,191–1,729) | 1,506 ms (1,254–1,904) | level (+0.5%, slower in 3 of 4) |
| Home, phone 390 | 969 ms (865–2,155) | 986 ms (875–2,195) | level (+1.7%, slower in 2 of 4) |
| Home, desktop 1280 | 1,048 ms (802–1,999) | 1,020 ms (874–2,112) | level (−2.7%, slower in 1 of 4) |

Recorded as level: every difference is under 3% and changes direction between
rounds. Home makes one more request (the candidates), off the path to the
figure measured; a shop with someone in both lists also loads the note's chunk,
which this book does not exercise, so that case is unmeasured.

## Competitor comparison

Not done for this piece; unproven. No competitor was observed doing this task,
and nothing here claims an advantage.

## Gates

| Gate | Result |
|---|---|
| `test_shop_settlement.py` | 23 passed |
| `apps/payments` + `apps/reports` | all pass except `test_shop_aging_does_not_expose_udhaar_promise_or_limit[csv]`, which predates this piece |
| Backend suite (whole) | 2 known failures that predate this piece (that one and `test_five_thousand_schedules_run_under_a_minute`) |
| Frontend unit tests (payments, reports, parties) | 72 suites, 688 tests passed |
| `npx jest` (whole frontend) | 436 suites, 4,830 tests passed |
| `npm run type-check`, `npx eslint` | clean |
| `npm run i18n:split && npm run i18n:check` | pass |
| `npm run build` + `npm run bundle:check` | pass (deviation 6) |
| `node e2e/settlement.mjs` (live stack, fresh business) | 74/74 |

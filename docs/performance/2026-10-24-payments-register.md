# Payments register · 24 Oct 2026 (08 §9, R-DEC-32, R-DEC-33, R-DEC-34)

Scope: `/payments` (`PaymentsPageContent`, `PaymentColumns`, the new
`PaymentListStats`, `usePaymentList`, `paymentListSlice`). The receipt page
(§10), its cancel dialog (§10.1) and share sheet (§10.2), and the Receive
payment drawer (§6) are NOT covered; they are the next pieces.

Who needs it: the owner at day end ("what came in, what went out today?") and
staff finding a receipt to reprint. The job is to find one payment, check a
period, or reach a wrong one to cancel it.

## Spec-to-check map

| Requirement | Source | Check | Status |
|---|---|---|---|
| Shop money only (C-3) | 08 §9 Book, DEC-019 | verified first on the QA book: 10,492 payments listed, 7,515 of them the Shop's, the rest Library fees and Lending money; now every request sends `bucket=shop` (page test; harness asserts every request and that the period has other apps' payments the page leaves out) | passed (fixed) |
| Header "Payments" + Receive payment | 08 §9 Phone | harness opens the drawer from it | passed |
| Received ₹… · N payments and Paid out ₹… · N payments, separate, cancelled not counted | 08 §9 | harness compares both figures with the server's Shop totals | passed |
| Search "Name or receipt number"; a receipt number finds it in one step | 08 §9, Fewer taps | harness types a real number and gets that receipt | passed |
| All · Received · Paid out · Cancelled | 08 §9 | chips on phone and desktop; Cancelled sends `status=void` with `bucket=shop` (harness) | passed (deviation 1) |
| Period and Mode | 08 §9 | Filters sheet on a phone; period and mode selects on a desktop (unchanged behaviour) | kept |
| Card: name, "number · mode · date", amount with its word; cancelled struck with "Cancelled" | 08 §9 Phone | page tests; harness creates and cancels a ₹1 receipt and reads it | passed (deviation 2) |
| Desktop table Date · Number · Name · Mode · Amount · Status; row opens the receipt | 08 §9 Desktop | harness reads the headers at 1280 and opens a row | passed |
| Register fits the viewport: page does not scroll, rows do; phone appends, desktop pages | R-DEC-30, R-DEC-33 | harness: page scroll 0 at all four widths; a scroll joins page 2 (25 → 50 cards); pager only on desktop | passed |
| Chips 32 px face, 44 px target on a phone | R-DEC-32 #3 | harness at 390 and 320, EN/HI | passed |
| First use "No payments yet" + Receive payment; quiet period; filtered empty + Clear filters; error + Try again | 08 §9 States | page test (first use); the rest unchanged | partly re-proven |
| Names wrap; tabs scroll at 320 | 08 §9 Long/Hindi | harness: no cut text, no sideways page scroll at 320 EN/HI | passed |
| Filters in the URL | 08 §9 Must keep | unchanged hook; harness reads `tab=void` from the address | kept |
| Totals over the filtered set; voids visible | PAY-05 FR-8 | server totals; Cancelled chip lists them | kept |
| Stale banner, offline cached, no-permission page | 08 §9 States | unchanged code paths, not re-run | not re-proven |

## What changed

- **The Shop's money only.** The list asked for every app's payments. On a
  business with the Library or Lending on, the Shop's register listed fee
  receipts and loan money, and its Paid out figure counted them (on the QA
  book across all dates, ₹7.49 crore paid out against the Shop's own ₹3.49
  crore). The
  register now asks for `bucket=shop`, which the server already filtered on.
- **Mobile register (R-DEC-33).** Joined cards that fill the screen below the
  controls, the next page joining as the list is scrolled, no page arrows; on a
  desktop a table that pages inside its own frame. The slice keeps the cards
  while the next page loads and lets only the latest request's answer in.
- **Chips instead of tabs**, visible on a phone as on the bills register; the
  Filters sheet keeps the period and the mode.
- **Words.** "Void" is "Cancelled" (in the list, the receipt badge, the bill's
  payment line and the Library's history, which share the word). A receipt with
  nobody named reads "Quick Sale" in the list, not "Customer"; the printed
  receipt keeps "Customer". The search says "Name or receipt number". The empty
  business says "No payments yet"; a quiet period says "No payments in this
  period".
- **Money colours.** Money in is the green of money got; money out is plain
  ink. Before this, money RECEIVED was painted in the red of money given, and
  supplier payments in green.
- **Below 1280 px** the date and number join under the name, as on the bills
  register.

## Deviations and decisions recorded

1. **Chips, not tabs, and visible on a phone.** §9 puts All · Received · Paid
   out · Cancelled inside the phone's Filters sheet and as tabs on a desktop.
   The later owner decision for registers (R-DEC-33, the bills register) keeps
   the status chips visible on both; I followed it so the two registers work
   the same way.
2. **The card shows the date, not the time.** §9's card reads "RCT/… · Cash ·
   4:31 pm". The default period is This month, so a time without its day is
   ambiguous; the card says the date.
3. **"Contact", not "Name"**, as the column header: the owner's plain-labels
   rule (20 Oct) names a shared identity column Contact, and this list holds
   customers and suppliers.
4. **The Allocated column is gone** from the table, because §9 names six
   columns; what a payment settled is on its receipt.
5. **A cancelled ₹1 receipt is left on the QA book** by the harness each run
   (named "QA88"), because the book had no cancelled payment to read.

## Found by looking

- Money received in red, supplier payments in green (above). Every test passed
  through it; the colour token was the wrong one in the old columns too.
- At 1024 px the Date column cut "24/10/2026" to "24/10/202" and PAYOUT
  numbers split across two lines. The harness did not see either, because a
  table cell hides overflow without an ellipsis; it now measures each text
  against the box that clips it and fails a receipt number split across lines.
  It failed on that build first, then passed after the fix.
- On the Cancelled chip the strip read "Received · 0 payments ₹0.00" above a
  list of cancelled payments; it is hidden there now.
- The harness's first Cancelled check failed on its own timing (networkidle
  before the request was sent); it waits for the request now.

## Performance

Opening the register: from navigation until the first payment (a card or a
row) is visible, at 4x CPU throttle, against `dcaddbc` (the old register). Each
side had 6 opens per viewport per round, 4 rounds alternating old and new, on a
phone (390×780) and a desktop (1280×900). Scripts and raw numbers:
`data/2026-10-24-payments-register/` (`paab.sh`, `paperf.mjs`).

| | old median | new median | n per side | new range |
|---|---|---|---|---|
| Phone | 1,218 ms | 1,248 ms | 24 | 1,068–1,963 ms |
| Desktop | 918 ms | 1,028 ms | 24 | 754–1,619 ms |

The phone is level (+30 ms, inside the spread between rounds). **The desktop
is slower**: +227 ms over the first two rounds and +43 ms over the second two,
+110 ms over all 24. The first pair of rounds had one slow new round (1,283 ms
median) and one faster than old (908 against 948), so the size is uncertain,
but the direction held in three of four rounds and I record it as a cost. The
old page also listed other apps' payments, so the two sides did not fetch the
same rows. Not isolated further; the likeliest parts are the viewport-fitted
register layout and the 1,280 px media query, which re-renders the table after
hydration exactly as the bills register's does.

Bundle: every route inside its budget, no raise.

## Competitor comparison

Not done for this piece; unproven.

## Gates

- Jest: 4,735 of 4,735 passed, including 6 new page tests; the first four (Shop bucket,
  Cancelled in words, phone append, empty book) were run against the old page
  and failed there.
- Type-check and lint (`--max-warnings=0`): both clean on the full tree.
- i18n split and check: passed.
- Production build: passed. Bundle check: passed, no raise.
- `e2e/payments-register.mjs` (new): 55 of 55 against the local QA stack, at
  390/320/1024/1280 in English and Hindi.

## Scores (payments register only, provisional)

| Point of view | Score | Evidence | Still weak | Confidence |
|---|---|---|---|---|
| Function | 8.6 | Shop money only, proven on a book with three apps; totals equal the server's; search, Cancelled, append and open all read back | Stale, offline and no-permission states not re-run | Medium-high |
| Busy shop | 8.3 | Receipt number search in one step; chips one tap | Card is three lines when the number is long | Medium |
| UI/UX phone | 8.5 | Measured EN/HI at 320/390; page does not scroll | Chips scroll sideways at 320 | Medium |
| UI/UX desktop | 8.4 | Six columns at 1280; joined date at 1024; nothing clipped | Status column mostly empty | Medium |
| Performance | 7.6 | Phone level; desktop about 40–230 ms slower at 4x CPU depending on the round, n=24 a side | Desktop cost not isolated | Medium-low |

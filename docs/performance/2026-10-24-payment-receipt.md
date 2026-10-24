# Payment receipt · 24 Oct 2026 (08 §10, §10.1, §10.2, R-DEC-32, R-DEC-34)

Scope: `/payments/[id]` (`PaymentReceiptPageContent`), its cancel dialog
(`VoidPaymentDialog` on the shared `ReasonConfirmDialog`), the share sheet as
this page opens it, and one line of the printed receipt
(`PaymentReceiptPrint`). The Receive payment drawer (§6) is NOT covered; it is
the next piece.

Who needs it: the counter, right after money changes hands ("send me the
receipt"), and the owner fixing a wrong receipt. The jobs are to hand the
customer the receipt, print it, see which bills it settled and what is still
due, and cancel it when it was a mistake.

## Spec-to-check map

| Requirement | Source | Check | Status |
|---|---|---|---|
| Header: number (whole), name or "Quick Sale", Received / Paid out / Cancelled badge | 08 §10 Phone | page test (Quick Sale); harness reads the badge | passed |
| Summary: amount, one line per mode with its reference | 08 §10 Phone | page test; harness compares Cash ₹1 + UPI ₹1 · 4417 with what it recorded | passed |
| Settled: "INV-0412 · ₹200 · ₹245 still due", the bill's due NOW | 08 §10 Phone | page test; harness compares the line with the server's allocation and checks the bill fell by exactly ₹2 | passed |
| "₹155 not used yet · Apply to bills" | 08 §10 Phone | wording changed; Apply dialog unchanged (its own tests) | kept |
| Date, Received from (link), note, Recorded by | 08 §10 Phone | harness LOOK | passed |
| Preview scrolls sideways inside its own box only | 08 §10 Phone | harness: no sideways page scroll at 390/320; the sheet keeps its A5 width | passed (fixed, finding 4) |
| Docked Share receipt (primary) · Print · ⋯ on a phone | 08 §10 Phone, decision "Share is the primary action" | page test (order); harness: three buttons, 44 px, nothing on top of them, directly above the bottom menu, at 390/320 EN/HI | passed (fixed, findings 1–2) |
| Desktop: Share receipt · Print · ⋯ in the header; panel left, print right | 08 §10 Desktop | harness at 1024 and 1280; side by side from 1280 | passed (deviation 2) |
| ⋯: Cancel receipt (owner/admin) or Ask owner to cancel (staff) | 08 §10, §10.1 | page tests for both | passed |
| Cancelled: grey banner "Cancelled on … · Reason: …" + Record again, no Share | 08 §10 | page test; harness cancels a real receipt and reads the banner in place | passed (deviation 3) |
| Cancel dialog: "Cancel RCT…?", what changes, quick reasons, 3–160 characters, footnote, Keep receipt · Cancel receipt, "Cancelling…" | 08 §10.1 | page test; harness reads the consequences against the server ("owes the Shop ₹2.00 more", "INV… will be due again: ₹2,283.35"), picks a quick reason, cancels; the server says void, number kept, and the bill is back to its due | passed (deviation 4) |
| Keep receipt keeps it | 08 §10.1 | harness (Hindi, 320 px): Keep, then the server still says recorded | passed |
| Success: banner swaps in place, snackbar "… cancelled" | 08 §10.1 | harness; the snackbar no longer covers Record again | passed (fixed, finding 2) |
| Share: one request for a double tap, then one sheet | 08 §10 Repeated taps | harness counts POST /share | passed |
| Share sheet: what is shared, the honest line, Copy · SMS · WhatsApp, editable text | 08 §10.2 | harness reads the heading and the honest line; no cut text at 390 | partly (deviation 5) |
| Message and print carry no product name or domain | 08 §10 Must keep | harness reads the server's message and the print text | passed |
| Print: no screen furniture; receipt numbers never split | 08 §10 | harness with `emulateMedia print` at 390 and 1280 | passed (fixed, finding 4) |
| Offline: Share held back, Print works, Cancel not offered, says why | 08 §10 States, §0.2 | page test; harness with the browser offline | passed |
| Loading, not found, no permission | 08 §10 States | unchanged code paths | not re-proven |
| `?print=1` opens print on arrival | 08 §10 Desktop | unchanged hook | not re-proven |
| Share text failure → snackbar, Print still works | 08 §10 States | unchanged hook and thunk | not re-proven |

## What changed

- **A summary a counter can read.** The amount, how it came (one line per
  mode), and each settled bill with what is still due on it now. Before this,
  the page said "Against INV… · ₹200" and the due was only on the print.
- **Share receipt is the main act, and on a phone it is docked** under the
  thumb with Print and ⋯. Before, five header actions became icons in a row on
  a phone; Void sat beside Share.
- **"Void" is "Cancel receipt"** in English and Hindi, with "Keep receipt" as
  the safe choice, and the dialog says what changes in the Shop's words ("Anita
  Verma owes the Shop ₹200 more", "INV-0412 will be due again: ₹445"). The
  Udhaar book's receipts keep "Khata:". The printed mark is "CANCELLED / रद्द".
- **A cancelled receipt is grey**, not amber: "Cancelled on 24/10/2026 by Scale
  Owner · Reason: Wrong contact", with Record again docked.
- **The share sheet** says what is being shared ("RCT/… · ₹2.00 from Verma
  Enterprises 1") and that we cannot know whether it was delivered.
- **Offline**, Share and Apply are held back with a line saying why; Print
  still works; Cancel is not offered (a cancel is not queued).
- Design system: `UbStatusBanner` has a `neutral` tone (grey) for a closed
  fact; the reason chips in `ReasonConfirmDialog` are `UbChoiceChips`.

## Found by looking

1. **The dock sat under the phone's bottom menu.** Inside the screen, visible
   in a screenshot at a glance, and impossible to tap: the first harness run's
   double tap on Share hit the menu. The harness's "inside the screen" check
   passed through it, so it now also asks the browser what is under each
   button's centre. The dock is sticky in the page column now, like the
   khata's, and rides above the menu.
2. **The "… cancelled" snackbar covered Record again.** The dock published
   only its own height; with the menu under it, the toast landed on the dock.
   It now clears both (`clearToBottom`). Found in the cancelled screenshot; the
   centre check above fails on it.
3. **"Cheque bounced" was cut to "Cheque boun…"** in the cancel dialog, and
   the five reasons were 20 px tags, one per line. They are 32 px chips with
   44 px targets that wrap and keep whole words; the harness measures the
   dialog at 390 English and 320 Hindi.
4. **"INV/25-26/5877" split over three lines** in the print's Against column,
   on screen at 390 (the sheet was squeezed to the phone's width) and in the
   print at narrow widths (`break-all`). The preview keeps the A5 width and
   scrolls sideways inside its box; the printed number never breaks. The
   harness checks the print for split numbers.

## Deviations and decisions recorded

1. **The share text is the server's**, unchanged: "Received Rs 2 from you on
   24/10 (Cash + UPI, UTR …4417). Against INV/… Balance: Rs 2 (we will give).
   Thank you — Shop". §10.2's example adds a greeting, the due on the bill and
   a link to the `/d/` page; that is a backend change (and the link needs the
   share-link work), so it waits for approval. The sheet's character counter
   and "Use the default text" are not added: they belong to the shared
   `UbShareSheet` and would change every sheet; recorded rather than done here.
2. **Side by side from 1280, stacked at 1024.** At 1024 the A5 sheet and a
   380 px panel do not fit beside the sidebar; the bill page makes the same
   choice (`xl`).
3. **The banner names who cancelled** ("… by Scale Owner"). §10's example
   omits the name; the old banner had it, and an owner reading a cancelled
   receipt wants to know who did it. Not removed.
4. **The dialog opens with the caret in the reason**, not on Keep receipt.
   §10.1 says Keep receipt takes default focus; the shared dialog focuses the
   reason for every cancel in the product (a reason is required, so Enter on an
   empty field cannot cancel). Changing it here would make this one dialog
   differ from the other seven. The harness confirms focus is never on Cancel
   receipt.
5. **QA data, not a page defect, but a money question for the owner:** on the
   QA book this customer's bills were posted to the Udhaar bucket before
   DEC-019 split the books, so the Shop balance on the receipt and in the
   message reads "Rs 2 (we will give)" while one bill is ₹2,281 due. New bills
   post to the Shop bucket. Whether any real business has bills in the old
   bucket is worth checking before the message's balance line is trusted.

## Performance

Opening a receipt: from navigation until the printed sheet shows the receipt's
number, at 4x CPU throttle, against `dcaddbc` (the old page). The same receipt
on both sides (RCT/26-27/3653, a customer's, one bill settled); 6 opens per
viewport per round, 4 rounds alternating old and new, phone 390×780 and desktop
1280×900. Scripts and raw numbers: `data/2026-10-24-payment-receipt/`
(`rcab.sh`, `rcperf.mjs`).

| | old median | new median | n per side | new range |
|---|---|---|---|---|
| Phone | 1,716 ms | 1,750 ms | 24 | 1,552–1,988 ms |
| Desktop | 1,657 ms | 1,780 ms | 24 | 1,466–2,123 ms |

The phone is level (+34 ms; the first pair of rounds was 10 ms faster, the
second 124 ms slower). **The desktop is slower, about 120 ms** (+93 and +22 ms
by pair of rounds, +122 over all 24), and I record it as a cost. The likeliest
part is the route chunk, 5.1 KB larger (the panel, the docked actions and their
sheet, and the money catalogue for mode names); not isolated further.

Bundle: `/payments/[id]` route 69.3 → 74.4 KB. 55 other figures moved by
0.0–0.4 KB (and `/lending/loans` by 1.1 KB) through the two shared changes;
raised to measured + 0.3 with a note in `bundle-budgets.json`. The shared app
every route pays is unchanged.

## Competitor comparison

Not done for this piece; unproven.

## Gates

- Jest: 4,743 of 4,743 passed, including 8 new page tests, all of which were
  run against the old page and failed there.
- Type-check and lint (`--max-warnings=0`): both clean on the full tree.
- i18n split and check: passed.
- Production build: passed. Bundle check: passed after the raises above.
- `e2e/payment-receipt.mjs` (new): 65 of 65 against the local QA stack, at
  390/320/1024/1280 in English and Hindi, print, offline and a real cancel. It
  records and cancels one ₹2 receipt per run ("QA90"); two earlier runs that
  stopped part-way left theirs recorded, and both were cancelled afterwards.

## Scores (payment receipt only, provisional)

| Point of view | Score | Evidence | Still weak | Confidence |
|---|---|---|---|---|
| Function | 8.7 | Amount, modes and dues equal the server's; a real cancel reaches the server and the bill's due returns; Keep keeps | Loading, not-found and share-failure paths not re-run; message wording is the old server text | Medium-high |
| Busy shop | 8.6 | Share is one tap from the thumb; a double tap sends once; the due on each bill is on screen | ⋯ hides cancel by one tap (intended) | Medium |
| UI/UX phone | 8.6 | Measured EN/HI at 320/390; dock tappable above the menu; nothing cut in page, dock or dialogs | The A5 preview needs a sideways scroll to read its right half | Medium |
| UI/UX desktop | 8.5 | Header actions; panel beside the print at 1280 | Stacked at 1024 | Medium |
| Performance | 7.6 | Phone level; desktop about 120 ms slower at 4x CPU, n=24 a side | Route chunk +5.1 KB, not isolated | Medium-low |

# Receive payment drawer · 24 Oct 2026 (08 §6, §0.2, R-DEC-32, R-DEC-34)

Scope: `PaymentFormDrawer` in the Shop's counter mode (`bucket: 'shop'`), with
`PaymentModeEditor`, `PaymentAllocationPicker`, `BillPickRow` and
`usePaymentForm` as that mode uses them. Opened from a customer's or
supplier's page, the Customers and Suppliers rows, `/payments`, an invoice or
a purchase bill. The library's fee desk opens the same drawer without
`bucket: 'shop'` and is unchanged (frozen contract), as is every other caller's
non-counter path.

Who needs it: the counter, mid-queue, taking money from a customer (or paying
a supplier). The job is to take the amount in a few seconds with no doubt about
which bills it settles, what stays due, and whether it was saved.

## Spec-to-check map

| Requirement | Source | Check | Status |
|---|---|---|---|
| Header "Receive payment" + "Anita Verma · owes ₹445" | 08 §6 Phone, `#pay` Ready | drawer test; harness reads it at 390/320/1024/1280 EN/HI | passed |
| Customer row with "1 unpaid bill" | 08 §6, `#pay` | drawer test; harness | passed |
| Amount focused, decimal keypad, prefilled with what is due | 08 §6 | harness: the caret is in the amount on open at every size | passed |
| Under the amount: "₹245 will still be due after this." / clears / more than due | 08 §6, `#pay` Ready, More than due | drawer tests; harness | passed (fixed, finding 1) |
| Paid by (last used on this device), reference for non-cash, "+ Split into two ways" | 08 §6 | drawer test (label); existing split tests | passed |
| "Auto, oldest first" with each bill's share: "₹200 · ₹245 left" / "clears it" | 08 §6, `#pay` Several bills | drawer test; harness | passed |
| More than due: amber "₹155 more than what is due… not a refund" and an Advance · Shop book row before saving | 08 §6 States | drawer test; harness EN 390 and HI 320 | passed (deviation 1) |
| Allocation over: "You've put ₹700 on bills but are receiving only ₹500.", Save held | 08 §6 States | drawer test; harness | passed (fixed, finding 3) |
| No open bills: "No unpaid bills. The full ₹500 is kept as advance for the next bill." (no "khata") | 08 §6, §0.3 | drawer test; harness | passed |
| Bills still loading: amount typeable, Save allowed (server allocates FIFO) | 08 §6 Loading | drawer test | passed |
| Bills could not be read: "Couldn't load bills · Try again"; Save still allowed with Auto; footer "Bills will be matched oldest first when saved." | 08 §6 Error / partial | drawer test; harness (503 on the bill list) | passed |
| A payment for one bill still waits for that bill | counter defect kept | drawer test | passed |
| More details collapsed with "Today · no note"; private-note line | 08 §6 | harness LOOK | passed |
| Footer: "Still due after this ₹245" (one line), Cancel, Receive ₹200 | 08 §6 | harness: one line, buttons whole and tappable at every size; Cancel now shown on phones | passed (deviation 2) |
| 320 px Hindi: the figure stacks above the buttons when they don't fit | 08 §6, TV-03 | harness at 320 HI | passed |
| Saving: "Receiving…", fields locked, Cancel disabled; after 3 s "Still working… it won't be saved twice." | §0.2 | harness (held request) | passed |
| Didn't go through: red banner, everything kept, "Try again" on the same key | §0.2, `#pay` | drawer tests; harness: a refused save and a lost one, and the Idempotency-Key header is the same on both tries | passed (deviation 3) |
| Changed elsewhere (P-08-04): re-read on focus and before Save; amber banner with the new figure; "Use the new figures"; Save held until then | 08 §6 States | drawer test; harness: another device records ₹1 while the drawer is open | passed (deviation 4) |
| Repeated taps: one receipt | 08 §6 | harness: a double tap posts once | passed |
| Saved: one message (no duplicate snackbar), Share receipt first, Print, Done | 08 §6 Success (proposed) | drawer test; harness: real ₹1 receipt, Share asks once, message never names the product | passed (deviation 5) |
| Desktop: 440 px, Enter in Amount moves to Paid by, Ctrl ↵ saves | 08 §6 Desktop | harness: 440 px; Enter moves focus and saves nothing | passed (Ctrl ↵ not re-proven) |
| Pay supplier: same drawer, "you owe", Pay ₹X, purchase bills | 08 §6 | existing drawer test (bill page) | passed; supplier copy not LOOKed |
| Server: ₹1 lands on the oldest bill, the customer owes ₹1 less in the Shop | must keep (FR-5) | harness reads the server | passed |
| Offline: queue or disable | §0.2 | unchanged | not re-proven |
| Expired session mid-write | §0.2 | unchanged | not re-proven |
| Thousands: 20 oldest bills and "Show all N" | 08 §6 | built; no QA customer with more than 20 open bills | unproven |

## What changed

- **The header and the amount say what is owed and what this leaves.**
  "Verma Enterprises 1 · owes ₹11,002.35", then under the amount "₹245 will
  still be due after this.", "This clears everything due." or, in amber, "₹155
  more than what is due. It stays with {name} as advance, not a refund."
- **Each bill says its share**, "₹200 · ₹245 left" or "clears it", and money
  beyond the bills is a dashed "Advance · Kept for the next bill · Shop book"
  row before saving. The "Allocated ₹…" line went (it only repeated the
  amount); with Auto off it stays, and an over-allocation is named with both
  figures beside the Save it holds.
- **A failed save is said in the drawer**, not only in a toast that vanishes:
  "Didn't go through. Nothing was saved." for a refusal, "No answer yet… it
  won't be saved twice" when the connection dropped, and the button reads Try
  again, which resends with the same idempotency key. The counter's save no
  longer toasts at all (the drawer says it), success included.
- **Changed elsewhere (P-08-04).** The drawer re-reads the customer's open
  bills when the tab regains focus and just before Save. If they owe a different
  total, an amber banner says so with the new figure, Save waits, and "Use the
  new figures" takes them (and the amount, if it was the old figure in full).
- **Bills that will not load no longer stop the counter** when Auto is on: the
  server settles oldest first under its lock, and the footer says so.
- **The saved panel says it once** ("Received ₹1.00 from Verma Enterprises 1.
  ₹10,999.35 still due · RCT/26-27/5083") with Share receipt first, Print and
  Done. Share uses the receipt page's own request and sheet, now shared
  (`useReceiptShare`, `ReceiptShareSheet`).
- Words: "Paid by", "Split into two ways", "Auto, oldest first", "Couldn't load
  bills", "Receiving…"/"Paying…", in English and Hindi.
- Design system: `UbStatusBanner` takes `actionBelow`, for a banner whose
  words are a sentence and whose action is a phrase.

## Found by looking

1. **The amount's line sat under "Paid by"**, two fields from the amount it
   describes, in the first screenshot. It is under the amount now.
2. **The changed-elsewhere banner squeezed its words into a column two words
   wide** at 390 px, because the action sat beside them. It sits below them
   now (`actionBelow`).
3. **An over-allocation held Save with no reason in sight**: the message was at
   the foot of a six-bill list, below the fold. It is in the footer, under the
   button it holds.

## Deviations and decisions recorded

1. **Bill rows carry no checkbox.** `#pay` draws a ticked box on each bill that
   gets money; with Auto on it would be a box nobody can untick, and with Auto
   off the row has its own amount field. The amount and "clears it" are the
   mark. Dates stay dd/mm/yyyy (the product's date rule) rather than "8 Oct".
2. **Cancel is on phones too.** It was hidden below `lg`; the spec's footer has
   it, and a counter that wants out should not have to find the ×.
3. **The global toast for a counter save is suppressed** (`suppressErrorSnackbar`
   for this one request), because the drawer's banner is the durable place and
   both said the same thing. A refusal the server explains (4xx) keeps its
   words in the banner; a 5xx's "Something went wrong" is not repeated.
4. **The changed-elsewhere check compares the open bills' total**, which is what
   the client can see (`GET /payments/open-documents`). The header figure moves
   by the same difference. A change that does not touch the open bills (an
   opening balance, an advance applied elsewhere without a bill) is not caught;
   a server-side due check is still the BP candidate the spec names.
5. **The saved panel stays in the drawer** rather than the design's close +
   toast with "Share receipt": the global snackbar's action slot is unused and
   Q3 is the owner's. The panel's "still due" is the figure the footer showed
   at Save, not a fresh read.
6. **QA data, discarded by the owner (24 Oct):** the share message for this
   customer says "Balance: Rs 3 (we will give)" while the Shop says they owe
   ₹10,999, because the QA book's older bills sit in the Udhaar bucket from
   before DEC-019. The owner: the app is new, no real business has such bills.
7. **Two guards caught the first full run.** `useReceiptShare` rotated its key
   after any answer, so a Share retried after a timeout went out as a new
   request (the receipt page had the same code under another name, which the
   L-R1 check's pattern did not see); it now rotates only on success. And the
   new re-read thunk had to be registered as a QUERY in the invalidation
   registry.

## Performance

Opening the drawer: from the tap on "Receive payment" on a Shop customer's page
until the drawer lists that customer's unpaid bills, at 4x CPU throttle,
against `dcaddbc` (the old drawer). The same customer on both sides; 6 opens per
viewport per round, 4 rounds alternating old and new, phone 390×780 and desktop
1280×900. Scripts and raw numbers: `data/2026-10-24-receive-payment/`
(`rpab.sh`, `rpperf.mjs`).

| | old median | new median | n per side | new range |
|---|---|---|---|---|
| Phone | 961 ms | 985 ms | 24 | 806–1,185 ms |
| Desktop | 737 ms | 751 ms | 24 | 619–1,628 ms |

Level: +24 ms on a phone and +14 ms on a desktop, inside the round-to-round
spread (phone pairs −82 to +86 ms, desktop −98 to +177 ms). The drawer's
chunk carries the new words in their own catalogue (`paymentCounter`), so the
pages that open the drawer did not grow; the first build put them in the
`payments` catalogue and cost the receipt page 1.6 KB, which is why they moved.

Bundle: no route grew by more than 0.1 KB; 25 figures moved by 0.0–0.1 KB
through `UbStatusBanner`'s `actionBelow` and were raised to measured + 0.3 with
a note. The shared app is unchanged.

## Competitor comparison

Not done for this piece; unproven.

## Gates

- Jest: 4,754 of 4,754 after two fixes the first full run found (finding 7);
  `PaymentFormDrawer.test.tsx` has 24, of which the 10 new ones fail on the old
  drawer (checked by stashing the change).
- Type-check and lint (`--max-warnings=0`): clean on the full tree.
- i18n split and check: passed (58 catalogues; `paymentCounter` is new).
- Production build: passed. Bundle check: passed after the raises above.
- `e2e/receive-payment.mjs` (new): 149 of 149 on the local QA stack. It records
  one ₹1 receipt through the drawer and two ₹1 "other device" receipts through
  the API, and cancels all three at the end.
- `e2e/payment-receipt.mjs`: 65 of 65 again (its Share now goes through the
  shared hook and sheet).
- `e2e/revamp-person.mjs`: its bills-unread check is updated to the new rule
  (Save allowed with Auto, the footer note present); not re-run in full.

## Scores (receive payment drawer only, provisional)

| Point of view | Score | Evidence | Still weak | Confidence |
|---|---|---|---|---|
| Function | 8.8 | A real receipt lands on the oldest bill and the Shop balance falls by it; one post for a double tap; Try again keeps the key; changed dues stop the save | The changed check sees open bills only; offline and expired-session paths not re-run | Medium-high |
| Busy shop | 8.8 | Open → Receive is still two taps; what stays due is under the amount; a failed or changed save says so in place | Large amounts push the footer onto two lines | Medium |
| UI/UX phone | 8.6 | Measured EN/HI at 390 and 320 in every state; nothing cut; buttons whole and tappable | Keypad over the footer not device-verified (iOS) | Medium |
| UI/UX desktop | 8.5 | 440 px, Enter moves to Paid by, same composition | Footer stacks for amounts over about ₹10,000 | Medium |
| Performance | 8.5 | Level against the old drawer at 4x CPU, n=24 a side | — | Medium |

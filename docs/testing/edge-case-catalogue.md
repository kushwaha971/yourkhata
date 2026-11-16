# Edge-case catalogue — what real merchants hit, as tests (owner, 27 Oct 2026)

The owner's standard: every piece is tested from what users of similar products
actually complain about, not only from our own guesses, and this catalogue
feeds the monkey (`e2e/monkey.mjs`) and the edge-case harnesses
(`e2e/a4-edges.mjs` and each module's own). It covers **every module**: a case
is written once, as a class, with a row per module that must pass it.

## Where the cases come from (researched 27 Oct 2026)

Review sites are self-selected anecdotes, not a measure of how often a problem
happens. Each source is labelled with what it actually is. Nothing here claims
a competitor *has* a defect today; it says what users *reported*.

| Ref | Source | What users reported |
|---|---|---|
| C1 | Capterra, Vyapar reviews — https://www.capterra.com/p/180579/Vyapar/reviews/ | Data missing and totals not matching at year-end; mismatched past entries; mobile ↔ desktop sync gaps |
| C2 | mwm.ai listing of the Vyapar iOS app — https://mwm.ai/apps/vyapar-billing-accounting/6478382307 | Bills entered on two devices at once gave sync errors; a bill failed after every detail was typed, forcing a redo |
| C3 | Vyapar on Google Play (summarised by the search) — https://play.google.com/store/apps/details?id=in.android.vyapar&hl=en_IN | "Something went wrong" / "Failed to update"; stock and payment mismatches |
| C4 | Capterra / Software Advice, myBillBook — https://www.capterra.com/p/202732/FloBooks/reviews/ , https://www.softwareadvice.com/accounting/flobooks-profile/reviews/ | Calculation errors; crashes; no real offline billing; settings reset after updates; deleted items unrecoverable |
| C5 | SoftwareSuggest, Swipe — https://www.softwaresuggest.com/swipe-billing/reviews | Lag; limited bulk actions |
| C6 | OkCredit on Google Play — https://play.google.com/store/apps/details?id=in.okcredit.merchant&hl=en | Hard to delete and re-enter a transaction; transaction date not editable |
| C7 | Khatabook on Capterra — https://www.capterra.in/software/197475/khatabook | Freezes and closes while entering shop transactions; reminders could not go through the app's own messaging |
| C8 | kuki-pos PR #7 (an open-source till's bug-fix log) — https://github.com/andrewson97/kuki-pos/pull/7 | 1500 typed for 150 as a discount stored a negative bill while showing 0.00; a lost response caused a double bill; zero/negative qty and price accepted; slip and bill rounded differently |
| C9 | GST invoice numbering guide — https://www.gimbooks.com/blog/invoice-numbering-rules-under-gst/ | Duplicate invoice numbers from concurrent or offline billing |

## The cases

Status: **pass** = a check that can fail ran and passed on the running app;
**fail** = found, open; **fixed** = found by this catalogue and fixed with a
test; **not run** = written, not yet exercised; **n/a** = the module has no
such action.

| # | Case (from) | How it is tested | Bill (A4) | Purchases | Money Book | Payments | Items / stock |
|---|---|---|---|---|---|---|---|
| E1 | Tap pay/save twice, or the reply is lost, and get two documents (C8, C9) | double tap; slow `/issue` + reload in flight; count via API | pass (a4-functional, a4-edges slow-issue) | pass (shop-edges-ppi: Record sent twice at once then retried, never a 500, one record; revamp-purchase-finish reply-lost; a draft is not keyed, like sales) | pass (moneybook-round E1: 3 fast taps = 1 entry; test_a_retry_with_the_same_key_posts_once) | pass after fix (shop-edges-ppi: same key twice at once was a 500 when the first failed — fixed in idempotency.py, test_idempotency_race; receive-payment double tap) | n/a |
| E2 | Leave or reload just after a change, and the change is gone (C1, C2) | monkey reload / Back / wander with lines on the document; device + server checked | fixed (flush on close and on pagehide) | pass (monkey 3 seeds × 2 sizes, reload/Back with lines checked against the server) | pass (an entry is saved by Save; the list and person refetch; monkey reload/return data check) | pass (monkey, wander + reload) | pass (monkey, wander + reload) |
| E3 | The address names a different document from the one on screen (found here) | monkey: address id vs screen vs server | fixed (store reset on close) | pass (monkey address vs screen vs server) | pass (the person page reads its id from the address; monkey data check per person) | pass (monkey) | pass (monkey) |
| E4 | Offline: billing stops, or a document is issued twice when the link returns (C4, C9) | `setOffline` before pay and while adding; API count after | pass (a4-edges offline-pay at 390 and 1280, Shop round 11 Nov: issued once when back online; offline item search is BACKLOG) | pass (revamp-purchase-quick-add offline; revamp-purchase-finish reply-lost / uncertain-leave) | pass (moneybook-round E4: offline Save keeps the sheet and the amount, stores nothing); no offline queue, as in the Shop | pass (payment-receipt offline) | n/a |
| E5 | Two devices edit the same document (C2) | two tabs, the second a version behind | pass (a4-edges two-tabs, 11 Nov: the second tab is told "Changed on another device") | pass (shop-edges-ppi: the device a version behind gets 409 "Somebody else changed this") | pass (person row lock on every write; test_the_cached_balance_equals_a_full_recount) | n/a | pass (shop-edges-ppi: item PATCH a version behind → 409) |
| E6 | Totals that do not add up; slip and screen rounded differently (C1, C4, C8) | screen total = API total = print total, with discounts and round-off | pass (screen = API); print not yet compared | pass (shop-edges-ppi: lines = total, read back) | pass (totals over the filtered book: test_totals_are_over_the_whole_filtered_book; report adds up; list To get = server) | pass (shop-edges-ppi: modes add up; bill due read back) | n/a |
| E7 | Typo of extra zeros (1500 for 150, 99999999) stored as a negative or absurd document (C8) | type limits in every money and qty field; API refuses | fixed (FB-020 limits, R-DEC-56) | pass (shop-edges-ppi: cost 99,999,999,999 refused with a reason) | fixed (moneybook-round E7: 99999999999 refused on screen as "too large", was "Use up to two decimals"; server MAX too) | pass (shop-edges-ppi: 99,999,999,999, 0 and −50 refused with reasons) | fixed (shop-edges-ppi: an item took ₹99,999,999,999 and could never be billed; now the bill-line limit, test_an_item_price_above_a_bill_rate_is_refused) |
| E8 | Zero, negative or fractional qty on a whole unit (C8) | type them; nothing refused is sent | fixed (R-DEC-56) | pass (shop-edges-ppi: negative qty refused; revamp-purchase-contracts: 1.5 on a whole unit keeps 1, 3.141 keeps 3, owner 27 Oct) | n/a | n/a | pass (shop-edges-ppi: half a piece refused with a reason; a zero adjustment moves nothing) |
| E9 | Stock does not match what was sold (C3) | stock before/after issue via API | pass (a4-functional) | pass (shop-edges-ppi: Record adds exactly the bought qty; void takes it back) | n/a | n/a | pass (shop-edges-ppi: −4 adjustment lowers stock by exactly 4; stock-adjust 49/49) |
| E10 | A wrong customer's money, or the wrong book's (C3, DEC-019) | credit bill: Shop balance moves by the total, Udhaar book does not | pass (a4-edges credit, 11 Nov: Shop balance moves by the bill, Udhaar book stays 0) | pass (shop-edges-ppi: supplier shop_balance moves by the total, Money book balance does not) | pass (no Shop table; the Shop cannot list or open a Money Book person; import-rule matrix) | pass (shop-edges-ppi: Shop book moves by exactly ₹100, Money book does not; apps-switch-isolation C) | n/a |
| E11 | Selling an item with no stock (C3) | issue refused naming the item, or allowed with negative stock if the shop says so | pass (a4-edges zero-stock, 11 Nov: refused, naming the item) | n/a | n/a | n/a | pass (shop-edges-ppi: selling past stock is refused naming the item, or goes negative as the shop set) |
| E12 | Undo/correct a wrong entry is hard or loses history (C6) | reverse and correct; history kept; balance by difference | n/a (void is later) | pass (shop-edges-ppi: void keeps the bill marked void and returns the stock; purchase-detail) | pass (change = removal + new entry, original kept; Show removed; test_a_correction_moves_by_the_difference) | pass (shop-edges-ppi: cancelling keeps the receipt, reopens ₹100 on the bill, moves the book back by exactly ₹100; payment-receipt) | pass (shop-edges-ppi: an item holding stock is not archived, with a reason; an empty one archives and restores, history readable) |
| E13 | Back-dated entry not allowed or breaks balances (C6) | backdate, read the running balance | n/a | pass (shop-edges-ppi: dated 20 days ago, kept) | fixed (change date on the sheet; a correction keeps its place, list ordered by entry day: test_a_corrected_entry_keeps_its_place) | pass (shop-edges-ppi: dated before the open bill is not put against it silently; kept as advance it keeps its date; a month ahead refused) | n/a |
| E14 | Freezes or crashes while entering (C7) | monkey: page error, frozen main thread, long tasks, heap growth | pass (monkey, 0 long tasks) | pass (monkey 6 runs, 0 page errors, 0 long tasks) | pass (monkey 3 seeds x 2 sizes, Money Book wander) | pass (monkey 6 runs, 0 page errors) | pass (monkey 6 runs, 0 page errors) |
| E15 | "Something went wrong" with no reason (C3) | every refusal shows the server's own reason (R-DEC-56) | fixed (serverReason) | fixed (shop-edges-ppi-ui: Ctrl+S on an empty purchase showed "Must be a valid UUID." — now nothing is sent, and the server says "Choose one from the list."; every refusal in shop-edges-ppi carries a plain reason) | pass (moneybook-round E15; look sweep error case on all 5 screens says it could not load) | pass (shop-edges-ppi: every refusal carries a reason) | pass (shop-edges-ppi: every refusal carries a reason) |
| E16 | Settings reset after an update (C4) | change a setting, redeploy, read it back | pass (e2e/settings-restart.mjs, 11 Nov: shop.wholesale written, API process restarted, read back true, then restored; a frontend rebuild holds no settings) | — | n/a (no settings screen yet; UPI id and signature are server-side) | — | — |
| E17 | Very long names and Hindi/emoji break the layout | 200-char search, Hindi + emoji names; page and text boxes measured | pass (a4-edges long-text, 11 Nov: overflow 0 px, clipped text 0) | pass (shop-edges-ppi: a 200-char Hindi + emoji supplier is refused at 160 with a field reason; revamp-purchases-register long names) | pass (moneybook-round E17: long Hindi name and ₹12,40,378 fit 390 and 1280; look sweep 320) | pass (shop-edges-ppi: 200-char Hindi + emoji note) | pass (shop-edges-ppi: 200-char Hindi + emoji item kept whole or refused with a reason) |
| E19 | A finished document (paid, issued, recorded, posted) can still be edited, deleted or paid again (owner, 27 Oct 2026) | screen: its /edit opens its own page; no Edit/Delete/Pay on the page or in ⋯; API: edit, change party, delete, issue again each refused; document, stock, balance and count read back unchanged. The designed correction (void/cancel, reverse) stays allowed | pass (a4-edges locked: 409 document_not_draft ×4; ⋯ shows only Cancel the bill) | pass (shop-edges-ppi: a recorded purchase keeps its lines — only the note may change, BR-7; record again 409, delete 409, void twice 409) | pass (database trigger: an entry is never edited or deleted; test_an_entry_cannot_be_edited_or_deleted_in_the_database) | pass (shop-edges-ppi: cancel twice refused; paid bill takes nothing more) | n/a |
| E20 | A double tap on a remove/delete control takes two rows (C7: freezes and mis-taps at a busy counter) | double tap the bin/trash; count rows; Undo restores the right one | fixed (400 ms guard; a4-remove-undo) | fixed (shop-edges-ppi-ui: at 1280 a double tap on a line's bin removed BOTH lines; 400 ms guard in UbLineItemsEditor, unit test) | pass (a second removal of the same entry is refused, entry_already_reversed) | pass (no bin on a receipt; cancelling twice is refused) | pass (shop-edges-ppi-ui shared editor guard; item-detail) |
| E21 | Empty documents pile up (saved bare, or emptied) and clutter lists (C1: data mismatch) | press Save/Hold/Ctrl+S on the empty state; empty a saved document; read the server and the lists | fixed (no save when empty; an emptied draft is saved). Hiding empty ones from the held strip was withdrawn: it made the count an estimate | fixed (shop-edges-ppi-ui: Record and Ctrl+S on an empty purchase leave nothing on the server; shop-edges-ppi: no lines cannot be recorded) | n/a | pass (an empty amount is not saved: receive-payment) | pass (shop-edges-ppi: a blank item name is refused with a reason) |
| E22 | A wrong item cannot be removed quickly on a phone | bin at qty 1 + Undo, measured, read back | fixed (R-DEC-58) | pass (shop-edges-ppi-ui: the bin is 40 px with a 44 px phone target; a double tap takes one line). No Undo on a purchase line, unlike a bill — listed for the owner | pass (tap the entry → Remove this entry, on a phone) | n/a | n/a |
| E23 | Overpaying, or paying a finished bill (C3 payment mismatches) | API: more than due → 400, any amount on a paid bill → 409; on screen the excess is kept as advance and said so; the bill never shows paid above its total | pass (a4-money) | pass (shop-edges-ppi: more than due against the purchase refused; full amount pays it; nothing more on a paid one) | pass (getting more than is owed flips the balance to To give, said in words) | pass (shop-edges-ppi: an allocation above the due refused; any amount on a paid bill refused; never paid above its total; receive-payment advance row) | n/a |
| E24 | The printed bill differs from the screen or the server (C4 calculation errors) | print media: number, each line, each amount, total = API; a sign is the same on screen and print | pass after fix (withMinusSign on A4 and 80 mm) | n/a (a purchase has no print: the supplier's paper is the record) | pass (Print uses the same rows as the screen; Share text lists every amount) | pass (payment-receipt print media = screen = API) | n/a |
| E25 | A discount that makes a total negative (C8: 1500 for 150 stored a negative bill) | type past 100 % and past the subtotal; the box returns to the limit; API total ≥ 0 | fixed (R-DEC-59; a4-limits-look) | pass (shop-edges-ppi: a discount above the total or 100 % refused; total never negative) | n/a | n/a | n/a |
| E26 | A drawer opens with fields already red, before any Save (the LED-01 class) | open each form drawer, tap a switch or chip first; no error until Save | n/a | fixed (A5: Add item, Add customer; blurIfTyped) | pass (moneybook-round E26: the entry sheet opens with no error shown) | fixed (shop-edges-ppi-ui: tapping Received painted the empty amount red; blurIfTyped, unit test) | fixed (Add item) |
| E27 | A restyle quietly breaks saving | every form drawer saves after the change, read back by record id | — | pass (A5: customer, item, stock; payment via A4) | pass (moneybook-round saves after every restyle in this round) | pass | pass |
| E18 | Slow, laggy lists (C5) | page time-to-content and API p95 under the monkey | pass (p95 < 1 s locally) | pass (API p95 ≤ 96 ms, page p95 ≤ 495 ms) | pass (monkey p95 page loads, see the round report) | pass (API p95 ≤ 85 ms, page p95 ≤ 511 ms) | pass (API p95 ≤ 84 ms, page p95 ≤ 495 ms) |

### Jewellery custom orders and karigars (G3, 2 Nov 2026)

E1 pass (g3a double tap, g3e E4 lost reply). E2 fixed (order, issue and tag forms keep a device copy; g3e E5, E5c). E3 n/a (no document address on the form). E4 pass (g3e E7). E5 pass (g3e E6, a stale tab refreshes). E6 pass (g3o, g3e E8: screen = API). E7 partial: absurd weights not limited, a heavier-than-given lot refused. E8 n/a. E9 pass (g3c stock read back). E10 pass (the advance is in the Shop bucket, g3o). E11 n/a (tags only). E12 fixed (g3d correct and remove, audit kept). E13 n/a. E14 pass (monkey). E15 partial: a refused status move says a general "Couldn't update", not the server's reason. E16 n/a. E17 not run on these screens beyond wrapping names. E18 pass (monkey). E19 pass (g3e E9, finished orders offer no action). E20 n/a. E21 pass (g3e E3). E22 n/a. E23 pass (advance over the bill, pytest). E24 pass (g2c, g2b print). E25 n/a. E26 not run on purpose. E27 pass.

## Members & Fees (Library), 12 Nov 2026

The Library's column, case by case with its evidence, is in
`docs/testing/library-round-2026-11-12.md` §9.4: no case "not run".

## Loans & Collections (Lending), 12 Nov 2026

The Lending column, case by case with its evidence, is in
`docs/testing/lending-round-2026-11-12.md` §9.4.

## How the monkey uses this

`e2e/monkey.mjs` now does what a distracted user does, not only taps: reload,
Back/Forward, leaving for another page and returning (by Back, or by Bills →
New bill), adding real items by part of their name, typing junk and limits. It
fails on:
- a lost line (E2), or one kept only on the device (a warning);
- an address that names a document not on screen (E3);
- a refused save the screen let through (E7, E8);
- any 5xx, page error, console error or frozen thread (E14);
- a request loop (one call more than 15 times in 5 s);
- a page slower than 5 s to show its content, or an API reply over 3 s (E18).

It prints the API calls per endpoint with p95, the time-to-content per page,
the long-task total and the heap. It also refuses to pass if no reload or
return ever happened with lines on the document, because then the data check
proved nothing.

Each module's piece adds its row values here, and its own edge harness for
the cases the monkey cannot reach by chance (E1, E4, E5, E10, E11).

## Jewellery, added 3 Nov 2026

- Tagged piece on a bill with no tag chosen: held before issue, with a message about the tag rather than an IMEI. Covered by `test_a_piece_with_no_tag_asks_for_the_tag_not_an_imei`.
- Old gold cash-back switched on with no weight or purity: the draft still saves. Covered in `invoiceForm.test.ts`.
- Item search inside a scrolling bill table: the list shows full rows and does not cover the chosen piece. Measured in `e2e/g4b-bought-cashback.mjs`.
- Monkey flips the jewellery switch mid-round: state reset by `e2e/_reset.mjs`.

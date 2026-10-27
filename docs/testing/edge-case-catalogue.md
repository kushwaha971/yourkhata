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

| # | Case (from) | How it is tested | Bill (A4) | Purchases | Udhaar | Payments | Items / stock |
|---|---|---|---|---|---|---|---|
| E1 | Tap pay/save twice, or the reply is lost, and get two documents (C8, C9) | double tap; slow `/issue` + reload in flight; count via API | pass (a4-functional, a4-edges slow-issue) | not run | not run | not run | n/a |
| E2 | Leave or reload just after a change, and the change is gone (C1, C2) | monkey reload / Back / wander with lines on the document; device + server checked | fixed (flush on close and on pagehide) | not run | not run | not run | not run |
| E3 | The address names a different document from the one on screen (found here) | monkey: address id vs screen vs server | fixed (store reset on close) | fixed (same reset) | not run | not run | not run |
| E4 | Offline: billing stops, or a document is issued twice when the link returns (C4, C9) | `setOffline` before pay and while adding; API count after | not run → a4-edges offline-pay / offline-add | not run | not run | not run | n/a |
| E5 | Two devices edit the same document (C2) | two tabs, the second a version behind | not run → a4-edges two-tabs | not run | not run | n/a | not run |
| E6 | Totals that do not add up; slip and screen rounded differently (C1, C4, C8) | screen total = API total = print total, with discounts and round-off | pass (screen = API); print not yet compared | not run | not run | not run | n/a |
| E7 | Typo of extra zeros (1500 for 150, 99999999) stored as a negative or absurd document (C8) | type limits in every money and qty field; API refuses | fixed (FB-020 limits, R-DEC-56) | partly (limits shared) | not run | not run | not run |
| E8 | Zero, negative or fractional qty on a whole unit (C8) | type them; nothing refused is sent | fixed (R-DEC-56) | shared input | n/a | n/a | not run |
| E9 | Stock does not match what was sold (C3) | stock before/after issue via API | pass (a4-functional) | not run | n/a | n/a | not run |
| E10 | A wrong customer's money, or the wrong book's (C3, DEC-019) | credit bill: Shop balance moves by the total, Udhaar book does not | not run → a4-edges credit | not run | not run | not run | n/a |
| E11 | Selling an item with no stock (C3) | issue refused naming the item, or allowed with negative stock if the shop says so | not run → a4-edges zero-stock | n/a | n/a | n/a | not run |
| E12 | Undo/correct a wrong entry is hard or loses history (C6) | reverse and correct; history kept; balance by difference | n/a (void is later) | not run | pass (LED-03 suite) | not run | not run |
| E13 | Back-dated entry not allowed or breaks balances (C6) | backdate, read the running balance | n/a | not run | pass (LED-04 suite) | not run | n/a |
| E14 | Freezes or crashes while entering (C7) | monkey: page error, frozen main thread, long tasks, heap growth | pass (monkey, 0 long tasks) | not run | not run | not run | not run |
| E15 | "Something went wrong" with no reason (C3) | every refusal shows the server's own reason (R-DEC-56) | fixed (serverReason) | not run | not run | not run | not run |
| E16 | Settings reset after an update (C4) | change a setting, redeploy, read it back | not run | — | — | — | — |
| E17 | Very long names and Hindi/emoji break the layout | 200-char search, Hindi + emoji names; page and text boxes measured | not run → a4-edges long-text | not run | not run | not run | not run |
| E19 | A finished document (paid, issued, recorded, posted) can still be edited, deleted or paid again (owner, 27 Oct 2026) | screen: its /edit opens its own page; no Edit/Delete/Pay on the page or in ⋯; API: edit, change party, delete, issue again each refused; document, stock, balance and count read back unchanged. The designed correction (void/cancel, reverse) stays allowed | pass (a4-edges locked: 409 document_not_draft ×4; ⋯ shows only Cancel the bill) | not run | not run (LED-03 forbids edits; screen not yet checked) | not run | n/a |
| E20 | A double tap on a remove/delete control takes two rows (C7: freezes and mis-taps at a busy counter) | double tap the bin/trash; count rows; Undo restores the right one | fixed (400 ms guard; a4-remove-undo) | not run | not run | not run | not run |
| E21 | Empty documents pile up (saved bare, or emptied) and clutter lists (C1: data mismatch) | press Save/Hold/Ctrl+S on the empty state; empty a saved document; read the server and the lists | fixed (no save when empty; an emptied draft is saved). Hiding empty ones from the held strip was withdrawn: it made the count an estimate | not run | n/a | not run | not run |
| E22 | A wrong item cannot be removed quickly on a phone | bin at qty 1 + Undo, measured, read back | fixed (R-DEC-58) | not run | n/a | n/a | n/a |
| E23 | Overpaying, or paying a finished bill (C3 payment mismatches) | API: more than due → 400, any amount on a paid bill → 409; on screen the excess is kept as advance and said so; the bill never shows paid above its total | pass (a4-money) | not run | not run | not run | n/a |
| E24 | The printed bill differs from the screen or the server (C4 calculation errors) | print media: number, each line, each amount, total = API; a sign is the same on screen and print | pass after fix (withMinusSign on A4 and 80 mm) | not run | not run | not run | n/a |
| E25 | A discount that makes a total negative (C8: 1500 for 150 stored a negative bill) | type past 100 % and past the subtotal; the box returns to the limit; API total ≥ 0 | fixed (R-DEC-59; a4-limits-look) | not run | n/a | n/a | n/a |
| E18 | Slow, laggy lists (C5) | page time-to-content and API p95 under the monkey | pass (p95 < 1 s locally) | not run | not run | not run | not run |

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

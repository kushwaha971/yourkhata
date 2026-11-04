# Jewellery: module round and score (2 Nov 2026)

## Live evidence
All on the running stack, as qa-jeweller. The bill and order checks were last run one
small build before the final word-list import. Not repeated on the very last build.

- `e2e/jewel-day.mjs` whole day, 26/26, `--skew` fails on To pay
- g1-rate, g2a-tags, g2b-bill 21, g2c-old-gold 13, g2d-pan 17, g3a-orders 22,
  g3o-order-bill 9, g3b-karigars 19, g3c-tags 11, g3d-lot-correct 9, g3e-edges 34
- `e2e/jewel-measure.mjs` 5/5: orders page only, at 1280 and 390
- Monkey, 3 seeds x 2 sizes x 300 steps: Home, rates, items, custom orders, old gold (30/30)
  and the bill with a line from the start (6/6, data check ran)
- Unit 5,039 pass. Server suite on a fresh database: only the 10 failures that predate G2.

## Found by this round and fixed
Photo upload refused from the screen; a blank terms field wiped the jeweller's terms;
Make tag could not find an item past the first page; "Tell customer" could not be edited
(guard); table headers 14 px/500 against the design's 13 px/600 (shared, all tables); Home
paid 11 KB for every shop.

## Decisions taken without asking, as told to keep going
Closing a typed order asks first. Removing a lot is owner/admin only. Karigar field added.
Old gold over a saved customer's bill stays as their advance; a quick sale is refused.
Silver 925 is priced at the one silver rate. Part receipts: "More to come".

## Not built
- Settings: making default, wastage limit, PAN limit
- Starter categories for a new jeweller; tola shown beside grams
- D6 on the purchase screen itself: a bought piece's number is entered on the purchase and
  its weights added afterwards on the item page; "Make 3 tags" in one go
- Payment reminder and today's-rate messages as templates (rate board sharing exists in G1)
- Paying cash back for old gold over the bill

## Score (P0 section 8): 7 of 10. Not 9.

Rechecked 4 Nov 2026 after the full round: still 7. Design stays 0 (not every screen measured, listed differences remain); User stays 1 (the hand pass is still short).
| Points | Got | Why |
|---|---|---|
| Business 2 | 2 | read back by id with skewed self-tests; finished orders and bills locked |
| Design 1 | 0 | numbers measured on one page; the not-built items above are in the design |
| Functional 1 | 1 | whole day through the screens, other screens agree |
| User 2 | 1 | monkey and catalogue done; the hand pass is short |
| Data 1 | 1 | reload, Back, offline, lost reply, two tabs on purpose |
| Performance 1 | 1 | measured; budgets raised, listed |
| Honesty 1 | 1 | this page |
| Owner 1 | 0 | only the owner can give it |

Reachable next: Design and a longer hand pass give 9. The owner's point gives 10.

## Update, 3 Nov 2026: fixes after the last LOOK and monkey round

**Fixed**

- A tagged piece with no tag was refused at issue with an IMEI message. The bill now holds it first (`pieceUnmarked()` in `finishIssue` and `startIssue`), and the server's message asks a jeweller to remove the piece and add it again to choose its tag. The draft remembers tracking through `tracks_serial`.
- A lone old-gold cash-back switch made a draft refuse to save. `toWireBody` sends `old_gold` only with a weight or purity.
- The item search list was clipped to one row in the bill's scrolling table and reopened over the chosen piece. It is now placed against the window, and it does not open on focus for a jeweller. `ItemQuickAdd` is shared, so purchases and stock count need a recheck.
- Today's rate: Set by wraps, and rate history has a search box.
- The Karigars route has a loading view; a stale `keepsTags` dependency is fixed.
- Wording: the order-ready message adds "Balance as per today's rate." when no rate is fixed; the rate share text follows the design's one line.

**Previous build's round (before the last fixes, so it does not count as final):** 14 harnesses passed, 42 of 42 monkey runs passed, both skew self-tests caught their wrong figures, and unit tests were 5041 of 5042 (the Karigars loading view, since fixed).

**Results, 3 Nov 2026 (night). The final build had a targeted rerun only, not a full round (owner asked to finish within two hours).**

- Full round on the build before the last fixes: 14 harnesses pass, skews caught, 46 of 48 monkeys. The 2 failures were seed 43 (harness: the Restore sheet covered the search) and seed 42 on /settings/messages 390 (an untagged piece reached issue).
- Final build: /settings/messages 3 seeds x 2 sizes pass; /sales/invoices/new seeds 42 and 43 at 390 pass; g2b-bill, g3c-tags, jewel-day pass. The other 34 monkey runs and 11 harnesses were NOT rerun on it.
- Server suite: 5030 tests, 1 failure, the Dues speed test (78 s against 60 s) on a busy machine; it passes alone.
- Seed 42: issue now also checks the saved bill and stops with a clear message. HOW the line lost its tag was not found; that remains open.

**Results, 4 Nov 2026, full round on the final app build**

- 14 harnesses: 13 passed first time. g1-rate failed on its month-picker wait (this month and last held the same number of rows, so it read the old row); the wait was fixed and g1-rate passes alone. The app did not change.
- Skews caught. 48 of 48 monkeys pass. Jest 5052 of 5052, lint 0, locales in step.
- Server suite: 5030 tests, 1 failure, the Dues speed test (80 s against 60 s) while the machine was busy; it passes alone. Under load it is still over its limit.
- LOOK: reminder sheet at 390, 320, dark Hindi and desktop matches `pRemind` except Attach PDF. Purchases and stock count search lists measured at 1280 and 390: 320 px high, not clipped.
- Defects found by LOOK and fixed: Messages highlight invisible, Hindi preview using English words, a no-rate piece giving a ₹0 bill stuck on Saving.
- Not rechecked by eye: the no-rate message on the final build (covered by no test), and the Messages preview in Hindi after its fix.
- Open: how seed 42's line lost its tag is still unknown; the guard stops the bill.

**Not built**

- "Final weight" in the order-ready message: no final-weight field was found on an order, so the figure is left out rather than invented.

**Design differences to list for the owner**

- Attach statement PDF on the reminder sheet is not built; no such file exists.
- The Messages menu lacks Bills and print, Tax and GST: those screens do not exist.

- Date chips "In 7/15 days" are kept; the design has none.
- The cash-limit notice is omitted by the owner's rule (no cash limit).
- The bill's subtitle says "Invoice"; the design shows the number and locked rate. A draft has no number until it is issued.
- The phone order form is a tall sheet; the design shows a full page.
- Karigars' section and menu position differ from the design.

The score sheet above predates this update. No new score is given until the pending items have results.

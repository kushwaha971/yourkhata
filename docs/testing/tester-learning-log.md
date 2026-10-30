# Tester learning log — P0 (owner, 27 Oct 2026)

The owner rated my testing 3/10 on A4 and asked me to improve feature by
feature and keep what I learn. This log is P0, as binding as
`P0-testing-standard.md`.

**How it is used, every session:**
1. Before testing anything, read this log top to bottom and apply every rule
   to the piece in hand.
2. After every feature, add what that feature taught. A lesson is only real
   when it names the check that now enforces it (a harness, a test, a
   catalogue case); a lesson without a check is a promise.
3. When the owner finds a defect I missed, the lesson is written the same
   day, with its rule and its check.
4. Each entry ends with my honest self-rating for that feature, and what
   held it back.

---

## Habits (the rules every lesson below has produced)

| # | Habit | Enforced by |
|---|---|---|
| H1 | Ask "how would a merchant break this?" before "does it work?". List the double taps, leaving halfway, reload, slow or lost network, a second device, wrong input and finished documents, and test those first. | `edge-case-catalogue.md`, `e2e/<piece>-edges.mjs` |
| H2 | Prove a check can fail before trusting its pass: run it once against a wrong value, and make it refuse to pass when it never ran. | self-tests in the harnesses; the monkey's "data check never ran" failure |
| H3 | Check the document by its own id, never a shop-wide count that another run can move. | `a4-edges` per-id checks |
| H4 | Look at every result: read every screenshot, including error states, at phone and desktop size. | LOOK step in every report |
| H5 | Test by hand like a beginner, not only with scripts, and write the pass up tap by tap. | the "manual exploratory" section of every report |
| H6 | Take cases from what real users of similar products complain about, labelled as anecdotes. | catalogue sources C1–C9 |
| H7 | Report the truth: "in test" until the score sheet is complete; harness defects called harness defects. | P0 standard §7, §8 |
| H8 | When the owner finds a bug, fix the gap in the testing as well as the bug, so the class is caught everywhere. | this log, the same day |
| H9 | A finished document is tested as locked, on screen and at the API. | catalogue E19, `a4-edges locked` |
| H10 | A delay or fault I inject must really reach the place it simulates (for example the server), or the test has not tested it. | `a4-edges slow-issue` self-test "request never reached the server" |
| H11 | Run timing checks on a quiet machine, and start the clock at the user's action, not before. | monkey `pageSpeed` placement; no parallel runs during speed checks |
| H12 | Re-measure my OWN components against the design's CSS numbers, not only the screen I am changing. The A4 stepper shipped with a 12 px corner and a 600 weight against the design's 8 px and 700. | `a4-remove-undo` radius and weight checks |
| H13 | Measure tap areas as a touch phone (`hasTouch`, `isMobile`), and look for `overflow-hidden` parents: they clip `.ub-hit`. | `a4-remove-undo` 44 px check |
| H14 | For anything that removes or moves rows, double-tap it: the next row moves up under the same finger. | `a4-remove-undo` double tap; editor test "one line for a double tap" |
| H15 | Look at the screen just after a tap on a touch device: Tailwind 3's hover sticks there. | `a4-remove-undo` "next bin not armed" colour check |
| H16 | Press every button on the EMPTY state too (Save draft, Ctrl+S, Hold), then read what the server holds. | manual pass; editor test "does not save a bill with nothing in it" |
| H18 | Measure that each box's TEXT fits inside it (`scrollWidth ≤ clientWidth`) with the longest valid value, not only that the table fits its frame. The Disc. % box showed "150" as "15" and "5.00" as "5.(" while the table measured 642/642. | `a4-limits-look` fit checks |
| H19 | Alignment is measured, not eyeballed: centres of every item on one line within 1 px. The snackbar's Undo sat 2 px off and 1 px larger, and my first probe's 2 px tolerance passed it; the owner saw it. | `a4-limits-look` snackbar centres ±1 px, size and colour equal |
| H20 | Compare what is SENT with what is SHOWN, field by field, after every save, not only "a save happened". A save that quietly leaves out an incomplete line looked like a working Hold, and lost the line. | `MONKEY_TRACE` bodies; `a4-edges cleared-qty` |
| H21 | When a measured value disagrees with the classes, find the rule that wins (CDP `CSS.getMatchedStylesForNode`), don't adjust around it. A shared "compact" class padded every drawer child, and three readings this morning were explained only once it was found. | the A5 probe; `CompactOverlays.test` |
| H22 | Re-run EVERY delivered feature's harness whenever anything ships (P0 §10). A4's design changes (the phone bar, the 1280 side column) broke two A3 harnesses; nobody noticed for a day, because they were not run again until A5's regression. | the §10 regression list in each report |
| H23 | A form's DEFAULT is a value it sends. Read the request body of a form with a field hidden, not only the form that shows it: the supplier form had no reminder switch, and every supplier was still saved opted in to reminders, from a default of "on" the merchant never saw. | `partyService.test` "no reminder keys for a supplier-only contact"; `a6-forms` body check |
| H24 | Check ORDER, not only presence. Every A6 field was there and every presence check passed, while the design's first fields (reminders) sat under two kept ones. Only looking at the shot found it; `a6-forms` F6 now reads the labels' order and failed on the old build. | `a6-forms` F6 order |
| H25 | In a shared shop, pick test data by a PROVEN property (price, stock, not harness-made), never by position. Other harnesses' items sorted first with 0 stock; four A4 cases failed on a correct refusal and looked like a money defect. | `a4-edges` `stockedItems` |
| H26 | After every money action, READ the words on every screen that shows it, not only the number. The Shop old balance was right to the paisa while the sheet said "kept as advance for the next bill" and the page said "Includes ₹1,500 old balance" under a ₹1,000 total. A read-back proves the figure; only reading proves the sentence. | `a6-forms` payment step (sheet, receipt and page words, checked) |
| H27 | A check must pin the EXACT expected value from its source, not a pattern that the wrong value also matches. T7 accepted "0 of" plus any number and passed "0 of 0 customers" for a list of 351. | `a7-measure` T7 (the API's unfiltered total) |
| H28 | Measure the widths BETWEEN the named sizes. 320, 390 and 1280 all passed while 1024 hid the bill's customer and cut a Hindi button; a laptop at 1024–1279 is a real merchant. | `a3-customer-box-look` 1024/1152; `a7-measure` 1024 |
| H29 | A slow number that is CONSTANT across replays (7.87–7.94 s) is a timer or a stuck state, not a slow server. Trace it to the request that never answered or the answer that was thrown away; here an app switch wiped the new page's state and nothing asked again. | `a8-first-tap` P5 (rows within 3 s from another app) |
| H30 | Time the FIRST tap in a cold browser with code downloads held back; a warm cache hides every lazy-loading gap. Ninety-seven drawers and dialogs drew nothing for 1.3 s and every warm run looked fine. | `a8-first-tap` P1/P3; guard `lazyOverlaysShowTheirShape` |
| H31 | A sticky bar is measured from the END of the page, not by scrolling a tile to the viewport edge; and a full-page screenshot paints sticky bars where they never sit. B1's "Continue over the tiles" was both. Also: replay every monkey failure alone before calling it real — three 5–9 s "slow API" failures were load from other work on the machine and passed alone. | `b1-pick` dock check; monkey replay rule |
| H17 | Prove an API query filters before counting with it: read its rows and check each one matches. `?status=issued` was ignored by the bills API, whose filter is `tab`, so every "issued bills +1" check counted drafts too. | `filterSelfTest` in `a4-edges`, the `tab=draft` self-test in `a4-functional` |

---

## A4 — adding items to a bill (26–27 Oct 2026)

**What I missed, and how it was found:**

| Defect | Found by | Why I missed it | Lesson |
|---|---|---|---|
| A fraction accepted on a NOS line, then refused every 3 s | monkey (random) | Never typed a decimal into a whole-number box on purpose | H1: wrong input first |
| Squeezed error text in a 76 px cell | owner's screenshot | Looked at screens only with valid data | H4: look at error states too |
| "Please check the highlighted fields" hid the real reason | owner | Accepted the generic message as fine | H1/H4: read every message as the merchant would |
| The address named the old draft after Bills → New bill | stronger monkey, after the owner asked | The old monkey never left the page with items on it | H1, H2 |
| A change made just before leaving was not saved anywhere | stronger monkey | Same | H1, H2 |
| An issued bill reopened as a payable draft after a lost reply | edge harness, once the fault was made real | My first "slow" test held the request in the browser, so the server never saw it | H10 |
| "Two bills" from one Paid cash (a false alarm) | my own check, bill by bill | I counted every bill in the shop while another run was issuing | H3 |
| "11 s slow pages" (a false alarm) | my own check | The clock started before the user's tap | H11 |

**Harness defects I reported as results before checking:** the shop-wide
count, the early clock, the delay that never reached the server, and the
monkey's data check that had never run. Each is fixed now, and each check
named above now has a self-test.

**Self-rating for A4:** owner 3/10, and I agree. What held it back: testing
the path I built instead of the paths a merchant takes, and trusting passes I
had not proved could fail.

**Carry into A5:**
- Write its edge harness before building, from H1 and the catalogue.
- Run the distracted-user monkey with its data check proven to have run.
- Run the locked-document case for anything A5 finishes.
- Look at every error state.
- Make one manual beginner pass by hand.
- Score it on §8 before saying anything is done.

### A4, continued — the same day, after the owner's push (27 Oct 2026)

Found by the hand-driven beginner pass and the new probes, not by any earlier
test:

| Defect | Found by | Lesson |
|---|---|---|
| Save draft or Ctrl+S on an empty bill made an empty server draft (38 of 125 drafts were empty, shown as "Quick sale ₹0.00") | manual pass, then reading the drafts on the server | H16 |
| "Draft saved" while the server still held the removed item | manual pass, reading the server | H2/H16: read the server, not the caption |
| An issued bill opened as a payable draft after a lost reply | edge harness with a real lost reply | H10 |
| A double tap on the bin removed two lines | `a4-remove-undo` | H14 |
| The stepper's 44 px tap areas clipped by `overflow-hidden`, since it was built | `a4-remove-undo` as a touch phone | H13 |
| The stepper's corner 12 px and number weight 600, against the design's 8 px and 700 | re-measuring against `.step` | H12 |
| Sticky red hover on the next line's bin | looking at the snackbar shot | H15 |

**Harness defects corrected:**
- counting a held bill as lost;
- the 300 ms second removal inside the double-tap guard;
- **the worst one:** `?status=` is ignored by the bills API, so the edge and
  functional harnesses' "issued bills +1" counts included drafts. A draft's
  creation could pass for an issue. The double-issue protection was still
  checked by other means: one `/issue` request per tap, the bill's own status,
  and a search for other bills from the same tab. The counts, though, proved
  less than I reported. Fixed with `tab`, and with a self-test that the filter
  filters (H17).

**Self-rating so far today:** better, but still not 9: the stepper defects
were mine and a day old. The rating stays the owner's to give.

**Later the same day:** the owner found two more by looking:
- the Disc. % text cut inside its box (H18);
- the snackbar's misaligned Undo (H19), which my 2 px tolerance let through.

The overpay check, done for the first time, behaves correctly: the excess is
kept as advance and the screen says so. It also showed that the printed bill
had the hyphen Round off fixed this morning only on screen. The print is
customer-facing, and the fix now uses one shared helper (`withMinusSign`).

| H32 | A double tap is not only "two of the same request": in a wizard the extra taps land on the NEXT screen's button in the same place. Tap where a thumb taps (mouse at the same point, 120 ms apart) and assert where you ended up, not just how many records exist. B1's triple tap skipped GST and address while still making one business. | `b1-edges` E1 (stays on step 2) |
| H33 | A server-resolved word must be checked in the language ON SCREEN, which is the person's switch, not the account's saved locale. B2's Hindi sidebar said "Distributors" while every unit test (all English) passed. Send every language; let the screen pick. | `b2-menus` Hindi check; `test_the_session_carries_both_languages` |
| H34 | Stage files by name, never a folder. `git add frontend/src` swept six formatting-only files the owner asked to keep out into a B2 commit; they had to be taken back out with a follow-up commit. | rule: `git add <each file>`; check `git show --stat HEAD` before push |
| H35 | Before a harness WRITES, prove which business is open. A person with two businesses signs in to the last one used; B2's edge run wrote a medical store's words onto the hardware shop because it assumed. Switch, read `active_tenant`, then write. Also: send the app's CSRF header on every write a harness makes directly. | `b2-edges` "the open business is the medical store before any write"; `b2-menus` S9 headers |
| H36 | Text that reads fine can still be invisible. `innerText` returned the camera tray's row while it was painted dark on the dark tray (a design-system text component sets its own colour, so the parent's never arrived). For any text on a coloured or dark surface, measure each span's computed colour against the surface, not only its words. | `c1-scan` "the tray row is readable (light ink on the dark tray)" |
| H37 | A "dark" screenshot is only dark if the page says so. The app's theme is the person's CHOICE (`ub_theme_choice` cookie), so Playwright's `colorScheme: 'dark'` left every B1 "dark" shot light and no check noticed (a6-forms, a7-measure and a8-edges set only `colorScheme` too). Set the choice the way the app reads it, then assert `html[data-theme]` matches the case's name before measuring. Also: a field that turns red because a merchant tapped something ELSE first is a defect — test the order a person really uses (tile before name). | `b-sheets` "page drew the … theme"; `b1-pick` sets `ub_theme_choice`; jest "does not turn the name red when a tile is tapped before it is typed" |
| H38 | A rename is a word hunt in three places, not one: the catalogues, the strings hard-coded in screen config (landing SEO, solution pages) and the server's own messages. Search each by the OLD word in both languages, then load every screen that names an app and assert the old word is GONE, not only that the new one appears. A blind find-and-replace over tests is a trap: one pass turned `getLedgerAging` into `getMoney bookAging` and chained Lending → Ledger → Money book; replace whole quoted strings only, in one pass. | `rename-look` "no old app name" at 390/1280 × light/dark × EN/HI, and "the page is really dark" |

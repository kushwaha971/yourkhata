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

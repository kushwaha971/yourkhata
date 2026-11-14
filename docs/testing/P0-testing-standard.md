# P0 testing standard (owner, 27 Oct 2026, R-DEC-57)

The owner rated A4's testing 3/10. It was called "closed", and then the owner's
own questions found six more defects in an afternoon:
- an address that named an old draft;
- the last change lost on leaving;
- an issued bill reopening as a payable draft;
- a refused save shown as "highlighted fields";
- a fraction accepted on a whole-number unit;
- a message squeezed into a 76 px cell.

The cause was the same each time: **the tests checked what I expected, not
what a merchant does.** This standard is P0. A piece is not delivered, and is
not called closed, done, green or passed, until every section below has run
on the live stack and its evidence is in the piece's report. Where a section
does not apply, the report says why. A section left out is a failure, not an
omission.

The target is 9/10: honest, measured and complete. A high score is never
claimed from passing tests alone.

---

## 1. Business — does it do the shop's job correctly?

For every action the piece touches, from the UI through the real API and
read back:

- **Money:** every figure on screen equals the API's (totals, tax, discount,
  round-off, due, balances), and equals the print. Paise are exact.
- **Stock:** on-hand moves by exactly what was sold, bought, returned or
  adjusted, read before and after.
- **The right book (DEC-019):** a Shop action moves the Shop balance only. The
  Udhaar, Lending and Library books are read and must not move.
- **Documents:** one action makes exactly one document. A finished document
  (paid, issued, recorded, posted) is **locked**, on both sides:
  - on screen, no Edit, Delete or Pay is shown on its page or in its ⋯ menu,
    and its `/edit` address opens its own page;
  - at the API, edit, change party, delete and issue-again are each refused;
  - the document, stock and balances read back unchanged;
  - only the designed correction (void/cancel, reverse) is allowed (E19).
- **Rules:** limits, permissions, business type (words through
  `useAppWords`, features from the server) and tenant, app, book, role and
  user isolation.
- **Checked by the document's own id,** never a shop-wide count that another
  run can move.
- **A self-test for every read-back:** the checker is run once against a
  skewed value and must report it. A checker that cannot fail proves nothing.

## 2. Design — is it the approved design, exactly?

As R-DEC-50 already requires:
- the approved section's composition and words (R-DEC-54);
- measured sizes, padding, gaps, radii, fonts and pixel-sampled colours;
- side by side with the design's mocks at 390, 320 and 1280, light and dark,
  EN and HI;
- the empty, loading, error, long-text and no-match states;
- **after an error too** (owner, 27 Oct). Every refused field is looked at:
  its message is readable, it is in its own space and not squeezed into a
  cell, and nothing is pushed out of the frame. `scrollWidth` is measured and
  every text node is checked against its own box.

Conflicts with the design are listed for the owner, never chosen.

## 3. Functional — every workflow, every state

- Each required workflow is run end to end, then every other screen showing
  that data is checked **without a reload** (FB-010).
- Refusals show the **server's own reason**, with the line it is on, never a
  generic sentence (R-DEC-56).
- Inputs refuse what the server would refuse, before it is sent (whole-number
  units take no point, limits). **No save the server will refuse is ever
  sent;** the monkey fails on one.
- Pending, offline, slow, lost-reply, conflict (two tabs or devices) and
  recovery states are each exercised on purpose, not left to chance.

## 4. User — test like a merchant, not like its author

Three kinds, every piece:

1. **Manual exploratory:** drive it by hand in the browser at phone and
   desktop sizes, tap by tap, including the mistakes a beginner makes (wrong
   item then remove it, Back halfway, retype a figure).
2. **Distracted-user monkey** (`e2e/monkey.mjs`): seeded, at least 3 seeds × 2
   sizes × 300 steps. As well as random taps it:
   - reloads;
   - goes Back and Forward;
   - leaves for other pages and returns (by Back and by the menu);
   - adds real items and types junk, limits, Hindi and emoji.

   It fails on:
   - lost data (E2);
   - an address naming the wrong document (E3);
   - a refused save the screen let through;
   - any 5xx, page error, console error or frozen thread;
   - a request loop;
   - a page slower than 5 s or an API reply over 3 s;
   - **its own data check never having run with data on screen.**
3. **Edge cases from real complaints** (`docs/testing/edge-case-catalogue.md`):
   - every catalogue case that applies to the module is run and its row filled
     in (pass, fail, fixed, backlog);
   - new cases come from researching what users of similar products report
     (Vyapar, Khatabook, myBillBook, OkCredit, Swipe and others), labelled as
     anecdotes;
   - the module's own edge harness (`e2e/<piece>-edges.mjs`) runs the cases
     chance cannot reach: offline, lost reply, two tabs, credit, zero stock,
     locked documents, double taps.

## 5. Data integrity and recovery

- A reload, Back or leaving at any moment loses nothing: the change is on the
  server, or kept on the device and offered back.
- The device copy is written at once when the page closes or unloads, never
  only after a quiet half-second.
- A finished document is never offered as a draft, a device copy is never
  restored over it, and its stale device copy is cleared.

## 6. Performance

For each piece, measured on the live stack:
- time until the screen shows its content (median and worst);
- API p95 per endpoint;
- requests per action (one search request for one settled query);
- long main-thread tasks;
- JS heap at the start and end of the monkey;
- bundle against its budget.

No speed claim is made without a baseline.

## 7. Honesty in the report

- Every finding is listed with what found it and its fix and test.
- "Not run" and "not verified" are written as such, including any test that
  did not really test its case (for example a delay that never reached the
  server).
- A harness defect is reported as a harness defect and fixed. It is never
  counted as a pass.
- The word "closed" is used only when sections 1–7 are complete. Until then
  the piece is "in test".
- When the owner finds a defect the standard should have caught, the standard
  is changed the same day, so the class is caught everywhere afterwards.

---

## 8. The score — how 9/10 is measured, not felt

Each piece's report scores itself on this sheet. Every point needs its
evidence named (a harness and its result, a screenshot, a read-back). No
evidence, no point.

| Points | Earned when |
|---|---|
| 2 | **Business:** every money, stock and book figure read back by the document's own id, with a self-test that failed on a skewed value; finished documents proved locked on screen and at the API |
| 1 | **Design:** measured against the design and side by side at 390/320/1280, light/dark, EN/HI, including after an error |
| 1 | **Functional:** every workflow end to end, other screens updated without a reload, server reasons shown, nothing refused ever sent |
| 2 | **User:** a manual exploratory pass written up step by step; the monkey at 3 seeds × 2 sizes passing, with its data check having run; every applicable catalogue case run |
| 1 | **Data and recovery:** reload, Back, leave, offline, lost reply and two tabs each run on purpose, nothing lost or duplicated |
| 1 | **Performance:** time-to-content, API p95, requests per action, long tasks and heap measured, and the bundle within budget |
| 1 | **Honesty:** every finding listed with what found it, harness defects named, "not run" written as such, nothing called closed early |
| 1 | **Owner found nothing the standard should have caught** after it was called closed. If the owner does find one, this point is lost and the standard is changed the same day |

A score below 9 means the piece is "in test". A piece is never rounded up.

## 9. The module round — after every piece of a module is in (owner, 27 Oct 2026)

Pieces break each other: A4's lost line came from Hold (an older piece)
meeting the new item search. So when the last piece of a module (for example
Shop A1–A8) is in, the whole module is tested again as one, on its final build:

1. **Every piece's harness again**, so a later change cannot have broken an
   earlier screen unseen.
2. **A module-wide monkey** that wanders across all of the module's screens,
   not one page, with its data check proven to have run. 3 seeds × 2 sizes.
3. **Whole-day journeys**: opening stock → purchase → cash and credit sales →
   payments → returns → the day's report. Every figure is read back from the
   API, and stock and every balance are reconciled at the end of the day.
4. **The edge-case catalogue**: the module's column is filled completely. A
   "not run" row is a failure unless it is in the backlog with a reason.
5. **A full manual pass** as a beginner shopkeeper, phone and desktop, written
   up step by step.
6. **The module is scored on §8.** Its own score must be 9 or more, separate
   from each piece's.

Only a module that passes its round counts towards §10.

## 10. Feature-by-feature delivery (owner, 27 Oct 2026)

Work goes one piece at a time in one worktree, so each finished feature can
reach users on its own, without waiting for the whole module. **Every feature
is held to the A4 level:**
1. Every section of this standard has run, and the feature scores **9/10 or
   more** on §8, with evidence for each point.
2. **The owner's check:** the owner tries it and finds nothing the standard
   should have caught. Until then its status is "ready for the owner's
   check", never "done".
3. **A regression of everything already delivered:** every delivered
   feature's harness runs again on the new build (its edge cases, money and
   functional checks, look sweep and monkey), so the new feature has not
   broken an older one. Hold meeting the item search was exactly this kind of
   break.
4. **Then it ships** as its own release on `dev`. The commit records what
   changed for the merchant and the score.

The module round (§9) still runs once the module's last feature is in, as the
final check on the whole.

## 11. Go-live gate

The product goes live only when **every module in scope has passed its
module round (§9) and scores 9 or more** on §8, on the live stack. Each module's report is linked from
`docs/testing/edge-case-catalogue.md`, with its column fully filled in (no "not
run" left for a case that applies), and the owner has seen the scores.
Anything deferred is in `docs/BACKLOG.md` with a reason (for example offline
billing), and is not counted as passed.

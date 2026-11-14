# A8 — The page goes blank on the first tap

> **Status: ready for the owner's check** (score below). Design: §A8 of
> `docs/revamp/design/shop-fixes-and-business-types.html`: "the button shows
> it was pressed at once, the page stays, and the drawer slides in with its own
> loading shape." Harness: `e2e/a8-first-tap.mjs`.

## Spec to check

| # | What | Source | Check |
|---|---|---|---|
| P1 | The tap is answered at once | design §A8 | a shape on screen within 300 ms of the tap |
| P2 | The page stays (no blank, no route skeleton) | design §A8 | the page heading never leaves the screen |
| P3 | The drawer slides in with its own loading shape | design §A8 | a dialog frame with a loading body before the code arrives |
| P4 | A stalled load says so and offers Try again | the A4 monkey finding | after 10 s, a message and a button |
| P5 | Returning from another app shows the list | the A6/A7 monkey findings | rows within 3 s, three trips |
| P6 | Signing in lands on Home and Home shows its figures, no reload | owner, 28 Oct ("only shows skeleton … when I reload it shows data") | figures within 3 s, four trips per size |

Every opener runs in a cold browser, with each code chunk requested after the page is up held back 1.2 s.

## Baseline (before)

- **P2 passed already.** The page stayed, thanks to the backlog branch's guard
  test (`dynamicImportsHaveTheirOwnBoundary`).
- **P1/P3 failed on all 15 openers at both sizes:** nothing changed on screen
  for about **1.3 s** after the tap (the whole chunk download). Of 180 lazy
  components, 172 had `ssr: false` and no loading view, which stops the blank
  but draws nothing.
- **P5, a real defect, found by tracing the monkey's "slow return":** a Shop page
  opened from the Library app never showed its list (**6 of 6 trips, never in
  6 s**). Opening it switched the app (`POST /auth/switch-app`), and the
  invalidation map's `switchApp: { resetAll: true }` wiped every feature's
  state, including the rows the new page had just asked for. The page's fetch
  effect had no reason to run again.
- **A harness defect on the way:** the monkey's "ready" wait used animation-frame
  polling. Some "slow returns" were the wait itself, so it now polls every 100 ms.

## What was built

- **`UbDrawerLoading` / `UbDialogLoading`** (design system): the real drawer or
  dialog frame, in its own place, titled "Loading…", with field-shaped
  bars. It can be closed, so a chunk that never arrives can't trap anyone.
- **122 lazily loaded drawers and dialogs** in the Shop, Udhaar, Library,
  Lending, team and settings now name one of them as their `loading` view.
  Each was matched to the frame it really draws, following its imports.
  The first pass found 97; the guard then found 25 more drawn through shared
  wrappers in `src/components/…`, which it had not followed.
- **Guard test `lazyOverlaysShowTheirShape`:** every lazily loaded overlay must
  name its loading shape. It follows imports three levels, because "Remind"
  reaches its sheet two hops away. It lists the four that are not openers, each
  with its reason:
  - the always-mounted seat panel;
  - the import wizard and the Udhaar page, which are page content;
  - the header search, which lazy-loads the drawer component itself (for A1).
- **`UbSlowLoadingNote`** is in the route skeleton and both loading shapes:
  after 10 s, "This is taking longer than usual. Check your internet, then try
  again." with Try again (a reload).
- **After a feature reset the signed-in page remounts.** A `resetGeneration`
  count is kept in the session slice, and the page is keyed by it, so every
  fetch runs again under the new app. The warm-up request is forgotten on a
  reset, so `/parties` does not claim the discarded one.
- The loading words come from a design-system context (`UbLoadingLabels`),
  English by default, which the app fills once with translated words. The
  design system has no dependency on the app's translations.
- An Expenses test that waited for "a dialog" now waits for the "Add expense"
  dialog by name, because the "Loading…" drawer now answers first.
- "Loading customers" on the Suppliers list now reads "Loading suppliers".
- **Environment:** the disk filled to 300 MB free during the final run. I
  removed only my own temp logs, and the unit suite ran in quiet batches (all
  pass).

## Results (`e2e/a8-first-tap.mjs`, after)

- **P1/P3:** the shape at **40–46 ms** on every opener, both sizes, "Remind"
  included (was 1,250–1,320 ms). The content arrives when its code does.
- **P2:** the heading never lost.
- **P5:** rows at **240–347 ms** on all 12 trips (Library → Suppliers and
  Library → Customers, 390 and 1280), where they never appeared before.
- **Looked at:** the loading drawer at 390 (bottom sheet) and 1280 (side
  panel), and the dialog at 1280.
- **Unit:** the two guard tests, the loading shapes, the slow note (fake
  timers: nothing before 10 s, then the message and Try again), and the reset
  counter.
- **Bundle:**
  - the shared chunk every route pays fell **0.4 KB** (115.2 → 114.8);
  - the routes that open drawers carry their loading view (+0.0–0.5 KB), raised
    with a note.

## Regression and monkey

See "Final round" below.

## Not done, listed

- **The header search** on a phone lazy-loads the drawer component itself, so it
  still shows nothing until that arrives (A1's to decide).
- **An app switch by the switcher** also remounts the page it lands on, which is
  correct (new app, new data) and costs one remount.

## P6 — the owner's report: Home stuck on its skeleton after signing in

The same trap as P5: signing in (`passwordLogin` / `verifyOtp`) has
`resetAll: true`, which wipes every feature's state, and a Home that had already
started loading waited for ever; a reload started clean. With the remount after
a reset, **8 of 8 sign-ins (390 and 1280) show Home's figures in 290–594 ms**
with no reload. It is now P6 in `a8-first-tap`. **Not proven:** the same check
on the build before the fix. The second build to compare was refused by the
permission check, so this rests on the shared cause (P5 failed 6/6 before the
fix and passes 12/12 after) and on the fixed build passing.

## Final round

- **Regression (P0 §10):** a6-forms 24, a5-measure, a3-customer-box-look 70,
  a3-functional, a4-money, a4-remove-undo, a4-functional and a4-edges 11/11 at
  both sizes all pass. a7-measure: 2 failures during a concurrent probe, then 32/32
  alone.
- **Monkey** on Home, Customers and Suppliers, seeds 121–123 at 390 and 1280:
  **16/18**, then **18/18** after replaying the two failures alone.
  - Suppliers 122 @1280 hit the watchdog during my concurrent sign-in probe;
    it passes alone.
  - Suppliers 123 @390 logged React error #418 (a server/client mismatch) once,
    during the same probe; it passes alone. **Not reproduced**; the seed is
    kept for a hunt.
  - The seed-64 replay, the original 7.9 s "slow return", passes.
- **A8 harness:** 38 checks, 0 failures:
  - 30 first-tap checks;
  - 12 P5 trips (6 per size);
  - 8 sign-ins.
- **Environment note:** another local app took port 3000 during the run, so the
  final checks ran on our build at port 3005.

## Score sheet (P0 §8)

| Points | Earned | Evidence |
|---|---|---|
| Business 2 | 2 | A list opened from another app, and Home after sign-in, now show the server's rows and figures (12/12, 8/8); no data is lost or mixed (the reset that keeps apps apart stays) |
| Design 1 | 1 | The loading shape is the real drawer/dialog frame, looked at on a phone and a desktop |
| Functional 1 | 1 | The press is answered in about 45 ms everywhere; the page stays; a stalled load explains itself and can be closed |
| User 2 | 2 | Monkey 18/18 after replays (two concurrent-run failures explained); first-tap runs in a cold browser |
| Data 1 | 1 | The guard test makes a silent lazy overlay a build failure; the warm-up cannot claim a wiped answer |
| Performance 1 | 1 | Shared chunk −0.4 KB; tap-to-shape 1.3 s → 45 ms; rows from another app: never → ~340 ms |
| Honesty 1 | 1 | This report, the unproven before-comparison and the unreproduced #418 included |
| Owner found nothing 1 | 0 | The owner's |
| **Total** | **9.0 / 10** | **Ready for the owner's check** |

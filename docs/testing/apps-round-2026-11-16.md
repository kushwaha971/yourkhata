# Library, Lending, Money book, switching and isolation round — 16 Nov 2026

Live stack (API :8000, app :3005), QA owner `scale@digikhaato.test`.

| Area | Evidence | Result | Rating |
|---|---|---|---|
| Library | library-round 72/72, library-measure 23/23, access-groups 69/69, monkey /library 390+1280 × seeds 111/222/333 (200 steps) 6/6 PASS; students count checked against `meta.counts.all` (skew fails as it should) | pass | 9/10 |
| Lending | lending-round 64/64, lending-measure 17/17, lending-new-checks 24/24, staff-lends 42/42, monkey /lending 6/6 PASS | pass | 9/10 |
| Money book | moneybook-round 97/97, old-udhaar-gone 16/16, monkey /money-book 6/6 PASS; report figures checked against `/moneybook/report` (skew fails) | pass | 9/10 |
| Switching apps and businesses by tap | `e2e/apps-switch-isolation.mjs` A+B at 390 and 1280: each app opened by tapping its card, twice round, under 6 s (≈0.7 s), screen = session, no overflow, two fast taps agree, Back is safe, branch and home by the switch question, the screen names only the open business; apps-primary 47/47 | 1 defect found and fixed, then pass | 9/10 |
| One app's data never shows in another | same harness part C: a Money book entry of ₹7,376.37 moves only the Money book "To get" by exactly that (₹1 skew self-test caught); shop, library and lending totals unchanged; their APIs and six screens show neither name nor amount; a Shop customer is not listed by Money book, Library or Lending; cleanup restores the total | pass | 9/10 |

Final run: 88/88.

## Defect found and fixed

On the Apps page, tapping the card of the app already open ("Open now") did nothing, so the merchant stayed on Apps. Now it takes them back to where they were in that app. In a sheet over that app's own screen, it still just closes. Test first (`AppSwitching.test.tsx`), then the e2e run.

## Retired harnesses

These six called APIs the rebuilt apps no longer have: `/library/membership-types` returns 404, the profit route is gone, and the loan fields are now `count/lent/each`.
- `library-book-look`, `library-slip-look`, `librarymoney`
- `lending-advance-look`, `lending-migrate-look`
- `revamp-khata-people`

Their rounds above cover each app's current screens.

## Why 9 and not 10

- No manual pass in Hindi or dark mode this round.
- Lending advance collections (paying ahead) have unit tests but no live harness since `lending-advance-look` was retired.

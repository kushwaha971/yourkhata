# Settings and Your profile — P0 round, 16 Nov 2026

Scope: the approved design `docs/revamp/design/settings-and-profile.html` as built
in pieces 1–4 and the page bodies (14–15 Nov), plus change mobile, delete by
code and "no password or email for anyone" (15 Nov). Live stack: API :8000
(console codes), the built app on :3005, the QA owner `scale@digikhaato.test`
and the QA staff, admin and accountant numbers.

## What ran, and what it found

| Check | Result | Found |
|---|---|---|
| `e2e/settings-roles.mjs` — 4 roles × 12 Settings pages × 390/1280; each role saves its own name and it reads back; owner/admin business email and UPI QR switch saved, read back, restored; accountant locked; no raw message ids | 728/728 | earlier rounds: raw ids in the menu on eight pages (H85) |
| `e2e/change-mobile.mjs` — taken number, wrong code, right code read back, sign in with the new number, change back, 390/1280 | 22/22 | the byte/char log offset in ten harnesses (H84) |
| `e2e/delete-by-code.mjs` — fresh mobile-only owner, throwaway business, download, wrong code deletes nothing, right code schedules deletion (read back), cancelled | 10/10 | — |
| `e2e/settings-edges.mjs` — catalogue E1, E2, E4, E5, E7, E15, E17, E18, E26 at 390/1280 | 40/40 after fixes | **E7** the name box took 200 letters (server keeps 120) — fixed, `maxLength`. **E5** a second tab's save on Bills and print was refused (412) and the page said nothing, because the conflict dialog lived only on the Settings list — fixed, `BillDefaultsPanel` shows it (unit test) |
| Monkey `e2e/monkey.mjs` on `/settings` and `/settings/me`, seeds 11/22/33 × 390/1280 × 300 steps | 12/12 PASS (after the harness fix below); screen-agrees-with-server checks 15–78 per run; API p95 56–91 ms | **harness defect:** after wandering into a bill opened as `/sales/invoices/new?item=…`, the line a person typed went on hold (found on the server) while the new bill started with the address's item; the data check only looked at held bills when the new bill was blank and called the line "lost". Fixed in the harness; seeds 11 and 22 then PASS |
| React #418 on first load (the "sign-in page" error) | seen 2× in the first monkey pass on `/settings/me` at 390; 0× in 12 runs with readable errors and 0× in the rerun | The disk had 2.4 GB free and the build later failed ENOSPC; clearing the build cache gave 6.9 GB and the error has not appeared since. **Likely cause, not proven.** The harnesses still fail on it |
| Owner data after the monkey | the monkey changed `ledger.reminder_templates` and `ledger.credit_limit_mode` on the Settings list's Money Book section; restored from the snapshot taken before the runs | — |

## §8 score — 5/10, "in test"

| Points | Earned | Evidence / why not |
|---|---|---|
| 2 Business | 2 | every value a Settings screen changes is read back by the server with a self-test that fails on a skewed value: own name, mobile, business email, UPI QR switch, terms line, deletion status (settings-roles, change-mobile, delete-by-code, settings-edges). No money or stock figures on these screens |
| 1 Design | 0 | **not done:** no side-by-side against the design's mocks at 390/320/1280, no dark theme, no Hindi pass. Pages were LOOKED at in light, English, 390/1280 only |
| 1 Functional | 1 | every workflow end to end (profile, change mobile, delete, UPI QR, terms, Apps note); the account bar shows the new mobile without a reload; server reasons shown (mobile taken, code wrong, empty name, changed elsewhere); nothing refused is sent (E15) |
| 2 User | 1 | monkey 3 seeds × 2 sizes passing with its data check run; catalogue cases E1/E2/E4/E5/E7/E15/E17/E18/E26 run. **Missing:** a written manual exploratory pass |
| 1 Data and recovery | 0 | reload, Back, leave, offline and two tabs run on purpose (settings-edges). **Not run:** a lost reply (the save reaches the server, the answer does not) |
| 1 Performance | 0 | time to content 77–116 ms (E18), API p95 56–91 ms (monkey), bundle within budget. **Not captured:** requests per action, long tasks and heap per run |
| 1 Honesty | 1 | this table; the harness defects named; "not run" written as such |
| 1 Owner found nothing | 0 | the owner found that Apps should never be "View only" and that no one should have a password or email, after those pieces were called built |

**To reach 9:** the design comparison at 390/320/1280 in light and dark, EN and HI, with mocks side by side; a written manual pass; a lost-reply test on profile save, terms and delete; requests-per-action, long tasks and heap recorded from the monkey. The owner point cannot be won back for this round.

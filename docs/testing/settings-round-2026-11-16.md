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

## Second pass, same day — closing the gaps

| Check | Result | Found |
|---|---|---|
| `e2e/settings-design.mjs` — 10 screens (Settings, Your profile, change mobile, Business details, Bills and print, Devices, Activity, Plan, Your data, Apps) × 390/320/1280 × light/dark × EN/HI, plus the refused-name error state: nothing off the screen, no cut words, no raw ids, theme and language really applied | 636/636 | — |
| Side by side with the design's mocks (`e2e/design-compare.mjs --design=settings-and-profile.html`, sheets `compare-settings-phone*.png`, `compare-settings-desk.png`), LOOKED at | not identical | the differences below |
| Lost reply (`settings-edges.mjs`, `delete-by-code.mjs`): the save reaches the server, the answer is cut | 8/8 + 1/1 | the screen never says "saved" without an answer; the server's value is shown after reload; saving again changes nothing twice; a lost delete reply shows the deletion as requested after reload, with Cancel |
| `e2e/settings-perf.mjs` — per page at 390/1280: time to content, reads on opening, any read asked twice, long tasks, heap; writes per save | 52/52 after one fix | **Plan read `/auth/me` twice on opening** (the session's read, then its own a moment later) — fixed: Plan reuses a session answer under 5 s old (`sessionReadInFlight`, unit test). Content 105–896 ms (Bills and print the slowest), long tasks 0 ms, one write per save. Harness defect: the first page counted the sign-in page's late requests — the harness now waits for it to settle |

### Manual pass (phone 375, in the built-in browser, 16 Nov 2026)

1. Signed in through the test door; landed on Customers. Opened Settings: the card, Apps, Business, Team groups read cleanly; nothing cut.
2. Tapped the profile card → Your profile. Opened Language, chose हिन्दी: the whole screen, the field labels and the bottom menu changed at once; the list closed after a short animation.
3. Chose English again: everything back in English.
4. Opened Bills and print, scrolled to "On every bill": the terms box empty with its hint, the UPI QR switch on (as restored after the test runs).
5. Observation, not fixed: the Preview's sample app header draws a dark "Save" button that looks tappable but is only a picture (the older branding page).

### Where the built screens differ from the design (for the owner)

1. **Settings list:** below the design's list ours still shows the older Money Book reminder settings and the Features switches. The design has neither; nothing was removed without the owner.
2. **Business details:** ours keeps legal name, PAN, bank details and signature, which the design leaves out.
3. **Bills and print:** ours keeps brand colour, app name, header and footer lines; "On every bill" sits at the bottom, the design has it right after the logo.
4. **Activity:** ours filters by date and lists rows; the design filters by person (chips).
5. **Plan:** "Unlimited" with no bars (only team members are metered, DEC-001); the design shows bars for four limits.
6. **Your data:** ours also has Support access, and its delete section is laid out differently.
7. **Your profile:** "Open when I sign in" links to Apps instead of a dropdown; Save sits in the card, not at the bottom; no email (owner rule).

## Third pass — built to the design (owner: "Build to the design")

Each of the seven differences was built as the design draws it. Nothing that
worked was deleted: what the design has no place for moved into a closed
"More …" section at the bottom of its page.

| # | Page | Now | Kept, closed |
|---|---|---|---|
| 1 | Settings list | ends at the design's groups | "More settings": Money Book reminders, the feature switches |
| 2 | Business details | one column: Business (name, business mobile, email), Address (shop address, city, PIN, state), Tax (GST, UPI ID) | "More details": legal name, business type, PAN, address line 2, bank, signature, bill-header preview |
| 3 | Bills and print | Logo, then On every bill, then Preview | "More bill look": colour, app name, header and footer lines |
| 4 | Activity | person chips (Everyone first) over the list | "More filters": period, kind of change |
| 5 | Plan | "Your plan" card, then "How much is used" | — |
| 6 | Your data | Download, then Delete with a red border | "Support access" — opens by itself while a request waits or an access is live (a unit test caught it hidden) |
| 7 | Your profile | "Open when I sign in" is a dropdown of every app in every business (sets the same primary as Apps); Save at the bottom, docked over the menu on a phone | — |

Rechecked on the new build: settings-roles 732/732, settings-design 636/636,
settings-edges 48/48, settings-perf 52/52, full frontend suite green, bundle
within budget. Side-by-side sheets `compare-v2-phone*.png` LOOKED at.

**Still different from the design, each because of a rule rather than a
choice:** (a) the GST status is shown in Tax — tax on every bill follows it;
(b) Plan shows "Unlimited" with no bars — only team members are metered
(DEC-001) and this business has no limit; (c) Activity's rows are the app's
standard list, not the design's simpler rows; (d) the closed "More …"
sections exist at all.

**Owner, 16 Nov 2026: "Accept all four"** — (a)–(d) are accepted as built.

## §8 score — 9/10, closed

| Points | Earned | Evidence |
|---|---|---|
| 2 Business | 2 | every value read back with a skewed self-test (settings-roles, change-mobile, delete-by-code, settings-edges) |
| 1 Design | 1 | measured at 390/320/1280, light/dark, EN/HI and after an error (settings-design 636/636); side by side with the design's mocks (compare-v2-*.png); the remaining differences (a)–(d) accepted by the owner |
| 1 Functional | 1 | every workflow end to end; reasons shown; nothing refused is sent |
| 2 User | 2 | written manual pass; monkey 12/12 at 3 seeds × 2 sizes with its data check; catalogue cases run |
| 1 Data and recovery | 1 | reload, Back, leave, offline, two tabs, lost reply |
| 1 Performance | 1 | settings-perf 52/52; bundle within budget |
| 1 Honesty | 1 | every finding, harness defect and not-run written down |
| 1 Owner found nothing | 0 | lost this round |


## §8 score — 8/10, "in test" (second pass)

| Points | Earned | Evidence / why not |
|---|---|---|
| 2 Business | 2 | as below |
| 1 Design | 0 | measured at 390/320/1280, light/dark, EN/HI and after an error (636/636), and LOOKED at side by side — **but the seven differences above are not matched or approved**; the point needs the owner's call on each |
| 1 Functional | 1 | as below |
| 2 User | 2 | the written manual pass above; monkey 12/12; catalogue cases run |
| 1 Data and recovery | 1 | reload, Back, leave, offline, two tabs and now a lost reply, each on purpose; nothing lost or doubled |
| 1 Performance | 1 | time to content, reads per page, writes per save, long tasks and heap measured (settings-perf 52/52); bundle within budget |
| 1 Honesty | 1 | both tables; harness defects named |
| 1 Owner found nothing | 0 | lost for this round |

**9/10 needs one thing:** the owner's decision on the seven differences — build them as the design shows, or accept each as it is.

## §8 score, first pass — 5/10

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

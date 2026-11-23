# End-to-end evaluation of the built Shop pieces

19 October 2026, at `ef382e31`. Real code, real API, real Chromium, isolated synthetic data (`seed_scale`: 300 parties, 400 items, 1,500 bills). No production data. Full report with screenshots: claude.ai doc "YourKhata Shop — end-to-end evaluation, 19 Oct 2026".

## Results

- **Backend:** 4,656 tests: 4,638 passed, 16 skipped, 2 failed (Library 20,000-copy timing test under CPU load, passes alone; sprint-1 route matrix, fails identically on unchanged `dev` in the sandbox). Seven cross-book access defects reproduced, fixed and pushed today (see `2026-10-19-access-audit-imports-exports.md`).
- **Money invariants:** `check_invariants` — 300 balances, 0 drifted; 400 stock levels, 0 drifted.
- **Frontend:** Jest 400 files / 4,505 tests passed (two parts after a sandbox restart: 2,487 + 2,018). Type check, contrast (174 pairings), i18n (6,495 keys, 54 catalogues), bundle budgets and production build pass.
- **Browser journey:** `journey.mjs` 56/56 across 8 viewports (360 px to 4K, short 1280 × 560).
- **Pieces (`revamp-shots.mjs`):** Customers 76 frames and Suppliers 61 frames clean (overflow, cut text, contrast) at 320/390/1280, light/dark, Customers also Hindi at 320/1280, including the real one-tap payment write. Person page: 15 frames clean at 390 light; the run then stopped because the harness measured before `main` mounted under CPU load. Shop Home (new `--piece=home`, today's screen): 0 overflow, 0 contrast findings, chart axis labels clipped in every frame.

## Provisional scores (09 rubric, gate strictly above 8.6)

| Piece | Score |
|---|---|
| Customers | 8.70 |
| Suppliers | 8.69 (about 8.4 against the whole spec: BP-10, BP-08 absent) |
| Person page | 8.51 |
| Shop Home as it is today | 7.96 |

Provisional until 09 §5: real phones, installed PWA, TalkBack, shopkeeper tasks. No whole-Shop score.

## Defects found

1. Home chart y-axis labels clipped (",00,000") at every width, theme and language — fix in the Home rebuild.
2. Udhaar promise dates shown on Shop Home ("Collect on") and the Shop person page ("Promised to pay on") — DEC-019 question.
3. Payment drawer keeps the earlier error visible after a successful retry.
4. Person-page harness measures before the page root mounts under load.
5. `final-reports-qa.mjs` bills before the stock it opens; the server correctly refuses, so its report cross-checks did not run.

## Sandbox method (not committed)

Google Fonts and Playwright's browser download are blocked in the claude.ai sandbox. The same font files came from npm through `NEXT_FONT_GOOGLE_MOCKED_RESPONSES`, and a preload shim pointed `chromium.launch` at `@sparticuz/chromium` (Chromium 131).

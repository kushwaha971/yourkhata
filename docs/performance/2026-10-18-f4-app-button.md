# F4 App button and sidebar app tree: before and after (18 Oct 2026)

What changed (one commit after `112a840`):
- **Phone**: for a person with two or more apps, the bottom bar's fifth slot is the App button. It shows the open app's icon and short name with a ▴ ("Shop", "Udhaar", "Library", "Lending"; Hindi "दुकान", "उधार", …), is a `button` with `aria-haspopup="dialog"` and the label "Apps and more, now in Shop", and opens the **App sheet**. The sheet has the app tiles (88 px, the open app filled teal with a check) and then everything `/more` held. Both use one `MoreMenu` body, so the two cannot disagree. A person with one app still sees More, unchanged.
- **Desktop**: with two or more apps the rail is an app tree. Under an "Apps" caption, the open app is expanded to its sections and the others are one row each. Team and Settings stay at the bottom.
- **Look (R-DEC-02, R-DEC-06)**: white page (`--canvas` 100%), dark teal rail #0B3F45 (dark theme #0E2427), the existing logo on a 36 px white tile, and a marigold inset edge on the current row. The rail is now the specified 232 px (`--sidebar-width`, was 180).
- **Keeps your place**: switching to an app opens the screen it was last on, per business and per app, held in session storage (`appPlace.ts`) and falling back to the app's home. Clicking an app with Ctrl/⌘/Shift still opens it as a plain link.
- The sheet is `dynamic()` and fetched when the browser is idle after the bar first shows, so the first tap does not wait on a chunk.

## Found by the screenshots, fixed, each with a check that fails before the fix

| Defect | Why every unit test passed | Fix and check |
|---|---|---|
| Light theme: every rail label dark ink on dark teal, **1.4:1** | The row set the rail's light ink, but the label (`UbText`) applied its own default tone `text-primary`, dark in light theme and light in dark. `check:contrast` reads token pairs, not elements | labels `tone="inherit"`; jest "lets every rail label take the rail ink from its row"; harness measures each label against the colour behind it (now 7.7:1 light, 10.3:1 dark) |
| Sheet search field ran edge to edge, touching the tiles | `/more` pads it as a page; the sheet does not | `MoreMenu searchClassName` |
| "Delivery challans", "Purchase orders", "Income & expenses" cut mid-word | the tree's indent left ~120 px of text at 180 px | rail 232 px as specified; labels wrap to two lines instead of cutting; harness flags any clipped or clamped text in the rail |

The harness's first cut-text check looked at `aside`, which the rail is not (it is a `nav`), and passed. It was pointed at the real element and shown to fail on the old build before being trusted.

## Live (`node e2e/revamp-shots.mjs --piece=apps`)

At 390 and 320 px, 1024 and 1280 px, light and dark, plus Hindi at 320 and 1280:
- Phone: the App button shows the open app. The sheet lists Library · Lending · Shop · Udhaar book, marks one as current, and focus is inside it. A tile switches app. Switching back to Shop lands on **Customers**, where it was left, not Shop's home.
- Desktop: exactly one app expanded. A collapsed app opens and expands, and switching back lands on Customers.
- Light page rgb(255,255,255); rail rgb(11,63,69) light and rgb(14,36,39) dark.
- No sideways scroll and no cut text in the bar, sheet or rail at any size or language.

Screenshots: `/mnt/project-files/revamp/shots/apps/` (bar, sheet, sheet lower rows, switched, back; tree, rail close-up, switched, back), with contact sheets.

## Navigation speed (measured to be sure; this piece adds no work to a tap)

Same method as [2026-10-17-app-baseline.md](2026-10-17-app-baseline.md): `node e2e/perf-app.mjs --reps=3 --only=nav`, nothing else running. The "switcher → Udhaar" case now clears the remembered place first. Without that, repeats 2 and 3 correctly opened Udhaar's Aging (left there by the previous case) and the harness, waiting for `/khata`, timed out.

| Throttled, tap → first change | After F3 | After F4 |
|---|---:|---:|
| All measured (54), p50 / p95 | 99 / 701 ms | 95 / 598 ms |
| Without Lending Today → Loans (48), p50 / p95 / max | 97 / 156 / 170 ms | 91 / 168 / 186 ms |
| Customer row → person, 390 / 1280 (median) | 19 / 9 ms | 17 / 8 ms |
| Switcher → Udhaar home, 390 / 1280 (median) | — | 29 / 11 ms |
| Lending Today → Loans, 390 / 1280 (median) | 1,170 / 588 ms | 926 / 369 ms |

No regression; the differences are inside run-to-run spread. Lending Today → Loans is still most of the p95 (it unmounts 1,576 rows) and needs the Today paging proposal; Lending is frozen. Unthrottled p50 / p95: 33 / 136 ms (390), 31 / 88 ms (1280).

## Bundle

Imported statically, the sheet put about 3.5 KB on every app route. Loading it lazily brought that to about 1.2 KB: the tree, the four app icons and the place memory, which every screen draws. The shared shell is unchanged at 112.2 of 113 KB. 144 route scalars were raised to measured + 0.3, with the reason in `bundle-budgets.json`.

## Not built in this piece (still in 07-screens/02)

- A figure on each app tile.
- "+ Add an app" in the sheet.
- The unsaved-changes guard on switching.
- The per-row pending spinner.
- The 64 px icon rail at 1024–1279 px. At 1024 the Customers filters now wrap to a second row because the rail is 52 px wider.
- Hiding the bar while the keyboard is open.
- `/account`.
- The notifications popover.

A long business name in the rail header still ends in "…".

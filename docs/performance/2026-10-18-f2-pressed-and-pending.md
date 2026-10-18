# F2 pressed and pending states: before and after (18 Oct 2026)

What changed (one commit after `22fbb6a`):
- `useAppRouter()` replaces `useRouter()` in all 68 feature modules; its `push` marks a navigation pending, and `RouteProgress` draws a 2 px teal line at the top of the screen from that moment until the address bar reaches the new screen. A lint rule now refuses `useRouter` from `next/navigation` outside that hook.
- Pressed looks: every button variant squeezes to 0.98 on press; secondary, outline and ghost buttons take the teal press tint instead of their hover grey; the main (marigold) action has a press colour of its own (`--accent-700`, darker than hover; ink contrast 4.76:1 light, 5.81:1 dark); bottom tabs, desktop sidebar rows and desktop table rows now change when pressed. Reduced motion keeps the colours and drops the squeeze.

Method: as in [2026-10-17-app-baseline.md](2026-10-17-app-baseline.md): same container, book, build flags and `node e2e/perf-app.mjs --reps=3 --only=nav`, 57 navigations per profile, nothing else running.

## Throttled (4× CPU, 1.6 Mbps, 150 ms), tap → first visible change

| | Baseline | After F1 | After F2 |
|---|---:|---:|---:|
| All 57 navigations, p50 / p95 | 363 / 819 ms | 98 / 711 ms | **93 / 759 ms** |
| Without Lending Today → Loans (51), p50 / p95 / max | — | 94 / 306 / 381 ms | **90 / 172 / 260 ms** |
| Customer row → person page (`router.push`), 390 / 1280 | 353 / 387 ms | 299 / 312 ms | **18 / 7 ms** |
| App switcher → Udhaar (`router.push`) | 34 / 14 ms (menu closes) | 33 / 13 ms | 23 / 18 ms |
| Lending Today → Loans, 390 / 1280 | 819 / 763 ms | 868 / 618 ms | 1,076 / 647 ms |
| INP sample p75 / max | 56 / 176 ms | 56 / 72 ms | 56 / 152 ms |

Unthrottled p50 / p95: 33 / 134 ms.

## What it proves, and what it does not

- **A tapped row now answers in under 20 ms** with the progress line, where the screen stood still for ~300 ms after F1 and ~350 ms before it. The line is the first change in every `router.push` navigation measured.
- **Without Lending Today, p95 is 172 ms**: every other tap in the set draws something within 260 ms on the throttled profile. The 100 ms p95 target (G1) is still not met; the tab taps sit at 85–190 ms because the first change for them is the prefetched loading view, which needs a render.
- **The all-navigation p95 (759 ms) is Lending Today → Loans alone**: 6 of the 57 navigations, all of them 600–1,200 ms, because leaving Today unmounts 1,576 rows in one block. Its run-to-run spread (868 → 1,076 ms on the phone) is that block's variance, not a regression from this change, which adds nothing to that tap. The fix is paging Today (H8), which needs the owner's approval because Lending is frozen (L-01).
- **The pressed looks cannot be timed by this harness**: `:active` changes style, not the DOM. They are proven by `e2e/revamp-shots.mjs --piece=press`, which reads each control's computed style at rest and 150 ms into a held press at 390 and 1280 px in both themes: all 12 cases changed (baseline: tab and desktop row did not change at all).

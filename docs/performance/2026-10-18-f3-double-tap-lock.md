# F3 double-tap lock: before and after (18 Oct 2026)

What changed (one commit after `f4482a1`):
- `UbForm` drops a second submit while the first is still running (two taps on Save, or a tap and Enter). The lock is a ref, because both events arrive before React re-renders; the dropped submit still has its native POST prevented.
- `UbButton` locks itself while an async `onClick` is running (`useAsyncAction`): busy look, spinner, `aria-busy`, and further taps ignored, whether or not the caller passed `busy`. A plain `onClick` (opening a sheet) is not locked.
- `mayHaveBeenSaved()` (`frontend/src/utils/requestKey.ts`) is the one rule for request keys: keep the key after a timeout, no network or a 5xx, so "Try again" replays the first save; mint a new one only after success or a refusal the server answered. Sales and purchase editors used their own copy of the rule; Lending Collect, Collect-from-borrower, New loan and Library's manual charge minted a new key after every failure (07-screens/13 L-R1). Client-only: no endpoint, body or calculation changed.
- Found by this piece's live run and fixed: on a 1280 px screen the first click on Lending "Save collection" after typing an amount did nothing. The mousedown blurred the amount, the blur padded "1" to "1.00", that cleared the preview card, the footer moved up, and the mouseup landed on empty sheet. Padding no longer clears the preview.

## Double taps, live (`node e2e/revamp-shots.mjs --piece=lock`)

The save's POST is held for 3 s, Save is tapped twice 60 ms apart and Enter is pressed; the requests that left are counted.

| Case | 390 light/dark | 320 light/dark | 1280 light/dark |
|---|---|---|---|
| Udhaar "You gave" entry | 1 POST, busy | 1 POST, busy | 1 POST, busy |
| Lending Collect | 1 POST, busy | 1 POST, busy | 1 POST, busy |
| Collect, answer lost then Try again | same key, replayed, one receipt | same key, replayed, one receipt | same key, replayed, one receipt |

The lost answer is real: the first request reaches the server and is saved, and the browser is told it timed out. The retry carries the same `Idempotency-Key` and the server answers `Idempotent-Replayed: true` with the first receipt number (e.g. RCT/26-27/5054 twice). Before this change the retry carried a new key, which the unit test `CollectDialog.test.tsx` "retries a timed-out save under the SAME key" shows failing on `f4482a1`.

Screenshots: `/mnt/project-files/revamp/shots/lock/` (ready, busy, saved; no-answer and retried for Collect).

## Navigation speed (unchanged by design, measured to be sure)

Same method as [2026-10-17-app-baseline.md](2026-10-17-app-baseline.md): `node e2e/perf-app.mjs --reps=3 --only=nav`, 57 navigations per profile, nothing else running.

| Throttled, tap → first change | After F2 | After F3 |
|---|---:|---:|
| All 57, p50 / p95 | 93 / 759 ms | 99 / 701 ms |
| Without Lending Today → Loans (51), p50 / p95 / max | 90 / 172 / 260 ms | 97 / 156 / 170 ms |
| Customer row → person, 390 / 1280 (median) | 18 / 7 ms | 19 / 9 ms |
| Lending Today → Loans, 390 / 1280 (median) | 1,076 / 647 ms | 1,170 / 588 ms |

No regression: the differences are inside run-to-run spread. Lending Today → Loans is still the whole p95 (unmounting 1,576 rows; needs the Today paging proposal, Lending is frozen).

## Bundle

Shell 112.0 → 112.2 KB (the lock lives in `UbButton`, which every route loads). Most form routes' own chunk grew 0.4–1.0 KB from a Turbopack chunking duplicate (lucide's icon factory copied into the forms' validation-message chunk), not from new code; found by diffing that chunk's module ids against `f4482a1`. Budgets raised to measured + 0.3 with the reason in `bundle-budgets.json`.

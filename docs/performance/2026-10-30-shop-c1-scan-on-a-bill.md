# C1 — Scan on a bill

> **Status: BUILT, design gaps closed, monkey to run** (30 Oct 2026). Design: §C1 of
> `docs/revamp/design/shop-fixes-and-business-types.html` (v7), mocks `pScan`
> (phone camera, continuous) and `dScan` (desktop USB scanner, line flash,
> not-found note); plan `docs/revamp/13-business-types-and-scanning-plan.md` §2.

## Spec to check

| # | What | Source | Check |
|---|---|---|---|
| S1 | Desktop: USB/Bluetooth scanner (keyboard wedge) adds a line; the same item again raises Qty and the line flashes green | dScan, plan §2.1 (exists) + §2.2 (flash) | live: scan burst → line read back from the bill draft API, qty +1 |
| S2 | A short beep and a vibration on each scan (beep "on" badge: "Scanner connected · beep on") | dScan, plan §2.2 | unit (audio/vibrate called once per code) |
| S3 | Not found: "Not found: 8901030875021. The bill is not affected." with "+ Add item" and close; does not steal focus | dScan `.notfound` | live: unknown code → note shown, caret still in search, bill unchanged (API) |
| S4 | The cursor stays in the search after a scan | dScan side card | live: `document.activeElement` |
| S5 | Phone: a scan icon in the item search opens a full-screen camera sheet: close, title "Scanning for bill · INV-0419", torch, framing box, "Point at the barcode. Keeps scanning until Done." | pScan | screenshot vs mock at 390/320 |
| S6 | Continuous: each code adds or raises a line; tray shows "Last scanned", the count and running total, the last three items (newest first, green "+"), and Done | pScan `.tray` | live with a fake camera stream: lines read back |
| S7 | Camera blocked / no camera: "Camera is blocked … Or type the code below." with a Barcode field and Add; the bill keeps working | pCamBlocked (C2) | live: permission denied → message + typed code adds a line |
| S8 | Speed: code read → line visible ≤ 150 ms p50 at 4× CPU (scanner and camera); sheet open → first frame ≤ 1 s | plan §2.4 | timing harness |
| S9 | Decoder chunk loads only when the sheet opens; 0 KB added to the initial bundle | plan §2.2 | bundle:check |

## Conflict / decision for the owner

- **Camera decoding on iPhones needs a library.** Chrome on Android has the
  built-in `BarcodeDetector`; iOS Safari does not. The plan names a lazy
  WASM decoder (`zxing-wasm` / `@zxing/browser`) under a new ADR-064.
  CLAUDE.md: a new dependency needs the owner's yes. Until then the camera
  works where the phone supports it and every other phone gets the "type the
  code" path (S7), which the design already draws.

## Where it stands (30 Oct 2026, evening)

`node e2e/c1-scan.mjs`: **25/25** on the live stack; `--skew` fails all 12
read-back checks (the self-test). Side by side: `/tmp/e2e-shots/c1/compare-c1.png`.

| # | Status | Evidence |
|---|---|---|
| S1 | passed | c1-scan: line added, qty 2 read back from the draft API (`"2.000"`), flash present |
| S2 | passed | c1-scan: oscillator started once; `navigator.vibrate([40])` once per camera scan. Badge "Scanner connected · beep on" shows **after the first scan** (unit + live) |
| S3 | passed | c1-scan: 404 proven first, note text exact, caret kept, nothing added |
| S4 | passed | c1-scan: `activeElement` is the search after each scan; "What the scanner does" card shows after a scan (desktop) |
| S5 | passed except the bill number | corner brackets measured (`clip-path: polygon`); title reads "Scanning for bill" |
| S6 | passed | tray row "+ C1 scan item  × 1 · ₹52.50", its ink measured light on the dark tray |
| S7 | passed | "Camera is blocked", the Barcode box focused on open, typed code adds the line |
| S8 | unproven | timing harness not written yet |
| S9 | passed | camera sheet and zxing in their own lazy chunks; the editors grew 1.9 KB for the search's scan path (bundle-budgets note) |

**Found by looking, fixed with checks that fail first:** the tray row's words
were dark on the dark tray (UbText paints its own colour, so the row's colour
never reached them). `innerText` read them fine, so the check now measures
each span's computed colour.

**Differences from the design, kept on purpose (owner to confirm):**
- *Bill number in the camera title.* The design says "Scanning for bill ·
  INV-0419"; a draft has no number until it is issued (A4 decision), so
  inventing one would be false. The title says "Scanning for bill".
- *"Scanner connected" before any scan.* A USB scanner is a keyboard; the
  browser cannot see it. The badge appears after the first scanned code.
- *"+1 scanned" sits under the Qty box*, not beside it: the Qty column is the
  box's own width at 1280.
- *Tray summary vs row*: the summary is the bill's grand total after round-off
  (₹53.00) and the row is that line's amount (₹52.50); both are the bill's
  own figures.

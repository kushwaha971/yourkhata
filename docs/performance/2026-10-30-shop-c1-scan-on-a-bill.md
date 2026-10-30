# C1 — Scan on a bill

> **Status: STARTED** (30 Oct 2026). Design: §C1 of
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

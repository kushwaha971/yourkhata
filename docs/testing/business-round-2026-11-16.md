# Business round — 16 Nov 2026

Repeats the per-kind regression and the Business-wide monkey that the
13 Nov audit (`apps-audit-2026-11-13.md` §7 items 2 and 4) left open.

## Per-kind regression: 62 of 62 pass

The first full run had seven failures. None was a product defect; each was
the harness, fixed in commit cbf9bbd and rerun to PASS:

| Harness | Cause | Fix |
|---|---|---|
| a4-money | matched an item by substring and picked the wrong one | word-start match |
| a5-measure | item search stopped at 200 items | pages through items |
| quick-sale-return | relied on an old SKU and a decimal keypad | seeded item; decimal or numeric keypad |
| d3-imei, d4-batches, d12-strip | `kind-shops.json` missing | regenerated with `kind-shops.mjs` |
| a3-customer-box-look, a6-forms, a7-measure | `E2E_BACKEND` lacked `/api/v1` | env fixed |

Before that, 61 harnesses worked out "today" in UTC and failed between
midnight and 5:30 India time; they now use `Asia/Kolkata` (commit 4568e67).

## Business-wide monkey: 6 of 6 PASS

`e2e/monkey.mjs --wander=10`, 200 steps, shots in `/tmp/e2e-shots/monkey-biz`.

| Size | Seed | Reload checks | Screen = server | API p95 | Page p95 | Worst page |
|---|---|---|---|---|---|---|
| 390 | 111 | 34 | 108 | 70 ms | 298 ms | 653 ms |
| 390 | 222 | 11 | 97 | 72 ms | 288 ms | 663 ms |
| 390 | 333 | 24 | 93 | 68 ms | 281 ms | 657 ms |
| 1280 | 111 | 58 | 110 | 88 ms | 496 ms | 768 ms (day book) |
| 1280 | 222 | 59 | 98 | 94 ms | 499 ms | 671 ms |
| 1280 | 333 | 40 | 103 | 69 ms | 504 ms | 681 ms |

The shop's modules and settings were snapshot before the runs and compared
after: no change.

## Still open

`test_run_scale` timing under machine load; Business days stays dormant
(no calendar reader yet).

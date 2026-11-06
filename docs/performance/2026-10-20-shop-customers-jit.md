# Shop Customers list: the database was compiling, not working

20 October 2026. Found by the editor piece's speed run
(`2026-10-20-p5-editor-compose.md`): Shop Home → Customers took 1.6–1.7 s
unthrottled, against 131–214 ms on this container on 18 Oct.

## Cause

`GET /parties?book=shop&type=customer` took 1.5–1.9 s on the QA tenant (2,000
contacts, ~20,000 sales documents); the plain list took 136 ms. `EXPLAIN
(ANALYZE)` of the slowest query: execution of the plan ~40 ms, then

    JIT: Functions: 502 … Timing: Generation 35 ms, Optimization 49 ms,
         Emission 554 ms, Total 638 ms

The Shop-facts annotations (`apps/parties/selectors/shop.py`) are ~30
correlated subqueries. Each is an index probe returning in microseconds, but
their ESTIMATED cost (1.6 M) is far above PostgreSQL's `jit_above_cost`
(100 k), so every query JIT-compiled first. The list, its totals and its chip
counts each paid it — three compiles per tap.

## Fix

`-c jit=off` on the application's connection options in `config/settings/base.py`
(local and prod inherit it) and the test settings. No query, figure or package
changed. `tests/performance/test_no_jit.py` asserts the live connection reports
`jit = off` and that base settings carry it; both fail before the change.

## Measured

- API, three calls each: 1,558–1,908 ms → 440–516 ms. Server time in a Django
  shell 1.46 s → 0.32 s; what is left is the totals (89 ms) and chip counts
  (92 ms), each a full-tenant aggregate over the same annotations, and the page
  (41 ms).
- `perf-app.mjs --reps=3 --only=nav`, same container, median of three:
  Shop Home → Customers 1,668 → 451 ms (390 px) and 1,649 → 611 ms (1280 px)
  unthrottled; 2,384 → 907 and 2,743 → 1,390 ms throttled. Customers → Bills
  also 23–138 ms faster. All 48 cases: median 738 → 642 ms, p95 1,807 → 1,357.
  Raw: `data/2026-10-20-no-jit-nav.json`.
- Still slower than 18 Oct (131–214 ms): the remaining ~0.3 s is the totals
  and counts computing each customer's dues for all 1,760 customers. Folding
  them into one aggregate, or a maintained per-party Shop dues column, is the
  next step if that is still too slow; neither is done here.

## Backend suite

Full serial run with this change: **4,673 passed, 16 skipped, 2 failed**, both
wall-clock ceilings, neither relabelled:

- `test_five_thousand_schedules_run_under_a_minute` — 166 s in the full run;
  alone 75.9 s with JIT off and 77.9 s with JIT on. Already red before this
  change (the handoff recorded 63.3 s).
- `test_close_over_twenty_thousand_copies_takes_under_five_seconds` — 11.7 s
  against 5 in the full run; passes alone with JIT off (and with JIT on). The
  handoff's full run had it green, so it is reported as red here and not
  attributed: it may be load in this long run or a cost of JIT off on a bulk
  statement, and that is not proved either way.

# Home 1 of 3 · cash count · 25 Oct 2026 (BP-17, R-DEC-26, R-DEC-32, R-DEC-34)

Scope: a new append-only `reports_cash_count` table with `GET/POST
/reports/cash-counts`; `last_count` on the dashboard's Shop cash tile
(`DASHBOARD_PAYLOAD_VERSION` dashboard-v3-cash-count); on Home, the cash
figure's count line and Count cash, and the new lazy `CashCountDrawer`. The
cash figure itself (`money_position`, Shop bucket) is unchanged.

Who needs it: the owner or whoever closes the counter. The records say what
should be in the drawer; only counting says what is. Before this, a count was
done on paper or in the cash book's close panel, which saves nothing (FR-8).
What it saves them: a dated record of each count against what the records said
at that moment, "Short by ₹50" in words, and on Home whether today's drawer has
been counted at all, without reopening a report.

## Spec-to-check map

| Requirement | Source | Check | Status |
|---|---|---|---|
| Append-only counted observation: actor, time, counted, server snapshot of expected cash, variance | 08 BP-17 | model + `ImmutableModel` + BEFORE UPDATE OR DELETE trigger; `test_counts_are_append_only_in_the_database` | passed |
| Reuse Shop `money_position`; never other books | 08 BP-17 | the snapshot is `cash_in_hand(tenant, today)`, the figure Home already shows; permission `reports.financial.read` in the Shop book | passed |
| Posts no adjustment, opening balance or payment | 08 BP-17 | `test_recording_a_count_posts_nothing`; harness reads the dashboard figure before and after a live count | passed |
| Show when a count was taken; distinguish later activity from the snapshot | 08 BP-17 | "Counted at 03:31" / "Counted on 23/10/2026"; `moved_since` on the newest count, said in the drawer | passed |
| Transactional snapshot; never subtract a stale browser tile at save | 08 BP-17 | the server computes expected inside the save's transaction and ignores any figure sent; drawer test shows the server's result when it differs from the preview | passed (rule below) |
| Duplicate submit / retry | 08 BP-17 acceptance | idempotency key, replay test; drawer reuses the key after a network error; live double tap records one | passed |
| Unauthorized staff; Shop-only reader; other tenant | 08 BP-17 acceptance | staff 403 for read and write; a replay is refused to staff (book check before replay); tenant isolation | passed |
| Positive and zero counts, negative calculated cash, exact paise | 08 BP-17 acceptance | backend tests; the live QA book's records figure is −₹15,72,421.24 | passed |
| Timezone midnight | 08 BP-17 acceptance | `business_date` is `tenant_today`; "at" vs "on" is decided on the tenant's clock | passed by construction, not by a midnight test |
| Split cash/UPI, backdated records, cancellations, concurrent transactions | 08 BP-17 acceptance | inherited from `money_position`, unchanged; no new test here | kept, not re-tested |
| Feature off keeps history | 08 BP-17 | counts are rows, nothing to undo; an older server's Home (no `last_count`) shows no count line | passed |
| Audit history | 08 BP-17 | `cash.counted` audit row with the four figures and the note | passed |
| Data export and deletion | PLT-10 registry | `cash_counts.csv`; deletion disables the trigger; `test_deletion_removes_sales_imports_and_reports_rows` | passed (found by the full suite) |
| Desktop cash figure "Not counted · Count cash" | Counter Mode rev 3, line 856 | page test; harness at 1024/1280 | passed |
| Phone cash figure "Not counted" | Counter Mode rev 3, line 947 | the phone also gets Count cash, on its own line | deviation 1 |
| 44 px target, no cut text, no broken figure, EN/HI 320–1280 | R-DEC-32 gates 3, 7 | harness `elementFromPoint` at centre ±21 px; text bounds; figure ranges | passed (findings 1–3) |

### The snapshot and freshness rule

The expected figure is read by `cash_in_hand(tenant, today)` inside
`record_cash_count`'s `transaction.atomic`, at READ COMMITTED, immediately
before the row is written. A payment committed before that read is in the
snapshot; one committed after is not, and shows up as `moved_since` on the
newest count the next time anyone reads it (`expected_now − expected_amount`).
The drawer's live "Short by" preview uses the figure from when it opened and
is labelled as the records' figure "now"; the saved result is always the
server's, and the drawer shows "Your records said ₹X then".

## Found by looking and by the live run

1. **The full backend suite found two gaps no new test had**: the PLT-10
   registry did not know the table (a business could not have been deleted,
   and its counts would have been missing from its export), and two exact
   dashboard assertions. Both fixed; the deletion test now proves the trigger
   is disabled for deletion and only for it.
2. **The desktop cash figure broke its minus onto its own line**
   ("-" then "₹15,72,421.24") at 1280 on the QA book's negative figure. This
   was the existing figure, not new code; the four figures now use the
   non-breaking minus and step down to 16 px when long. The harness now checks
   every figure range for line breaks.
3. **The first build drew a separate outlined button**, which the reference
   does not: it shows "Not counted · Count cash" as one caption line. Rebuilt
   to the reference. On a phone the link's 44 px target was clipped by the
   rounded figure card ("hits":[true,true,false]); the phone puts the link on
   its own line with room under it, and the check passes.
4. The link's underline did not draw: `UbButton` wraps its label in an
   `inline-flex` span, which a text decoration does not reach. The underline
   is on the label now; checked with computed style.

## Deviations and decisions recorded

1. **Count cash on a phone too.** The reference's phone cell says only "Not
   counted". The owner's rule is that about 80% of users are on phones, and
   counting the drawer at closing is a phone task; a phone that can see the
   state but not act on it would send the owner to a desktop.
2. **Gated on `reports.financial.read`**, the same permission that shows the
   cash figure. A role that cannot see the records' figure cannot count
   against it; recording a count is not delegable separately (no new
   permission was invented).
3. **Saving needs a connection** (`online-only`, not queued): a queued count
   would be compared, later, with a figure the counter never saw.
4. **The cash book's close panel is unchanged** and still saves nothing; its
   own count (FR-8) is a separate decision.
5. **Short is red, extra is amber.** Extra cash is usually a sale or payment
   not recorded, which is a warning rather than good news.
6. **Bundle**: `/dashboard` route 92.6 → 93.4 KB (measured 93.1) for the count
   line and the drawer's loader; the drawer, its form and schema are their own
   chunk. Two first-load figures (day book, reset password) moved by under
   0.1 KB with none of this code in them. Raised by measured + 0.3 with a note.

## Performance

`data/2026-10-24-cash-count/ccab.sh` and `ccperf.mjs`: dcaddbc (old) against
this build, four alternating rounds, six opens per viewport per round, 4x CPU
throttle, `/dashboard` on the QA book, timed from navigation to the cash
figure's amount drawn (the figure both versions link to the cash book).
n = 24 per cell.

| | old median (range) | new median (range) | |
|---|---|---|---|
| Phone 390 | 1,036 ms (910–2,239) | 1,066 ms (875–2,038) | level (+2.9%) |
| Desktop 1280 | 1,053 ms (845–2,248) | 1,031 ms (818–2,346) | level (−2.1%) |

Neither difference is consistent: the new phone is slower in two rounds and
faster in two (round medians 1,032–1,119 against 1,005–1,093), the desktop
faster in one and slower in three by smaller margins. Recorded as level, not
as a gain or a cost.

## Competitor comparison

Not done for this piece; unproven.

## Gates

| Gate | Result |
|---|---|
| `test_cash_count.py` | 17 passed |
| Backend suite (whole) | 4,697 passed, 16 skipped, 2 failed; both fail the same way on dcaddbc without this piece: `test_shop_aging_does_not_expose_udhaar_promise_or_limit[csv]` (a date that is tomorrow in UTC is today in IST after midnight) and `test_five_thousand_schedules_run_under_a_minute` (65 s on dcaddbc, 158 s here under a concurrent build, against a 60 s ceiling; the dues engine is not touched). Not hidden and no ceiling raised. |
| `CashCountDrawer.test.tsx` + Home tests | 8 + 3 new, all passed; reports feature 210 passed |
| `npx jest` (whole frontend) | 4,804 passed, 431 suites |
| `npm run type-check` | clean |
| `npx eslint --max-warnings=0` (reports feature) | clean |
| `npm run i18n:split && npm run i18n:check` | pass |
| `npm run build` + `npm run bundle:check` | pass (deviation 6) |
| `node e2e/cash-count.mjs` (live stack, QA book, writes counts locally) | 62/62 |

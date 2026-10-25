# Udhaar home / people register ·25October2026

Baseline851ddc61c; R-DEC-35 authorizes Udhaar→Lending→Library in this existing
revamp. Shop is the approved implementation reference. This piece is only
/khata and its filter group; person/entry/message/edit flows remain subsequent
features. Read04,10 §0 and12-shared-overlays before coding. No new plan.

## Pre-implementation requirement mapping

| Requirement/source | Implementation/reuse | Verification | Status |
|---|---|---|---|
| Shop composition;04+R-DEC-33/35 | Existing PartyListPageContent register,shared toolbar/grid,32px chips/44px targets |390/320/1024/1280 light/dark,Hindi320/1280;own-box/contrast/pagewidth |See dated evidence and limits below|
| Phone cards use most of screen | Compact header Add,one search+Filters,one quick-strip,concise directional totals | Normal390x844 card area≥60%;short/offline stress |See dated evidence and limits below|
| Append on scroll,manual retry | Existing append mode/UbLoadMore AFTER rows,inside region;no phone pager/FAB | Real page2,retain offset,500retry,no eager fetch-all/queryreset |See dated evidence and limits below|
| Due default accurate | ApprovedBP-20 balance=due at server BEFORE paging;active status;URL explicit | Both signs/paise/zero/other tenant/archived/Shop isolation |See dated evidence and limits below|
| Other chips and hidden records | Existing owes_me/i_owe/settled/unfiltered/status=archived | Actual API query,Back/reload,empty default→Show all |See dated evidence and limits below|
| No invented activity or chip counts | Existing last_activity_at and current-filter meta.total;no last entry amount from absent field | Source values,matching totals,missing facts honest |See dated evidence and limits below|
| Plain English/Hindi | Context-specific Udhaar labels;technical identifiers retained | Visible wording review,Hindi320;locale gates |See dated evidence and limits below|
| Notes optional | Existing create/edit note client+serializer reviewed;no finance change | Empty note save localQA if form used;next overlay separately |See dated evidence and limits below|
| Book/permission fences | Existing main-book API grants;page actions/rows are authorized | No-read/right combinations and scope tests |See dated evidence and limits below|
| Reuse/maintainability | Shared registertoolbar composition,existing filters/columns;no duplicate cache/engine | Changed-file lint/types/fulltests/build/bundle/contrast |See dated evidence and limits below|
| Performance | Same-machine old/new/old/new,quiet navigation | perf-app reps3 nav,matched routes/data,both numbers |See dated evidence and limits below|

## Product purpose and limits

A shopkeeper opens the book to find who has dues,see the direction and open
that person's khata. Amounts keep You will get/You will give words and are never
netted. Phone controls must not consume the records' space. Server paging and
filtered totals govern the default. No instant Undo: cancellation keeps a
reason. No archive refusal or ledger posting changes. Per-user independent
ownership remains an existing backend gap (02 §5.1),not solved by this layout.
Relevant competitor task comparison requires dated primary evidence;no claim
of superiority from appearance or self-rating. Physicalphones/PWA/keyboards/
OStext scaling and rural-user research remain unproved by Chromium emulation.

## Data ownership limit found in the code

The current `Party.balance` belongs to the TENANT's main book; `02 §5.1`
explicitly says per-user private ownership is not built. Owner and staff with
main-book grants can see the same Udhaar money. This screen does not imply
personal-only privacy; the subtitle says "this book". The earlier user goal of
an independent book per staff member needs separate model/access/API work and
is not fulfilled by this presentation piece. Do not certify whole-Udhaar
function/privacy above8.5 from this screen. Present an approved proposal before
any ownership migration; keep the app/book/tenant fences working meanwhile.

## Owner reference applied (R-DEC-36–40)

The owner's KhataBook screenshots and later feedback supersede the original
04 composition. Phone: no page title or overflow action menu; Search + Filters;
To get/To give summary; joined avatar/name/amount rows with a right chevron;
one worded floating Add person action. Balance choices live in Filters.
Desktop: Person/Balance table with fixed visible pagination and internal rows.
Quick Add reuses PartyFormDrawer: name, amount, Gave money/Got money, optional
mobile. The existing PhoneContactButton is visible when its feature detection
supports the browser; it fills name/mobile without saving. Save opens the
person's khata only after server success. The existing opening balance service
still posts the amount; no duplicate entry or money engine was added.

## Regression evidence and honest gate history

- BP-20 backend fail-before test was red before the filter, then 3 passed.
  Full parties API group passed (local test database; six Django deprecations).
- Frontend regressions cover Due/All/hidden server filters, URL defaults,
  scroll append, empty Due escape, a Shop-to-Udhaar stale-row flash, invalid
  Shop Due URLs, row navigation, quick Add validation, and no navigation before
  the save reply. The stale-row check failed before the scope fence.
- Current quiet full frontend run: **437 suites / 4,848 tests passed** in
  231.373s. The earlier run had 436 suites green and one billing timeout after
  1,419.91s; it is not relabelled green. The isolated billing suite passed
  44 tests in 13.442s without changing its timeout. Jest still reports existing
  asynchronous handles after completion.
- Changed-file lint, type-check, locale split/check, production build, bundle
  and 174 contrast pairs pass. Full cloud lint is not run; it exceeds 25min.
- All code is local; no Railway/production database or external message used.

## Browser evidence

Harness: `e2e/revamp-khata-people.mjs`, real seeded local QA
`revamp_20261018`, scale owner. English 390/320/1024/1280 light/dark and Hindi
320/1280 light/dark. 38 frames: ready, append, All, Filters; additionally phone
empty Due, error, long electrical-business name/₹12,40,378.00, and quick Add.
The contact API is simulated for that one browser test: name and mobile fill,
with no Save or messaging click. Physical OS contact permissions remain unproved.
Phone scroll appends 25→50 cards; desktop pagination stays visible. Measured
page overflow, own-box clipping and low-contrast labels are zero in these frames.
The phone card area is approximately66% after space is reserved for the worded
Add action; the arrow, compact avatar and no-title checks are measured.

Screenshots/contact sheets are preserved on this Mac at:
`/Users/akashkushwaha/Documents/Codex/2026-10-02/https-railway-com-project-386b1ca4-ae4a/artifacts/udhaar-people-2026-10-25/`.
The cloud-only `/mnt/project-files/` location is unavailable here. Every contact
sheet was inspected, as were native phone, quick Add and desktop frames. This
found the avatar below the name and cramped long-name wrapping that unit tests
missed; the shared opt-in compact layout corrects the former, and smaller
avatar/padding gives the name more width. Shop's layout mode stays unchanged.

## Navigation A/B (same machine, quiet old/new/old/new)

Baseline851ddc61c in `/tmp/yourkhata-udhaar-base-851`, hard-linked dependencies,
production build on3001; current build on3000. Same API and local seed. Three
reps per round, two rounds per build, six samples per cell. Two cases only:
app switch into Udhaar and People→Old dues. Raw JSON is in
`data/2026-10-25-udhaar-people/perf-*.json`. These numbers include old/new list
composition differences, not a controlled benchmark of the new DB predicate.

| View/profile | Case | Old content median ms | New content median ms |
|---|---|---:|---:|
| Phone unthrottled | Open Udhaar |83|80|
| Phone throttled | Open Udhaar |422|442|
| Desktop unthrottled | Open Udhaar |133|114.5|
| Desktop throttled | Open Udhaar |685.5|699.5|
| Phone unthrottled | Old dues |249.5|227|
| Phone throttled | Old dues |678|535|
| Desktop unthrottled | Old dues |261.5|241|
| Desktop throttled | Old dues |591.5|553.5|

Opening Udhaar has no consistent improvement; +20ms phone/+14ms desktop under
throttle is reported plainly. First-change medians for opening Udhaar are6ms
phone throttled and3.5ms desktop throttled; loading UI was observed. No claim
of better installed-PWA or rural-network performance from this small lab run.

## Scoped review (provisional, not merchant research)

| Point of view | Score | Evidence | Still weak | Confidence |
|---|---:|---|---|---|
| Function — phone |8.3|Server Due/All scope, append, quick Add and row navigation|BP-21 approved but not built; whole entry/reminder journeys not re-certified here|Medium|
| Function — desktop |8.3|Same queries; internal table/pagination; API groups|Shared role/private ownership gaps remain|Medium|
| Busy use — phone |8.6|Only avatar/name/amount, floating Add, name+amount fast path, contact prefill|Real keyboard/contact permission and merchant task time unproved|Medium|
| Busy use — desktop |8.6|Name/balance table and fixed page controls|No live busy-counter merchant study|Medium|
| UI/UX — phone |8.6|38 measured frames, simple labels, full names, Hindi|Very long names necessarily increase row height; OS text scaling not tested|Medium|
| UI/UX — desktop |8.6|1024/1280 table and filter views, zero overflow/cut/contrast failures|Shared shell wording is outside this piece|Medium|
| Performance — phone |8.2|Quiet matched A/B, 6ms first change,442ms throttled open|No opening-speed win; real PWA unproved|Medium-low|
| Performance — desktop |8.3|3.5ms first change,699.5ms throttled open|Small sample and no consistent opening improvement|Medium-low|

The owner's >8.5 in every aspect is **not achieved for the whole Udhaar
feature**. BP-21 comes next by explicit approval; independent per-user book
ownership requires separate work beyond BP-21. Do not present a surface rating
as a module certification or claim this beats KhataBook without comparable
merchant task measurements.

## Next

Commit/push this verified UI checkpoint after its final gates. Then implement
approved BP-21 as a separate verified piece. Follow with person khata/history,
entry actions/corrections/statement/Old dues/reminders and the remaining Udhaar
scope, then Lending and Library. Existing Udhaar journey scripts still require
an end-to-end rerun with the new entry labels; legacy selector wording was
updated, but those journeys are not marked green by this report.

## Final business-journey run, 25 Oct

The existing required journeys were run on local QA after updating selectors
for the approved Contact/Gave money/Got money words and allowing the installed
Chrome executable. The ledger journey passes54/54, statement24/24, credit19/19,
tags13/13, people30/30. The initial tags/people runs failed on old Add party /
Save party / This party wording; no business assertions were removed. The
write-off journey successfully posts the exact amount/reason and checks server
state; its first retry stopped at the old archived-contact wording, corrected
for the final run. Old dues52/54: all monetary/FIFO/history/tenant/access/CSV
checks passed; its inactive payable tab lacks the old expected amount caption,
and export accounting reports rejection at10 instead of the expected11 because
one browser export is not counted by the harness. The request matcher was
corrected for same-origin /api/v1 proxying, preserving endpoint checks.

`wave1-reminders-qa.mjs` is **red**: older reminder/tab/strip selectors and
Shop expense/cashbook composition assumptions fail on this checkout. It is
not certified by the new list's38 passing frames. The Shop application files
for those screens are unchanged by this checkpoint. No financial behavior or
limits were relaxed to green the scripts. Resolve these baseline harness vs
product disagreements in their owning pieces before a whole-module release.

Final long-name review: at320 the compact avatar uses28px and the full name
wraps at word boundaries beside ₹12,40,378.00 and the chevron; it is taller for
that unusually long name but never ellipsized. Delivery screenshots/JSON use
`shots-delivery-en` and `shots-delivery-hi`; previous intermediate folders are
kept for the fail-before audit. Shared row geometry changed slightly after the
A/B measurement; those numbers do not claim the final8px avatar/padding trim
improves speed.

Final write-off recheck:11/11 passed, including exact request amount/reason, zero server balance, archived state and a visible write-off timeline entry without reload. The previous timeout was the old “This party is archived” selector; current copy is “This contact is archived”.

## Integration with remote dev7a9de2c1e

Before push, origin/dev advanced from851ddc61c to7a9de2c1e. The Udhaar work
was committed as4000c136d, then remote dev was merged without dropping its
shared totals/skeleton/service-worker/security-header fixes or new business
type planning docs. Conflicts were limited to budget audit entries (both kept)
and the shared form mobile field (one reused field now keeps the supplier hint).
Post-merge: lint/types/locales pass; full439suites/4,856tests pass in232.594s;
production build, bundle and174contrast pairs pass. The combined tags first
load measured313.1KB; limit313.4 is measured+0.3, with a written reason.
Backend party and security-header groups pass. The A/B above predates this
integration and is not a performance certificate for the merged build.

Post-merge browser rerun: all38 measured EN/HI frames pass again, using
`shots-merged-en` / `shots-merged-hi`. Native final phone, contact-prefilled
quick Add and desktop frames were inspected. Their JSON replaces the prior
frame measurements in the committed data folder. Phone rows stay about66% of
the usable height with no page overflow, clipped text or low-contrast labels.
The final merged runtime does not have a new performance A/B; prior numbers
remain labelled as pre-integration evidence.

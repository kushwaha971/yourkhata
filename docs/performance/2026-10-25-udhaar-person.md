# Udhaar person overview and history ·25October2026

R-DEC-42 limits implementation to Udhaar/Library/Lending. Baseline9976dde58;
Shop behavior and endpoints stay as they are. BP-21 deferred by owner scope.
Reference:10-udhaar-book§1/2,12-shared-overlays; KhataBook owner screenshots
and R-DEC-36–40; committed shop-fixes-and-business-types.html A2/A5 and PartF.

| Requirement | Implementation | Verification |
|---|---|---|
| Full name and back to people | Existing header, wrap only for khata | Long name320/390/1024/1280, Back path |
| Single clear directional balance | Compact Udhaar overview using UbAmount/avatar/credit bar | Server figure; large money, zero, positive/negative |
| Reminder and statement one tap away | Existing reminder hook/sheet and statement route | Permission/settled/hidden states, editable text, no automatic send |
| History owns working space | Opt-in viewport composition and timeline scroll | Desktop/phone width/height, fixed reachable entry pair |
| Other details optional | Existing info panel/collection date/relations remain in Details | Read/edit/refetch unaffected; no extra Shop controls on khata |
| Shop unchanged | New composition only when app=khata | Existing Shop person tests + source diff guards |
| No financial changes | Existing ledger/statement/credit services | Business tests and real localQA entries |

Status: review complete; regression reproduction and implementation in progress.
No whole-module completion or competitor superiority is claimed.

## Regression checkpoint

The new tests reproduced two presentation defects before implementation:
reminders required opening More, and history had no bounded region. After the
Udhaar composition,117 person/timeline tests pass, including the existing Shop
person cases. The first after-run caught raw mobile copy (`098…`); normalized
copy now uses the same shared helper as the call link and its regression passes.
No backend source is changed; BP-21 is deferred under R-DEC-42. The new overview
and viewport layout are selected only for app=khata; the shared timeline's new
fillHeight prop defaults false, and UbPanel's optional tabIndex has no effect
on existing callers. Full suite/build/browser evidence is pending below.

Owner follow-ups R-DEC-43/44: shell search removed from Udhaar’s manifest;
Library/Lending already omit it. Shop search is preserved. The person’s
Report/Remind/Call actions now use an icon with a short label and no outlined
button box. The existing reminder status moves beside secondary details.
First browser review caught clipped source numbers, a narrow history heading,
light-theme entry-button contrast and desktop overflow from absolutely
positioned screen-reader text. Scoped wrapping, theme-aware button ink and a
relative scroll panel fix these; the subsequent EN24frames and HI8frames were
all measured green before the final owner-requested icon-row change. The final
icon row needs a fresh build/browser check; do not reuse those frames as its
final evidence.

## Final scoped implementation

Udhaar only (`app === khata`): full wrapping name, Back to people, a compact
phone/amount/date card without Shop customer/supplier badges, visible icon
Report/Remind/Call actions, internal entry-history scroll and the existing
Gave money/Got money dock. The phone reminder status is inside Details.
Existing credit meter, collection date, detail fields, edit/opening/correction/
reverse/statement services and permission guards remain. The mobile-number
copy regression is fixed using toDialableNumber. The source-link wrapping and
heading changes are opt-in only when Udhaar passes fillHeight=true. Shop has
no feature implementation changes. UbPanel adds an optional keyboard tabIndex;
existing callers keep their original behavior. Udhaar shell.partySearch=false
by omission; Library/Lending already omit shell searches. No backend changes.

Final layout: English390/320/1024/1280 light/dark, Hindi320/1280 light/dark;
ready, editable reminder (English), long electrical-business name and
₹12,40,378.00.32 measured frames. Final phone action icons are aligned and
header global-search fields absent; page overflow, own-box clipping and
low-contrast labels are zero. No WhatsApp/SMS/Call link is followed in this
review. Real OS dialer/contact permissions are not proven. The seeded QA
person has49 entries, and bounded history retains existing paging/load-more.

Gates: earlier full439suites/4,858tests passed; final changed-file lint, types,
locale split/check, production build, bundle and contrast pass. Final person+
navigation106tests pass after R-DEC-43/44. The final full-suite rerun and real
ledger journey results are recorded below when complete. Full cloud lint is
not run because the documented run exceeds25minutes. Existing Jest async-handle
warnings remain; do not call them a production defect without reproduction.

Bundle: shared person route117.3KB gz /359.1KB first load; overview is dynamic,
but opt-in workspace composition adds2.2KB. Budget is measured+0.3 with a reason.
No package, financial calculation, request/response or model changes.

## Quiet navigation A/B

Baseline9976dde58 in a temporary git worktree, hard-linked node_modules,
production build on3001; final build3000; same localQA API. Only khata.person,
3reps per round, old/new/old/new,6samples per view/profile. No other tests,
builds or browser runs competed. Raw files are in data/2026-10-25-udhaar-person.

| View/profile | Old content median ms | New content median ms | First-change new ms |
|---|---:|---:|---:|
| Phone unthrottled |120|113.5|3|
| Phone throttled |687|618|5|
| Desktop unthrottled |116.5|100.5|1|
| Desktop throttled |796|916|2.5|

No timeouts. The throttled desktop regression is120ms and remains unresolved;
no whole-performance improvement or physical-phone/PWA claim is made. The
small sample does not prove merchant task-time gains.

## Provisional review of this piece

| Point of view | Score | Evidence | Still weak | Confidence |
|---|---:|---|---|---|
| Function phone |8.6|Existing entry/correction/credit/reminder guards and direct composer tests|Whole Udhaar/independent-user ownership not certified|Medium|
| Function desktop |8.6|Same API and existing Shop guard tests remain|Unrelated BP-21 deferred by owner|Medium|
| Busy use phone |8.6|Report/Remind/Call visible; pair docked; history internally scrolls|Real keyboard and user task-time untested|Medium|
| Busy use desktop |8.6|Keyboard-focusable history, readable full name, visible actions|No merchant study|Medium|
| UI/UX phone |8.6|Measured320/390 light/dark, Hindi, full words, icon row|Very long names reduce visible history|Medium|
| UI/UX desktop |8.6|1024/1280 two-column composition; zero page overflow|Long details require their own scroll|Medium|
| Performance phone |8.6|Matched throttled687→618ms,5ms initial feedback|Lab only,n=6|Medium-low|
| Performance desktop |7.9|Matched796→916ms throttle;2.5ms feedback|120ms regression unresolved|Medium-low|

This is a scoped checkpoint; the owner's>8.5every-aspect goal is not yet met.
Do not claim competitor superiority or whole-module completion. Next stays
Udhaar overlays/person history refinements, then remaining Udhaar, Lending and
Library. BP-21 remains deferred; do not implement Shop work in this thread.

## Superseding personal-book scope (R-DEC-45)

The owner clarified after the earlier draft: this is a general personal book
between friends/people. The earlier business-profile details, opening-amount
Add and all draft ratings above are superseded. The new PersonalUdhaarPage is
a separate composition selected only for app=khata; the existing shared page
and its regression tests are retained for Shop/other apps. New contact writes
contain only name/mobile, and edits reuse updatePartyIdentity. Contact picking
still fills both. Contact Add no longer records money or requires an amount.
Personal entry shows Gave/Got, amount and optional note only; its business date
is supplied automatically in the existing tenant timezone. A new explicit
simple flag on the main manual-entry API permits an unspecified receipt
method; it is stored NULL, never invented as Cash. Invalid supplied methods
are still rejected. Existing balance/idempotency/tenant/archive/credit safety
checks remain, and the complete ledger backend suite passes. No shared tables
or saved historical entries are deleted. BP-21 remains deferred by no-Shop scope.
The official Khatabook help supports name/optional phone/contact picking,
followed by a separate amount entry; live app/artifact parity remains unproved.
Sources: https://khatabook.com/help/en-us/category/X1IofBAAACQAT1tS/ and
https://khatabook.com/help/en-us/category/X1iHfRAAACQAa4db/ .
Focused personal forms/page + preserved shared-page tests116pass; new backend
simple/legacy method validation3pass and full ledger group passes. The prior
business-profile full-suite/browser/perf evidence must not be called final
verification of this new implementation. Re-run final gates and pictures.

Latest owner styling R-DEC-46: Gave money remains red; Got money is primary
brand marigold. All four secondary actions use one regular font/size/ink and
20px icons; WhatsApp uses its phone-in-bubble mark. The personal composer is
focused on the selected WhatsApp or SMS channel, with editable default text
and one matching action. Copy/More/Call remain available in other callers'
shared sheet, unchanged by default. The browser harness now compares computed
label size/weight/color across all four actions, icon alignment and the mark;
reminder/form overlays are measured against their own surface, not just main.

FINAL STATUS: superseded by 2026-10-25-personal-udhaar-core.md. Use that report's
final personal-only requirements,70frames,21real-flow checks and new A/B. This
file is retained as the design/research/failure history of the abandoned
business-profile prototype; its intermediate ratings are not current.

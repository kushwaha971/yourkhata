LATEST CORRECTION —25 October 2026, R-DEC-48/49
Personal Udhaar now uses /personal/ APIs and one server-owned PersonalBook per
logged-in user, independent of the selected business. No business memberships
exist for its private storage scope. Do not revert to the legacy business-main
contact list. Old shared records are preserved; never infer personal ownership
from a phone number or who entered a business entry. Additive migration0013.
Two green/red balance cards; no people-count strip or trailing count; one local
Back arrow beside the person name. Verification/report:
docs/performance/2026-10-25-private-udhaar-fix.md. Finish this checkpoint, then
continue approved personal report/correction work, Lending and Library.

Continue the existing YourKhata revamp on dev. Do not start a new plan.

CURRENT CHECKPOINT —25October2026, R-DEC-35 through R-DEC-46
Owner scope: UDHAAR, then LENDING, then LIBRARY. Do not implement Shop work.
The owner rejected the business-style Udhaar profile: this is a simple personal
money book between friends/people. Latest decisions supersede older mockups.
Repository on this Mac: /Users/akashkushwaha/Projects/ims-platform. Elsewhere
locate the existing checkout. Inspect status/branch/log first; safely update dev.
Preserve unrelated work, especially untracked nested ims-platform/. Never reset,
force-push or blindly stage it. Commit verified pieces todev and verify remoteSHA.

READ FIRST
AGENTS.md → CLAUDE.md → docs/revamp/README.md →12-decision-log.md →
02-preserve-and-contracts.md → the relevant07-screens spec → real code.
Also docs/DESIGN-SYSTEM.md and design/counter-mode.html before UI.
Canonical latest evidence: docs/performance/2026-10-25-personal-udhaar-core.md.
Older2026-10-25-udhaar-person.md is superseded prototype/failure history.

DELIVERED PERSONAL CORE
- People: All active default so a new zero-balance person stays visible. One
  search+Filters, avatar/full name/directional amount/chevron joined phone rows,
  append on scroll with retry and manual fallback, floating Add. Desktop has
  fill-height table/internal row scroll and visible pagination.
- Personal filters only balance/status/sort. No business role/tag/credit/date
  axes. Existing compatible Due API remains available, not the default.
- Add/Edit: NAME and OPTIONAL MOBILE ONLY; shared phone-contact picker fills
  both when supported. Create wire has exactly name/mobile; edit uses existing
  updatePartyIdentity. No opening amount, email/address/GST/credit/terms fields.
- Person: separate lazy PersonalUdhaarPage selected only for app=khata; identity,
  balance, dated history, Report/WhatsApp/SMS/Call. No Details/business profile,
  credit meter, cumulative tiles or correction switch in personal toolbar.
- Entry: Gave/Got + amount + OPTIONAL NOTE. Date automatic in existing timezone.
  No payment method/date/reference controls. Explicit simple=true main manual
  entry permits unknown receipt method stored NULL, never invented Cash.
  Invalid supplied methods still fail. Other callers keep legacy validation.
- Gave money stays RED; Got money uses the SIDEBAR DARK TEAL with WHITE text
  (R-DEC-49, latest owner instruction). Four secondary actions have20pxicons and the
  same14px/400/accent ink; WhatsApp uses its actual phone-in-chat mark.
- WhatsApp/SMS each open one focused editable composer. Sending requires user
  action; no auto-send. Existing shared-sheet behavior is unchanged by default.
- No global search in Udhaar/Library/Lending; each screen owns its search.
  Personal app menu keeps People, not Old dues/bulk collection rounds. Legacy
  routes remain for compatibility; shared engines/data are not deleted.
- Existing shared person renderer and all its regression tests are preserved
  for Shop/other apps. No Shop feature/API/model or live Library/Lending change.

FINAL EVIDENCE
Frontend440suites/4,865tests pass. Backend ledger+contracts443pass,4skipped.
Changed-file lint,types,locale split/check,production build,bundle,174contrast
pairs pass.70final measured EN/HIframes;21real localQAchecks pass: name/mobile
only wire,500given−200received=300balance,empty note,3fast Save taps→1POST,
exactly2entries,editable WhatsApp/SMS and edited SMSURI. No external sends/calls.
Actual OS contacts are simulated in prefill browser check. Screenshots in task
artifacts/personal-udhaar-core-2026-10-25/. Raw data in docs/performance/data/.
Quiet9976dde58 old/new/old/new person nav,n=6: phone throttle633→426ms,
desktop920.5→428ms; unthrottled107→75 and420.5→65.5. Lab-only,not PWA proof.
Core provisional self-scores8.6–8.8; not a whole-module/privacy/competitor claim.

NEXT
Verify remaining personal report/print and correction/recovery overlays against
this minimal scope; do not reintroduce business fields. Then remaining Udhaar
work, then Lending/Library, one feature fully finished before the next. No
routine next-screen permission question. R-DEC-48 supersedes the BP-21 deferral for personal ownership: authenticated
user-owned /personal/ APIs are implemented. Legacy business main-book records
remain tenant-scoped and are retained without guessed ownership. Never route
personal UI back to those business APIs or automatically migrate their money.

REFERENCE
Owner supplied https://claude.ai/artifact/RsYjPpq2t3zCTMu5iUSvNm#gf and#d12.
Live artifact was inaccessible; browser use disabled. Exact committed copy is
design/shop-fixes-and-business-types.html (identity confirmed by its notes).
Committed#d12 is a SHOP dashboard,not evidence of a new personal Udhaar view.
Use owner KhataBook screenshots + explicit minimal scope as acceptance, and
reuse relevant A2/A5/PartF visual patterns. Official Khatabook help was reviewed
for contact→separate entry and individual reminders; no live-app parity claim.

HARD RULES
- Library/Lending L-01 live contracts frozen: presentation only; endpoint/body/
  model/calculation/workflow ideas go to08 as proposals, await owner approval.
- Separate app/book/tenant/role money; never net balances or infer access/linking
  from phone numbers. No Railway/production data; local seededQA only.
- Posted entries are not edited/deleted: corrections use reversal+new entry and
  required audit reason. Main opening posts once; authorization, atomic balance
  updates and Idempotency-Key behavior remain. Notes always optional.
- Every default outgoing message editable; no product/domain on anything a
  merchant's recipient receives. Say WhatsApp opened,not sent. No credentials.
- Existing logo,teal#0E7C86,primary#F59E1B/dark ink,white page,dark-teal rail,
  Jakarta/Mukta. Reuse src/design-system; no raw feature host JSX,new package
  without ADR,duplicate engines or TanStackQuery. Redux Toolkit.
- Forms/sheets/dialogs dynamic in their opener's chunk. Bundle ceilings only
  measured+0.3 with reason. No ellipsis/word cuts;44pxtargets,32pxchipfaces.
- Use simple English/spokenHindi. Udhaar Gave money/Got money; Lending Lent/
  Collected,Running/Late; Library Fee/Paid/Student. Electrical examples and
  Radhe Krishna Enterprises, with friend names where the personal flow needs it.

QUALITY LOOP —REVIEW,BUILD,LOOK,REPORT (R-DEC-07/32/34)
Map spec/reference dimensions/states/interactions to actual code before edits.
Add meaningful fail-before regressions. Finish each screen/overlay group:
1. Changed-file npx eslint --fix --max-warnings=0; npm run type-check; full
   npx jest; then build (never run jest/build concurrently: temporary probe).
   NEXT_PUBLIC_API_BASE_URL=/api/v1 API_PROXY_TARGET=http://127.0.0.1:8000
   NEXT_PUBLIC_SW_ENABLED=false NEXT_PUBLIC_ANALYTICS_ENABLED=false npm run build
   Run bundle:check,check:contrast; i18n:split/i18n:check for locale changes.
   Full cloud lint exceeds25min; report changed-file lint. Never hide red runs.
2. Restart task-owned frontend after every build; copy static/public as e2e/
   serve.sh does. ConsoleOTP API; seeded localQA only. Don't kill others' jobs.
3. Real merchant/browser journey and server results: empty/loading/error/offline/
   permission,long name,large money,repeat taps,recovery and access contexts.
4. Shoot390/320/1024/1280 light/dark +Hindi320/1280,relevant states; LOOK at every
   contact sheet/native frame. Measure each label's computed contrast≥4.5,
   own-box text fit/pagewidth,hit areas and actual scroll/pagination behavior.
   Prove new defect checks fail before relying on them.
5. Quiet matched old/new/old/new e2e/perf-app.mjs --reps=3 --only=nav with
   relevant cases. Baseline worktree dependencies cp-al,not symlink. No tests/
   builds/browser competition. No speed claim from row height or old container.
6. Appropriate backend and existing modulee2e; frozen contract checks02/11.
7. Dated report,07tracking,11matrix,12Progress/Next,both prompts. Scoped table:
   Point of view|Score|Evidence|Still weak|Confidence for Function/Busy use/UIUX/
   Performance on phone AND desktop. Owner target>8.5each; never round/inflate.
8. Commit proseWHY + Assisted-by: OpenAI Codex, pushdev,verify remoteSHA and
   report screenshots/numbers/limits before next. No routine permission pauses.

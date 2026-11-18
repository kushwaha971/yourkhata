# Personal Udhaar core — 25 October 2026

This is the final report for the owner's R-DEC-45/46 scope. Earlier drafts in
2026-10-25-udhaar-person.md and their ratings are superseded by this report.
Baseline:9976dde58. No Shop feature implementation, no Library/Lending API or
financial-workflow change. Existing records and shared engines are preserved.

## What is delivered

- Add/Edit person: name and optional mobile only; shared phone-contact picker
  fills both when supported. The outgoing create body has exactly name/mobile;
  edits reuse the existing identity-only service. No opening amount, email,
  address, GST, credit terms or business profile is collected or displayed.
- People default to All active, so a newly added zero-balance person remains
  visible. Search/Filters only, joined avatar/name/amount/chevron phone rows,
  scroll append with retry, and a floating Add person. Desktop uses bounded
  rows with visible pagination. Personal filters omit business/type/tag/credit
  axes. Existing compatible Due API reads remain supported, not default.
- A separate PersonalUdhaarPage is selected only for the khata app. It has the
  identity/current balance, dated entry history and Report/WhatsApp/SMS/Call.
  No Details panel, cumulative business tiles or personal collection menus.
  The existing shared renderer and its regression suite remain for other apps.
- Entry: Gave/Got, amount, optional note. Business date is supplied from the
  existing timezone-aware Today default. No payment-mode/date/reference form.
  Main manual-entry API accepts an optional simple=true flag; unknown receipt
  method is NULL, never silently Cash. Other callers retain strict legacy
  method validation. Corrections retain a personal receipt's unknown method.
- Gave money stays red; Got money uses primary marigold. All four secondary
  labels compute to14px/weight400/the same accent ink. Icons are20px and aligned;
  WhatsApp uses its phone-in-chat mark. Each reminder opens an editable composer
  for the selected channel only; the primary handoff uses the edited text.
  Default shared-sheet behavior is unchanged unless this caller opts in.
- Individual entry/correction/audit/tenant/permission/idempotency safety stays
  in the existing engines. Removing UI clutter does not delete stored money.

## Requirement and regression evidence

| Owner requirement | Check and result |
|---|---|
| Name/mobile only | Unit tests and real POST inspect the exact wire keys; Add/Edit contain no amount/GST controls |
| Note optional | Personal received entry saves with empty note and no mode; backend result has NULL mode and correct main balance |
| No hidden business questions | Simple drawer has no date/method/reference; new personal page tests reject Details/GST/email/credit fields |
| Saved money correct | Real QA: Gave500, Got200, server balance300, exactly2history rows |
| No duplicate save | Three rapid programmatic Save clicks held in-flight produce exactly1POST per entry |
| Editable reminders | Real WhatsApp and SMS text edited; SMS handoff URI contains the edited words; no external send/call |
| Uniform actions | Computed size/weight/color match across4actions in all final frames; WhatsApp mark and icon alignment measured |
| Phone/desktop readability |70final EN/HI frames, zero page-width overflow, own-box cut or low-contrast labels; overlays measured on their own surface |
| Other apps preserved | Existing shared-page and shared-sheet tests retained; full frontend and ledger/contracts green; no Shop/Library/Lending feature paths changed |

Earlier red runs are retained in /tmp logs: the former Add demanded an amount;
the first person prototype hid useful actions, clipped source numbers and had
light-button contrast defects. Those prototypes are not the delivery screen.
A navigation fixture initially inspected Library because it omitted the khata
app; it now explicitly enables/chooses Udhaar and asserts the active app.
These failures were corrected, not relabelled green.

## Final gates

- Changed-file ESLint --fix --max-warnings=0: pass. Full cloud lint is omitted
  under the standing documented >25minute limit.
- Type check, locale split/check, standard production build, bundle check and
  contrast check: pass. Contrast gate checks174pairings.
- Frontend:440suites /4,865tests pass in227.642s. Existing Jest async-handle
  warning remains after successful completion.
- Backend: complete ledger suite plus tests/contracts:443passed,4skipped;
  existing Django converter deprecation warnings. No model/migration change.
- Local browser business journey:21checks pass. Seeded localQA only, console
  OTP. No Railway/production data or external messages were touched.
- Final visual checks:32person frames +38list frames =70. English390/320/1024/
  1280 light/dark; Hindi320/1280 light/dark. Ready, long name/₹12,40,378.00,
  editable composer; list append, filters, empty, error and contact-prefilled
  Add. Contact API is simulated for the prefill case, not a physical OS proof.
  All six contact sheets and native real-flow/entry/reminder images were LOOKed at.

Final shared person route116.9KB gz /358.8KB first load; budget117.2/359.1
is measured+0.3 with a written reason. Shared baseline241.9KB. Earlier
prototype bytes/ceilings are superseded.

## Quiet old/new/old/new navigation

The unchanged9976dde58 baseline was built in a temporary worktree with hard-
linked node_modules and served on3001; final build on3000. Same seeded API.
Only khata.person,3reps per round,6samples per cell. No tests/builds/other browser
runs competed. Raw data: data/2026-10-25-personal-udhaar-core/perf-*.json.

| View/profile | Old content median ms | New median ms | New first-change ms |
|---|---:|---:|---:|
| Phone unthrottled |107|75|3|
| Phone4xCPU/network throttle |633|426|5|
| Desktop unthrottled |420.5|65.5|1|
| Desktop throttled |920.5|428|2|

Zero timeouts. This is matched laboratory evidence, not installed-PWA or rural
network/merchant task-time proof. Small samples, prefetch/cache and baseline
variance limit any speed-superiority claim.

## Scoped provisional review

| Point of view | Score | Evidence | Still weak | Confidence |
|---|---:|---|---|---|
| Function phone |8.7|Real21check write/balance/notes/reminder journey and backend443pass|Not a whole-module/privacy certificate|Medium|
| Function desktop |8.7|Same financial services, full tests, desktop frames|Real desktop merchant study absent|Medium|
| Busy use phone |8.8|Name/mobile and amount/note fast paths;21check triple-tap protection|Physical keyboard/contact picker unproved|Medium|
| Busy use desktop |8.7|Visible entry pair, bounded keyboard-focusable history|No measured merchant task times|Medium|
| UI/UX phone |8.8|70frame sweep, uniform computed actions, Hindi320, optional note|OS text scaling/TalkBack not tested|Medium|
| UI/UX desktop |8.7|1024/1280 normal/large-money/long-name views, internal scroll|Long-person labels can add header height|Medium|
| Performance phone |8.6|Matched633→426ms throttle and5ms feedback|n=6lab, physical PWA absent|Medium-low|
| Performance desktop |8.6|Matched920.5→428ms throttle and2ms feedback|Baseline variance; no independent device study|Medium-low|

These are self-assessments of the personal core, not proof of beating KhataBook.
Official-help research confirms contact→separate Gave/Got entry and individual
WhatsApp/SMS reminders; it is not inspection of their current installed app:
https://khatabook.com/help/en-us/category/X1IofBAAACQAT1tS/ and
https://khatabook.com/help/en-us/category/X1iHfRAAACQAa4db/ and
https://khatabook.com/help/en-us/category/X1icohAAAC1Ka-eR/ .
The live artifact could not be opened; committed #d12 is a Shop dashboard.
Owner screenshots/explicit requirements, not an invented live artifact view,
govern this personal composition.

## Limits and next

The existing main book is tenant-scoped, not independently private per staff
member. BP-21 cross-app membership is deferred by the no-Shop rule; matching
phone numbers still do not grant another user's access or net balances. The
new UI is not a claim that these older architectural goals are resolved.
Legacy collection/credit endpoints remain for compatibility and shared users;
their personal menu/profile exposure is removed. Personal writes still retain
existing financial safety checks for any older configured credit cap.
Review the remaining personal report/print and correction/recovery surfaces
against this minimal scope before calling all of Udhaar complete. Then continue
Lending and Library presentation under L-01, without changing Shop or deleting
shared models/records. Preserve optional notes and editable outgoing text.

Screenshots:
/Users/akashkushwaha/Documents/Codex/2026-10-02/https-railway-com-project-386b1ca4-ae4a/artifacts/personal-udhaar-core-2026-10-25/

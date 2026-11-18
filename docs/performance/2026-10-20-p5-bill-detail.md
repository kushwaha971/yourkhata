# Bill detail · Counter Mode

20 October 2026. R-DEC-16/25. Implemented and verified; delivered on dev. This is the document reading/
actions surface, not certification of the invoice/POS editor or all Shop flows.

## Review and implementation

The actual prior phone screen rendered the paper invoice inside an overflow
region, with the payment launcher hidden in More. The approved screen spec 09
calls for one Total/Paid/Due summary, visible Receive/Share, readable phone lines,
payment history, linked documents and a paper preview beside a 360 px rail on
wide desktops. The committed Counter Mode reference supplies the mistake/return
chooser and editable message behavior; it does not contain a full bill-detail
mockup. Do not claim pixel parity with an unavailable live Claude artifact.

The detail now uses the existing header, panel, money, info rows, action sheet,
payment drawer and share composer. At 1280 px the paper is on the left and the
360 px summary/actions rail on the right. Below 1280, the summary is followed
by native, wrapping item lines and stored tax totals; paper is an explicit
"See as printed" dialog. No new dependency or grid implementation. Phone More
is one compact icon with its full accessible name. A4 and 80 mm choices remain
visible, preserving the existing printing capabilities rather than inventing
a Settings paper preference that the code does not currently expose here.

Stored subtotal/discount/tax/round-off rows are extracted from the existing A4
model and reused by the reading view. Credits remain separate from cash paid.
No client tax, stock, balance, posting or historical pricing calculations change.
The bill's frozen party name leads the detail. Cost/profit stays internal and
print-hidden; the cost card loads only for a role allowed to see it. Long internal
profit-line descriptions now wrap rather than silently truncate.

Drafts no longer offer customer print/share actions. Receive opens the existing
page-owned drawer for this bill first. Sharing still mints/reuses the link before
opening the editable composer; no external message is sent by the audit. Offline
Receive/Share/More are disabled; the existing network strip supplies the reason.

More on invoices asks what happened: mistake vs goods returned, with explanatory
captions. Cancellation re-reads the current document before mounting the existing
reason/consequence dialog. The final write still enforces the server's rules.
The action component remains mounted when the menu closes so its lazy reason
form survives. Returns retain the existing permission-gated credit-note route.
Refund text explicitly does not promise that cancellation sends money back.
Cross-role settlement and a new direct advance-refund action are not implemented
from an unverified balance. Those proposal/flow dependencies remain separate;
no combined supplier/customer/Udhaar amount is introduced.

## Fail-before evidence

- The old phone had no native items table or separate Due definition; the new
  detail regression failed on it. Draft Print actions also failed their guard.
- The measured old build lacked native lines and had two A4 footer labels at
  4.42:1. The footer now uses darker print ink; only the expressly decorative,
  aria-hidden watermark (whose status is repeated in real labels/banners) is
  excluded by the browser text-label measurement. The old footer still fails.
- Removing the fresh read from the new cancellation launcher makes the focused
  regression fail. The restored implementation passes.

## Bundle discipline

Detail-specific copy is isolated in the existing catalogue architecture, rather
than charging the editor/list/public document for extra menu words. The broad
sales namespace uses dynamic translation prefixes elsewhere, so the new words
use billDetail.*, not a sub-prefix that would make those unrelated chunks load
the detail catalogue. Locale checks must prove every consumer loads its words.
Profit is lazy and role-gated. Budget decisions and final measured bytes follow.

## Acceptance and limits

Final production build, bundle gate, English/Hindi state sweep, printed
media checks, contact-sheet review and quiet navigation run pass. Earlier Home
or Bills checks were not used as a substitute for this acceptance. Physical devices,
large OS text, assistive technology and merchant task research remain unproven.
After the owner-requested Home metadata/workflow follow-up, return to the
invoice/POS editor, issuing, discounts, tax/rounding, returns, payment/refund and
stock/ledger verification, not another list polish.


## Final acceptance · 20 Oct 2026

- Full frontend: **406 suites /4,541 tests pass**,89.266 s. A test-only query
  typing cleanup has the same14 affected payment tests passing afterward.
  Existing Jest worker/timer teardown warnings remain; they are not hidden as
  a clean-warning run. Changed-file ESLint --fix --max-warnings=0 and TypeScript
  pass. Full cloud lint can exceed25 minutes; the gate is changed-file lint.
- Production build passes, then the standalone frontend is restarted with
  copied public/static assets. macOS runs the task-owned servers only; QA DB
  revamp_20261018 is explicitly on localhost, messaging uses console. Nothing
  is deployed to Railway or written to a production database by this audit.
- **230 measured screenshots**, all opened in15 contact sheets plus native
  representative views:148 English/Hindi layout frames (320/390/1024/1280,
  light/dark; Hindi320/1280),60 current-cancellation/invalid-reason/print frames,
  and22 real payment review/busy/saved/refreshed frames. Repeated ready views
  are counted as frames, not invented distinct cases. Zero measured clipping,
  page overflow or computed text-label contrast failures. A4 print uses a794 px
  paper viewport, thermal303 px, not the phone screen's viewport; saved origin
  widths remain in the JSON. Decorative watermarks repeat accessible status.
- Four **₹1 local QA receipts** total: ordinary phone/desktop saves and delayed
  rapid-double-submit phone/desktop saves. Each has exactly one POST, Shop
  bucket/in direction, a₹1 allocation to the selected invoice and a₹1 decline
  in the source bill due (220→219→218→217→216). Receipt/history and summary
  refresh are photographed. The delayed runs show actual saving feedback.
- Editable share text survives into the WhatsApp URL; no channel was opened
  or message sent. Printed-media checks show neither internal costs/profit nor
  the product/domain. Existing customer-document tests also pass. The printed
  amount/tax/credit rows reuse the stored document model. Synthetic long-name/
  large-number frames are layout stress, not a substitute for arithmetic tests.
-174 static contrast pairs pass.6593 en/hi keys in56 disjoint catalogues are
  loaded by every consumer. New detail copy stays off unrelated sales/public
  routes. Framework127.3 KB and shared app113.7 KB ceilings are unchanged.

### Additional defects found by looking

The1024 px paper dialog inherited the primitive's420 px width and cut fields;
its responsive width is now explicit and the measured failing case passes.
Changing the invoice ID used to retain the previous payment drawer context;
a regression fails before the keyed detail boundary and passes after it.
Receive initially still selected the legacy payment layout; the context now
explicitly says Shop/customer while keeping this bill first. The server-loaded
allocation rows also made an untouched Shop payment appear dirty on close. A
fail-before test protects their default-value baseline while preserving real
edits/discard warnings. This correction runs only for Shop counter presentation;
other apps' payment paths retain their behavior. All14 payment drawer tests pass.

### Bundle and timing

Invoice detail and its shared siblings are82.7 KB route /323.7 KB first load.
The first eager/copy build was83.8 KB; isolated copy and lazy permitted profit
remove that waste. Relative to the prior detail ceilings, the new reading view
costs about0.5–0.7 KB against the old route/first-load ceilings. Only eight exceeded detail scalars are raised to the measured
+0.5 rule, with the reason in bundle-budgets.json. No shared/framework, editor,
list or public-document budget increase. Every bundle passes.

12 quiet navigation samples, three repetitions of Bills row→detail per width/
profile. First change is feedback, not completed content:

| Width/profile | First change p50/p95 ms | Content p50/p95 ms | Loading |
|---|---:|---:|---:|
|390 unthrottled|3/4|420/432|3/3|
|390 throttled|5/6|884/1218|3/3|
|1280 unthrottled|1/1|423/437|3/3|
|1280 throttled|2/3|845/1176|3/3|

Maximum measured interaction48 ms. F4's broad, different navigation cohort was
91/168 ms first-change p50/p95; the17-Oct broad baseline363/819 ms. This newly
instrumented detail case has no same-parent before run: **no speed gain is
attributed to the redesign**. Browser lab timing is not installed-PWA/device
certification. Source JSON is docs/performance/data/2026-10-20-bill-detail-*.json.

### Provisional assessment and remaining scope

Reading/detail UI self-review **8.7/10**; the exercised reading/payment/share/
print journeys **8.7/10**. These are scoped engineering/design reviews, not
independent merchant research or a whole-Shop/invoice-editor score. The source
artifact does not provide a complete detail mockup;09 supplies this composition.
Actions remain in the right summary rail on desktop. Two paper choices are
visible rather than claiming an unimplemented saved paper preference. The
existing shared reason form focuses its reason field; safe-choice initial
focus from the draft screen spec is not claimed. Direct advance refund,
cross-role settlement, recovered/issued editor and returns/stock/accounting
journeys remain separate work. No Library/Lending or backend model/API change.

Artifacts: /Users/akashkushwaha/Documents/Codex/2026-10-02/https-railway-com-project-386b1ca4-ae4a/artifacts/shop-bill-detail-2026-10-20/.

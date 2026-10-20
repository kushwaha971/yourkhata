# Purchase editor completion — §7 steps 2–6

20 October 2026, dev. Continue R-DEC-27/29 from93c6d3fe. Scope: the remaining
approved purchase editor composition and business states, one verified commit
per piece. No new plan, no Home work or Library/Lending contract change.
Final whole-editor score waits for all pieces and end-to-end acceptance.

## Step 2 — the finishing dock

Review: the reference keeps the total, number of item lines, included GST and
save status beside Save draft/Record. UbTotalDock already owns caption/meta;
reuse those slots, sum existing engine tax totals with sumMoney, and render the
status once (dock below1536, header above). No financial calculation is copied.
Record remains the existing marigold primary action. Item count counts named
lines, not the sum of quantities. Zero-GST captions do not claim included GST.

Fail-before: the new PurchaseBillEditor regression fails on missing
`total-dock-caption`; after implementation it checks 2 items/GST₹139.10 and
exactly one server-save status in the dock. Full frontend:412 suites/4,597 tests
pass in121.745s, with the worker teardown warning still recorded, not hidden.
Changed-file ESLint --fix/max-warnings0, type check, locale split/check, standard
production build, bundle and174 contrast pairs pass. No budget increase.
Full cloud lint takes over25min; changed-file lint is the required gate here.

Live local QA:120 frames (80en/40hi),390/320/1024/1280, both themes, Hindi320/1280.
Body, actual dock, open option surfaces, numeric input widths and label colours
measured. Zero overflow/cuts/low-contrast labels/page errors. Delaying the actual
PATCH proves Saving is beside Record until the server responds, then Saved.
Real edited Qty7 is read back from the server; item defaults remain unchanged;
run-created drafts deleted. Six contact sheets plus native320 Hindi saved and
1280 dark saving frames inspected. Artifacts: chat workspace
`artifacts/purchase-dock-2026-10-20/`; reproducible with
`e2e/revamp-purchase-quick-add.mjs --piece=purchase-dock` (add --locale=hi
--widths=320,1280 for Hindi). Data: data/2026-10-20-purchase-editor/.

Navigation reps3 completed:24/24 cases, phone/desktop and both profiles on the
otherwise idle live stack. Throttled content medians are[(390, 521), (1280, 838)]ms; no speed improvement claim. The untouched93c6
worktree is built for the final fresh old/new/old/new comparison. F4/17Oct
baselines remain historical controls, not substitutes for same-Mac comparison.

Still pending: honest current-input save status and leave warning (step3), cost
update wording (step4),403 payment-refusal recovery (step5), supplier summary
verification (step6), then whole-editor functional/merchant/visual/performance
rescore. This dock delivery does not certify those remaining workflows.

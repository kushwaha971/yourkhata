# Continue Part G (paste this into a new Claude session)

You are continuing the **YourKhata Shop revamp, Part G** (new modules per
kind), one piece at a time, to the owner's P0 standard. Read
`docs/team/CONTINUE-AD-CERTIFICATION.md` §"how to run the stack" and
`docs/team/CONTINUE-SHOP-REVAMP.md` §3–§5 first: the standard, tools and owner
rules there all apply. This file only adds what Part G needs.

## Where it is

- Worktree `/Users/akashkushwaha/Projects/ims-platform/ims-platform/proceed-222204`,
  branch `shop/a2`. Push `git push origin HEAD:dev && git push origin HEAD`,
  then check `git ls-remote origin dev` equals `git rev-parse HEAD`.
  (GitHub says the repo moved to `kushwaha971/yourkhata`; the old URL still
  works.) Never push `main`.
- The design: the owner's latest export is the repo copy
  `docs/revamp/design/shop-fixes-and-business-types.html` (refreshed 1 Nov
  from the owner's upload; the live artifact link cannot be read by this
  account). Part G is `<section id="g1">` … `g12`; mocks `M.pRate`, `M.dRate`,
  `M.pOldGold`, `M.dJewelBill`, `M.pJOrder`, `M.dJOrders`, …
- Order: the owner said "start" to Jewellery G1–G3 first (decision 7). Decision
  9 in the design lists Hardware, Medical, Mobile, then Jewellery; asked, the
  owner chose Jewellery first.

## G1 · Today's rate — state

Built and pushed. Report `docs/performance/2026-11-01-shop-g1-todays-rate.md`
(spec, conflicts 1–8, results). Harness `e2e/g1-rate.mjs` (in `b-regression.sh`).

- Backend: `inventory.MetalRate` (one row per business per day, four purities),
  `GET/PUT /api/v1/metal-rates/today`, `GET /api/v1/metal-rates?month=YYYY-MM`;
  feature key `rates` (jewellery preset), 404 for any other kind; read =
  `inventory.item.read`, set = `inventory.item.write`. Tests
  `apps/inventory/tests/test_metal_rates.py`.
- Frontend: `/stock/rates`, `RatesPageContent.tsx`, `metalRateService.ts`,
  menu row `rates` in `features/shop/app.ts`, words `stock.rates.*`.
- QA data: `e2e/fixtures/ad_cert_people.py` adds **QA Jewellery** (owner
  `qa-jeweller@adcert.test`, staff `qa-jstaff@adcert.test`, password in that
  file, test values only) and four earlier days of rates.
- **G2 must copy the day's rate onto the bill** ("a bill keeps the rate it was
  issued at"); G1 only stores and serves it.

## Lessons from G1 (also in the learning log, H37 and H39)

- Read `docs/testing/tester-learning-log.md` BEFORE writing a harness.
- Dark mode is the `ub_theme_choice` cookie, not `colorScheme`; assert
  `html[data-theme]`.
- Read the saved figure back from the box on screen, not only from the API.
- Measure table column widths; prove a new check fails on the broken build.
- The design's buttons are 14 px / 600; ours are the shared 16–17 px / 700 token
  (listed for the owner, not changed per screen).
- `e2e/design-compare.mjs --kind=jewel` draws the jewellery mocks.

## Next

G2a (tags), the D3/D5 rebuild and G2b (bill by weight) are in; state and gaps
in `docs/performance/2026-11-02-shop-g2-jewellery-bill.md`. Live checks:
`node e2e/g2a-tags.mjs`, `node e2e/g2b-bill.mjs` (both have `--skew`).
Owner decided 2 Nov: no GST default by kind anywhere; the business picks the
rate, 0% allowed. The jeweller's desktop columns are built.

G2 is complete: G2a tags, G2b bill by weight, G2c old gold, G2d PAN. Live checks: `e2e/g2a-tags.mjs`, `g2b-bill.mjs`, `g2c-old-gold.mjs`,
`g2d-pan.mjs` (each has `--skew`). Owner calls listed in the G2 report
(old gold over the bill, PAN on the print; owner decided: no cash limit anywhere).
Next: G3 · custom orders and karigar (design §G3).

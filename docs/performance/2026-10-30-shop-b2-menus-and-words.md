# B2 — Menus and words per business

> **Status: ready for the owner's check** (30 Oct 2026). Design: §B2 of
> `docs/revamp/design/shop-fixes-and-business-types.html` (v7), mocks `dShell`
> (desktop sidebar + Home), `pMore` (phone More + bottom bar), `wordTable`,
> `nav(t)`; owner decisions R-DEC-51, R-DEC-63–66, design E2 (all
> "recommended", 30 Oct), BP-22 (`docs/platform/17-business-model-map.md` §6).

## Spec to check

| # | What | Source | Check |
|---|---|---|---|
| S1 | Words per business: Medical says Distributor(s) for Supplier(s); a wholesaler says Retailer(s) / Company(ies); everyone else the shared words | `BT[*].supp/supps/cust/custs`, wordTable | session `active_tenant.words` read back; sidebar, More, Home, lists show them (EN + HI) |
| S2 | Words come from the server in the person's language; screens call `useAppWords().w`, never read a business type | BP-22 #1, R-DEC-51 #6 | architecture test: no client file outside the hooks reads `business_type` for words |
| S3 | Sidebar order is the same for everyone; a kind adds rows and hides rows it never uses | R-DEC-51 #1, E2 #1, #6 | rows per kind measured on the live app |
| S4 | Sales orders, Delivery challans, Purchase orders only for wholesale, hardware, auto parts, mobile & electronics | E2 #6 (approved) | a kirana/medical/café/jewellery/other session has no such rows; hardware has them |
| S5 | Features come from the server (`active_tenant.features`), the client asks `useFeature(key)` | BP-22 #2 | session read-back; `useFeature` unit test |
| S6 | Rows that belong to features not built yet (Expiry, Find by IMEI, Print labels, Stock transfer, E-way bills, Stock count) are NOT shown until their screen exists | CLAUDE.md "a button that opens nothing" | absent on the live app |
| S7 | Sidebar header shows the business name and its kind under it | design `rail()`: "<kind> · <app>" | measured text |
| S8 | Phone bottom bar Home · Customers · Suppliers · Bills · More, with the business's words | R-DEC-66 #3 (E2 #2) | phone shot 390/320 |
| S9 | Data never crosses businesses: switching business swaps words, rows and features | R-DEC-65 | switch two businesses, read the session each time |

## Conflicts / notes (listed, not chosen)

- **BP-22 #3 "the server sends the menu rows"** vs this piece: the server sends
  the FEATURE list and each manifest row names the feature it needs, so the
  server still decides *whether*, the client *where*. A full server-sent row
  list needs every manifest row key mirrored on the server; proposed as a
  follow-up, not done silently.
- **Older broad types** (retail, trader, manufacturer, services,
  professional, distribution, food, other) keep Sales orders / challans /
  purchase orders on, so existing businesses lose no rows (E2 #6 names only
  the new kinds).
- The rename of the app labels ("Billing & Stock" etc.) belongs to the
  post-Shop start-flow piece; B2 keeps today's app names.

## First build, 30 Oct 2026

- Server: `active_tenant.features` and `active_tenant.words` (per language)
  from `selectors/business_words.py`; `orders` feature per kind (E2 #6); medical
  Distributor, wholesale Retailer/Company labels (b9aef86ab, 164091e44).
- Client: menu labels via `useAppWords().w` (sidebar, tab bar, More);
  `feature: 'orders'` on Sales orders / Delivery challans / Purchase orders;
  `useFeature`; "<kind> · Shop" under the business name (eb4095fa5).
- **`e2e/b2-menus.mjs` 56/56** over hardware, medical, kirana, kirana +
  wholesale, jewellery × EN/HI × 1280/390 (session read back, sidebar and More
  read, orders rows, words, kind caption, overflow, cut text). `--skew`: every
  read-back check fails (the 20 that pass are the overflow checks).
- **Found and fixed by looking:** the Hindi sidebar said "Distributors" and
  "Medical" — words were resolved in the account's saved locale, not the one
  on screen (H33).
- Phone tab bar reads Home · Customers/Retailers · Suppliers/Companies/
  Distributors · Bills · More (R-DEC-66 #3).
- **Not yet done:** dashboard (Home) words and follow-ups per kind (design
  dShell's kpi strip); list page titles ("Customers" page header) still say
  the shared word; the server-sent row list (BP-22 #3, see conflicts);
  monkey, edge cases, A3–A8 + B1 regression; S9 switching businesses.

## State when the usage limit was reached (30 Oct 2026)

- People lists in the business's words (89539b4f8): medical Suppliers page is
  "Distributors" / "Add distributor" — passes live.
- `b2-menus` 58/61. The 3 failures are S9 (switch business): the harness's
  raw `POST /auth/switch-tenant` answered **403** — most likely the harness
  missing the app's CSRF/request headers, NOT yet proven either way. Next:
  switch through the UI's business switcher instead and re-run.
- Not done: monkey, edge cases, A3–A8 + B1 regression; Home per-kind strip
  (needs unbuilt features — expiry, IMEI — comes with those pieces).

## Round 2 — ready for the owner's check (30 Oct 2026, afternoon)

| # | Check | Result |
|---|---|---|
| S1–S4, S7, S8 | `b2-menus` live: 5 kinds × EN/HI × 1280/390 — session words + features, sidebar, More, tab bar, orders rows, kind caption, overflow/cut | **61/61**; `--skew` fails every read-back |
| people lists | medical Suppliers page "Distributors", "Add distributor" | pass (in b2-menus) |
| S9 | switch medical → hardware: words and features swap in the session | pass (the earlier 403 was the harness missing the CSRF header) |
| E17/E16/E3 | `b2-edges`: owner-typed long word at 1280/390/320, survives reload; typed address of a hidden row | **9/9** |
| monkey | `/dashboard` as a medical store and a wholesaler, seeds 1–3 × 390/1280 | **12/12 PASS** |
| regression | a3-customer-box-look 70/0, a3-functional 0, a4-money/remove-undo/functional PASS, a4-edges 11/11, a5-measure PASS (harness item pick widened, H25), a6-forms 24/0, a7-measure 32/0, a8-first-tap 38/0, b1-pick 124/124, b1-signup 16/16, b1-edges 8/8 | all pass |
| gates | tsc, eslint, i18n clean; jest onboarding/navigation/tenant-switcher/auth 454, parties/components/design-system/redux 1093; platform + performance pytest pass except the pre-existing tenant-export check | pass |
| bundle | sign-up +3.8 KB (the onboarding words; Other's section now lazy), profile +0.9, design-system +0.7 | budgets raised to measured + 0.3 with a note |

**Defects found and fixed this piece:** Hindi screens showed English business
words (H33); B1's `sells_wholesale` added an uncounted query (budget updated);
six formatting files committed by mistake and taken back out (H34); two
harness mistakes (missing CSRF header; writing to the wrong open business —
H35).

**Not in B2, listed:** Home's per-kind strip (needs expiry/IMEI/sizes, which
come with their D pieces); the server-sent row list (BP-22 #3) — the server
sends features and the rows name them; app renames come with the start-flow
piece. Competitor comparison for this screen: from the design thread's Part R
(not hands-on).

**Self-rating (owner's to give):** function 9, testing 9, UI 9 for the menu
and lists; Home unchanged.

## Part B thread, 30 Oct 2026 (late) — B2/B3 gaps

- **B3 against `dFeatures`/`pFeatures`:** "What you sell" and "Features" are
  600 like the design's `b`; the kind chip is the design's `.chp.on` on a
  desktop (34 px, teal wash and border, 16 px kind picture, 14 px regular) and
  `.chp.on.sm` on a phone (28 px, 12.5 px, no picture). Looked at 1024 and
  1280 (both fine) and 390/320, light and dark (real dark), EN and HI.
- **"Sidebar business block lacks the kind picture":** the design's rail
  (`.rail .biz`) has a logo tile, the name and "<kind> · Billing & Stock" — no
  kind picture — and R-DEC-06 keeps the YourKhata logo on the white tile. The
  rail already shows "<kind> · Shop". Nothing to add; listed, not invented.
- **Listed for the owner:** (1) `dFeatures` draws a Settings side menu
  (Business details, Shop features, Bills and print, Tax and GST, Team,
  Devices, Plan) beside the page; Settings here is a hub list, and building
  the menu changes every Settings page — Part F, or now? (2) The rail cuts a
  long business name with "…" exactly as the design's CSS does, against the
  plain-words "no word cut by an ellipsis" rule. (3) 2 switches vs the
  design's 9 — owner, 30 Oct 2026: left as built; tested again after Part D.
- **Re-run on :3006:** `b2-menus` 126/126, `b2-edges` 9/9, `b3-features`
  14/14; settings jest pass.

# 13 · Business types, new Shop features and scanning: implementation plan

Status: **plan, not authorisation** (R-DEC-01). Written 24 Oct 2026 against `dev` at `60fa225` ("Payment receipt (08 §10)"). Nothing in the code has changed.

**When this starts:** after the current Shop and Udhaar revamp work under R-DEC-27/R-DEC-34 is delivered. Each phase below is one feature in the R-DEC-34 sense. It is built completely (build, gates, LOOK, phone and desktop screenshots per R-DEC-07, performance, docs, commit, push) before the next one opens.

**What this answers:** open decision D-02 in `docs/shop-ims-readiness/07-delivery-roadmap.md` ("supported businesses and capability limits; phased batch/expiry/variants/serial/unit/location support"). The research behind it, with the fit table, effort sizes and competitor sources, is the "Who the Shop Fits" page: https://claude.ai/artifact/MPwQixXJJE5D3ATgsLYpbn

---

## 0. Rules this plan follows

| Rule | Where it comes from | What it means here |
|---|---|---|
| Feature by feature | R-DEC-34 | Phases run one at a time, in the order of §3. No half-built feature is left behind to start the next. |
| Revamp composition, not patches | R-DEC-29, R-DEC-30/31/33 | New fields go into the revamped screens of 07-screens/08, 09 and the Counter Mode reference (`design/counter-mode.html`). Phone uses cards, desktop uses tables. |
| Hard gates | R-DEC-32, CLAUDE.md gates 1–12 | Every phase reports functional correctness, why users need it, a competitor comparison, and evidence. Wrong money or stock can't be excused by any score. |
| Screenshots after each piece | R-DEC-07 | Phone and desktop, every state, EN and HI, before the next piece. |
| A new dependency needs its own ADR | ADR-021 | Camera-scan fallback library (§2) and the GST provider (§3 P5) each get one. Next free number is ADR-064. |
| A backend change is a BP | 08-backend-change-proposals.md | Each phase's server work is written up as a BP (next free BP-20) and approved before it's built. |
| Weighted-average costing stays | D-01 (16 Oct) | Batches and serials do not switch costing to FIFO or per-batch cost. Stock value keeps the weighted average per item and location. |
| Library and Lending frozen | L-01, 02-preserve-and-contracts | Nothing here touches their endpoints, models or flows. |
| Plain labels | R-DEC-28 | "Expiry", "Batch", "Size", "IMEI", "Godown", in plain English and Hindi. Never "SKU variant matrix". |

---

## 1. Foundation: the business type decides what shows (Phase F0)

The owner's model (24 Oct): the business type picked at sign-up, or the app picked in More/Apps, decides which features and fields appear. A kirana sees nothing new. An owner with several businesses switches between them and each shows only its own features. Users are not expected to find Settings.

### 1.1 What already exists (read on `dev`)

- `platform_tenant.business_type` with 9 values (`platform_app/constants.py:26`: retail, wholesale, distribution, services, trader, manufacturer, professional, food, other). Sign-up requires it when the Shop is chosen (`serializers/tenant.py:118`).
- Presets per type (`platform_app/services/presets.py`). These set `inventory_enabled`, party labels, favourite units, expense categories and due days. Setting keys read their default from the preset (`settings_schema.py:99`, `:263`).
- Business switcher (`features/tenant-switcher`): separate businesses, each with its own type, GSTIN, data and staff. Two businesses can't share a GSTIN (`uq_tenant_partner_gstin`).
- Apps switcher (`apps_registry`, `set_app_running`, R-DEC-09): Shop, Udhaar, Library and Lending inside one business, sharing contacts.
- Entitlements (`services/entitlements.for_tenant`). MODULE-SUBSCRIPTIONS.md step 1 proposes `Entitlement.has(feature)`.

### 1.2 Data

| Change | Detail |
|---|---|
| Finer business types | Add `kirana`, `medical`, `mobile_electronics`, `garments_footwear`, `hardware_electrical`, `auto_parts`, `cafe_bakery`, `jewellery`. Keep the 9 old values valid (no data migration). Old `retail` keeps today's preset. |
| More than one type, one GSTIN | New setting `shop.extra_types` (list), for a kirana + medical shop under one registration. Features = union of the presets. |
| Feature switches | New setting keys with preset defaults: `shop.features.alt_units`, `.part_numbers`, `.godowns`, `.variants`, `.serials`, `.batches`, `.schedule_h`, `.eway_bill`, `.einvoice`, `.addons`. All default **off** for existing businesses. |
| Per-category scope | `inventory_category.features` (JSON, default `{}`). In a mixed shop, batch and expiry fields appear only on items in "Medicines", and IMEI only on "Phones". Empty means "follow the business". |
| Offers already answered | `shop.offers.answered` (list of feature keys) so a "No" is never asked again. |

### 1.3 Server

- One helper, `features.on(tenant, key, category=None)` = entitled (`entitlement.has`) ∧ switched on ∧ category allows it. No code compares a business type or plan code directly (MODULE-SUBSCRIPTIONS §4.3).
- Serializers drop fields for a feature that is off, and writes ignore them (same pattern as cost fields without `reports.financial.read`).
- `auth/me` or the settings payload carries the resolved feature set, so the client never asks per screen.

### 1.4 Screens

| Screen | Change |
|---|---|
| Sign-up / onboarding (07-screens/01) | "What do you sell?" as picture tiles in EN/HI: Kirana, Medical, Mobile, Kapde, Hardware, Mithai/Bakery, Wholesale, Jewellery, Other. One tap; "+ I also sell…" for a second tile. Replaces the type dropdown. |
| Platform console | Agent or partner sets the type for a shop they onboard (the console already writes per-tenant overrides). |
| `UbFeatureOffer` (new shared card) | One-time yes/no card with an example, shown at the moment of need (see each phase). "No" is stored in `shop.offers.answered`. |
| Settings › Shop features (fallback) | One line and one switch per feature. For support staff and the rare power user. Off hides fields and keeps data. |
| `useFeature(key, categoryId?)` | Client hook. Every new field, column, menu item and report checks it. |

### 1.5 Tests and checks

- Preset table test: each type → expected feature set.
- **All-off parity**: with every feature off, the Shop screens are pixel-identical to before F0 at 390 and 1280 px (the desktop-unchanged method of Phase 4), and the issue request makes the same number of queries (`django_assert_num_queries`).
- The server refuses or ignores a feature field when the feature is off (one test per key, added in each later phase).
- Business switcher: two businesses with different types each show only their own features.

**Effort:** about 2 weeks. **Done when** a kirana's screens and timings are unchanged, and a "Medical" sign-up has the switch on, ready for P4.

---

## 2. Scanning on desktop and phone (Phase S)

Done early because every later phase uses it: variant barcodes, IMEI, batch, stock count.

### 2.1 What already exists

| Where | What works today |
|---|---|
| `src/hooks/useScannerListener.ts` | USB/Bluetooth scanner as a keyboard: a fast burst ending in Enter, outside text fields |
| Bill editor and Counter Mode (`InvoiceLinesSection`, `ItemLineCell`, `ItemQuickAdd`) | Scan into the item search → `GET /items/lookup?barcode=` (barcode, then SKU) → line added. The same item again raises Qty (b7a001a). The caret stays in search after a scan. |
| Purchase bill lines (`PurchaseBillLinesSection` → `ItemLineCell`) | Same scan-to-line |
| Items list (`ItemListPageContent`) | Scan anywhere opens the item, or offers "+ Add it" |
| Stock adjustment (`StockAdjustmentDrawer`) | Scan adds a line |
| Item form | Duplicate barcode check on scanner Enter |
| Server | `inventory/views/items.py:284` lookup, unique barcode per business |

**Missing:**
- **No camera scanning anywhere.** `docs/platform/10-architecture.md:545` records ADR-025 ("native BarcodeDetector only") as a decision, but no code uses it.
- No scan-to-fill on the item form barcode field.
- No stock count (shelf count) screen.
- No scan feedback (sound, vibration, "last scanned" strip).
- No weighing-scale (price-embedded) barcodes.
- No barcode label printing.

### 2.2 Design

- **One hook, two inputs:** `useScan({ mode: 'single' | 'continuous', onCode })` wraps the existing keyboard listener and a new camera sheet. Screens call one thing.
- **Desktop / counter:** keep the keyboard-wedge path as is, since it is already fast. Add a short beep and a flash on the added line, plus a "Not found: 8901… · + Add item" chip that doesn't steal focus.
- **Phone:** a scan icon inside every item search field opens `UbScanSheet`, a full-screen camera with a framing box, torch button and close.
  - **Continuous mode (billing, purchase, stock count):** each code adds or raises a line, with beep plus vibration and the last 3 items shown at the bottom. The camera stays open until "Done".
  - **Single mode (search, item form barcode, IMEI field):** the first code fills the field and the sheet closes.
- **Decoder:** native `BarcodeDetector` where available (Chrome on Android). iOS Safari and some Android browsers lack it, so ADR-025 has to be amended with a fallback. Use a WASM/JS decoder (e.g. `zxing-wasm` or `@zxing/browser`) that loads lazily only when the sheet opens. **New ADR-064** (ADR-021), with a bundle rule of 0 KB added to the initial bundle and the decoder in its own chunk.
- **Formats:** EAN-13/8, UPC, Code 128, Code 39, QR, and later DataMatrix (for medicine packs, P4).
- **Weighing-scale labels:** EAN-13 starting `2x` with an embedded item code and weight or price. The parse rule is a business setting under Hardware/Kirana. Server lookup returns the item plus quantity.
- **Camera denied / no camera:** a plain message with "Type the code instead". The sheet never blocks the bill.

### 2.3 Where scanning goes

| Screen (07-screens ref) | Desktop | Phone |
|---|---|---|
| Bill editor / Counter Mode (09 §3) | exists; add feedback | camera, continuous |
| Purchase bill editor (09 §7) | exists; add feedback | camera, continuous |
| Items list (09 §8.1) | exists | camera, single → open item |
| Item form barcode field (09 §8.3) | scan fills | camera, single |
| Stock adjustment (09 §8.4) | exists | camera, continuous |
| **New: Stock count** (under Items › Stock) | scanner | camera, continuous; posts as `stocktake_in/out` (movement types exist) |
| Credit note "goods came back" (09 §4) | scan to pick returned line | camera, single |
| Later: IMEI/serial (P3), batch (P4), variant (P2) | — | same sheet |

### 2.4 Tests and speed

- Unit: decoder adapter with a mocked `BarcodeDetector`; continuous mode adds and raises Qty; denied permission path.
- e2e: Chromium with `--use-fake-device-for-media-stream --use-file-for-fake-video-capture=<barcode.y4m>` scans a real EAN on the bill editor at 390 px.
- Speed: extend `e2e/counter-entry-timing.mjs`. Code read → line visible ≤ 150 ms p50 at 4× CPU, for scanner and camera. Camera sheet open → first frame ≤ 1 s on a mid Android.
- `bundle:check` unchanged; decoder chunk size recorded.

**Effort:** about 2 weeks (+ ADR-064). Label printing is in P2.

---

## 3. The feature phases, in order

Order by value and risk: cheap wins first, then the "list behind the field" features that share one pattern (P2 → P3 → P4), then the outside connection, then new apps. The owner can swap P4 ahead of P2/P3 if pharmacy is the priority market. P4 then builds the shared line-detail pattern itself.

### P1 · Small pack: box/piece units, part numbers and rack, godown transfers (~4 weeks)

| | Box ↔ piece units | Part numbers, rack | Godown transfers |
|---|---|---|---|
| Feature key / presets | `alt_units`: hardware, wholesale, distribution, kirana (offer) | `part_numbers`: auto_parts | `godowns`: wholesale, distribution |
| Data | `inventory_item_unit` (item, unit, factor, barcode null, selling_price null). Sales and purchase lines already have `unit_code`; add `unit_factor` and `base_qty`. Stock posts `base_qty`. | `inventory_item_code` (item, code, kind) unique per business; `Item.rack`; `vehicle_no` on the sales document (P5 reuses it) | `inventory_stock_transfer` + lines (from, to, item, qty), numbering kind `transfer`; `location` on sales documents and purchase bills (stock uses `default_location` today) |
| Server | conversion in one place before `post_movements`; lookup matches a unit's own barcode ("box" barcode adds 1 box) | lookup checks extra codes after barcode and SKU | `POST /stock-transfers` keyed, writes the `transfer_out`/`transfer_in` pair via `post_movements`; stock summary by godown |
| Screens | item form fold "Also sold as" (09 §8.3); unit chip on the bill line only for items with two units | item form, item search, picker caption "Rack B-4" | new Transfer screen (Items › Stock); godown chip on the bill/purchase header **only once a second godown exists**; Stock summary godown filter |
| Offer card | typing "box", "dozen" or "case" in Qty | — | adding a second location |
| Tests | 1 box = 100 pcs sale reduces stock by 100; return of 1 box; price per unit; `recalc_stock` parity | lookup order; duplicate code refused | transfer keeps total stock, moves value at average cost; replay/void; can't send more than on hand |
| Speed | counter-entry-timing unchanged for single-unit items | revamp-counter-search p50 unchanged | issue query count unchanged with one godown |

### P2 · Size and colour variants, with label printing (3–4 weeks)

- **Key / presets:** `variants`: garments_footwear, hardware_electrical (size, rating), paint via hardware.
- **Data:** `inventory_product` (name, category, attributes: e.g. Size [S,M,L], Colour [Red,Blue]). `Item.product` FK null and `Item.attributes` JSON. **Each variant is a normal item**, so stock, bills, GST, returns and reports keep working with no change to the stock engine.
- **Server:** create product + generate variant items in one keyed request; list grouped by product; lookup by a variant barcode returns the exact item.
- **Screens:** item form "Has sizes / colours" step with a size × colour grid (09 §8.3); items list grouped card with stock per size (09 §8.1); picker shows "Shirt Blue · M" and a grouped list when typing; purchase entry grid (enter quantities per size in one table); **barcode labels** from the item and after a purchase (thermal 50×25 mm and A4 sheet; same print pipeline as `InvoicePrintThermal80`).
- **Offer card:** saving a second item whose name matches an existing one plus a size word (S/M/L/XL/28/30…).
- **Tests:** grid creates N items with unique SKUs and barcodes; a sale of one variant moves only that stock; a product with a sold variant can't be deleted; labels print the right barcode.
- **Speed (the risk):** the picker is Counter Mode's busiest path. `revamp-counter-search.mjs` p50 must not rise with a 5,000-item scale book where 60% are variants. A scan still lands directly on the variant.

### P3 · Serial / IMEI and warranty (3–4 weeks)

- **Key / presets:** `serials`: mobile_electronics. Per item: `Item.tracking = 'none' | 'serial'`, `Item.warranty_months`.
- **Data:** `inventory_serial` (item, serial, status in_stock/sold/returned/written_off, purchase_line, sale_line, warranty_until). Unique (tenant, item, serial). Quantity stock stays as today. A check makes the count of `in_stock` serials equal on-hand for tracked items (`recalc_stock` gains this proof).
- **Server:** purchase record requires N serials for qty N on tracked items; issue requires picking in-stock serials; credit note returns them; void restores them; `GET /serials/{code}` for "find by IMEI" (who bought it, when, warranty left).
- **Shared pattern built here (reused by P4):** a "line detail" sheet on bill and purchase lines that opens only for tracked items, with scan or type and a count ("2 of 3 entered").
- **Screens:** purchase line serial entry with continuous camera scan; bill line serial pick (scan or choose); print shows IMEI and warranty end; item detail "Serials" tab; header search accepts an IMEI.
- **Offer card:** creating an item in a category named like Mobiles/Phones/TV/Laptop.
- **Tests:** can't sell a serial twice, even concurrently (row lock); return then resell; void; serial count = on hand; access (staff without cost see no cost on serial view).
- **Speed:** untracked items take exactly today's path (query-count test on issue).

### P4 · Batch and expiry, then Schedule H (5–7 weeks + ~1 week)

The deepest change, and the one that opens the most businesses (pharmacy, FMCG distributors, agri inputs, bakery and dairy, cosmetics).

- **Key / presets:** `batches`: medical, distribution (offer), cafe_bakery (offer). Per item: `Item.tracking = 'batch'`. `schedule_h`: medical.
- **Data:** `inventory_batch` (item, batch_no, expiry_date, mfg_date null, mrp null). `ItemStock` and `StockMovement` gain a nullable `batch` FK, and the stock key becomes (item, location, batch). Non-batch items keep `batch = NULL`, so their rows are unchanged. Average cost stays per item and location (D-01), and batch carries quantity and expiry only.
- **Server:** `post_movements` gains the batch key in its lock order (item, then batch) and in the availability check. Purchase lines carry batch and expiry. Issue picks the earliest-expiring in-stock batch automatically (FEFO), overridable. Credit notes return to the original batch. Expired batches are refused on sale unless the owner allows. New reports: near expiry (30/60/90 days), expired, batch-wise stock. Schedule H: `Item.schedule` (H/H1/X), doctor and patient on the sale only when such an item is on it, register report, drug licence number in business details and on the print.
- **Scanning:** GS1 DataMatrix on medicine packs carries the GTIN, batch and expiry. Parse it so one scan fills item + batch + expiry on purchase (uses the Phase S decoder).
- **Screens:** purchase line batch and expiry (line-detail sheet from P3); bill line shows the picked batch as a caption ("B-2231 · exp 03/27"), with no extra tap; item detail "Batches" tab; Home low-stock card gains "Expiring soon"; Stock summary batch view.
- **Offer card:** typing an expiry-looking text into an item name, or choosing a medicine HSN (3003/3004).
- **Tests:** FEFO pick; partial batch; return to batch; void and replay; `recalc_stock` parity per batch; two concurrent sales of the last strip (lock order); expired refusal; Schedule H fields required only when needed.
- **Speed (highest risk):** every kirana bill goes through `post_movements`. Before release: `counter-entry-timing.mjs`, `perf-billing.mjs` and the issue query-count test are unchanged for non-batch items, measured on the scale book at 4× CPU. Any rise blocks the phase.

### P5 · E-way bill and e-invoice (~5 weeks, plus provider sign-up)

- **Key / presets:** `eway_bill`: wholesale, distribution; `einvoice`: on when the owner confirms turnover above ₹5 crore (asked once in context).
- **Decision first:** choose a GST Suvidha Provider (GSP) API, the cost per call and the credential storage. ADR-065 (ADR-021). A **JSON export for manual upload** to the portal ships first (~1 week, no provider) so the feature is useful before the integration.
- **Data:** on the sales document: transporter name/GSTIN, vehicle no. (from P1), distance, `eway_bill_no`, `eway_valid_until`, `irn`, `ack_no`, `signed_qr`, `irn_status`. Credentials in the existing secrets store per business.
- **Server:** generate, cancel and update Part B for e-way bills; generate IRN on issue for B2B invoices, cancel within 24 hours, and lock the invoice once it has an IRN. Calls run through the existing job table with retry, and the bill shows "Waiting for GST portal" without blocking the counter.
- **Screens:** bill detail "Make e-way bill" button with an offer card when goods value > ₹50,000 and the delivery state differs or a challan is used; IRN and QR on A4 print; challan transport fields; e-way bill register.
- **Tests:** sandbox round-trips; idempotent generate (no double IRN); cancel window; void blocked after IRN except via cancel; offline shows a truthful status.
- **Speed:** zero change for businesses without the feature; issue never waits on the portal.

### P6 · Café add-ons and kitchen ticket (2–3 weeks)

- **Key / presets:** `addons`: cafe_bakery.
- **Data:** `inventory_item_addon` (item, name, price, group, min/max). The sales line gains `addons` JSON with a price snapshot, and add-on prices go into the line's taxable value.
- **Screens:** Counter Mode opens an add-on sheet **only for items that have add-ons**; the kitchen ticket is a second thermal print without prices; Home shows top items with add-ons.
- **Tests:** totals and GST with add-ons; credit note of a line with add-ons; print.
- **Speed:** an item without add-ons keeps today's tap count and timing.
- Swiggy/Zomato order sync is out of scope (separate integration, separate approval).

### P7 · Jewellery as its own app (2–3 months)

- **Why an app:** pricing is by weight and today's rate, every piece is unique, and old gold comes in during a sale. The screens differ from the Shop, as Library's do. Registered with `register_app` (code `jewellery`, anchor module `jewellery`), chosen from the "Jewellery" tile or More/Apps. A kirana never sees it.
- **Reuses:** contacts, payments, ledger, the GST invoice issuer (through the documents seam, as gym/hospitality are planned to), serials from P3 for tag numbers, and scanning for tag barcodes. The Lending app can cover gold loans (girvi) separately.
- **Data:** daily metal rate (metal, purity, rate, date); tag (gross, stone and net weight, purity, HUID, making-charge rule, stone value); old-gold intake as a purchase inside the sale.
- **Plan detail** goes in its own document after P1–P4, with a competitor task study (Tally, Busy, myBillBook jewellery) per R-DEC-32.

### P8 · ERP pieces (6–12 months; each one needs its own approval)

| Piece | Where | Size | Note |
|---|---|---|---|
| Full accounts (chart of accounts, journal, trial balance, P&L, balance sheet) | new **Accounts** app | 2–3 months | Writes journal entries **alongside** every existing money write, never instead of them. The party ledger stays the source for customer and supplier balances. |
| Branches and more than one GSTIN | core change | 1–2 months | Branch on every document, numbering and GST returns per GSTIN, staff access per branch. A one-branch business sees no branch choice anywhere. |
| Production with bill of materials | new app | 1–2 months | Uses items and `post_movements` (consume / produce movement types). |
| TDS / TCS | extend sales and purchases | ~1 month | |
| Approvals, multi-currency | extend | ~1 month each | |
| Payroll | integration only | — | Not built in. |

Renaming "Shop" to "Business" should wait until full accounts and branches exist (see the research page).

---

## 4. Timeline at a glance

| Order | Phase | Size | Rough time | Unlocks |
|---|---|---|---|---|
| 1 | F0 Business type decides features | — | 2 weeks | the base for everything below |
| 2 | S Scanning (camera on phones, feedback, stock count, scale labels) | Medium | 2 weeks | faster billing for every shop |
| 3 | P1 Units, part numbers, godowns | Small × 3 | 4 weeks | hardware, tiles, cement, cloth, auto parts, distributors, multi-outlet |
| 4 | P2 Variants + labels | Medium | 3–4 weeks | garments, footwear, sarees, uniforms, paint, bags |
| 5 | P3 Serial / IMEI | Medium | 3–4 weeks | mobile, electronics, appliances, CCTV, inverters, two-wheelers |
| 6 | P4 Batch & expiry + Schedule H | Major | 6–8 weeks | pharmacy, FMCG, agri inputs, bakery, cosmetics |
| 7 | P5 E-way bill + e-invoice | Medium | ~5 weeks | all wholesalers, traders above ₹5 crore |
| 8 | P6 Café add-ons | Medium | 2–3 weeks | cafés, tea stalls, takeaways |
| 9 | P7 Jewellery app | Major | 2–3 months | jewellers, bullion |
| 10 | P8 ERP pieces | Major | 6–12 months | manufacturers, chains |

F0 through P4 take about 6 months of one developer's time. That covers roughly 40 more business types than today.

## 5. Speed guardrails for every phase

1. With the phase's feature **off**, Shop screens are pixel-identical and the issue request's query count is unchanged.
2. `e2e/counter-entry-timing.mjs`, `e2e/perf-billing.mjs` and `e2e/revamp-counter-search.mjs` on the scale book at 4× CPU: no regression beyond noise for a kirana-shaped book. Results go in the phase report under `docs/performance/`.
3. `bundle:check` holds the baseline. New feature screens and the scan decoder are lazy chunks.
4. 320 px Hindi with large text for every new field (07-screens/09 §0.1).

## 6. Decisions the owner needs to record

| Proposed ID | Question | Recommendation |
|---|---|---|
| R-DEC-35 | Adopt the business-type-decides-features model (§1), including picture tiles and in-context offers, with Settings as fallback | Yes |
| R-DEC-36 | Phase order F0 → S → P1 → P2 → P3 → P4 → P5 → P6, or move P4 earlier for pharmacy | As listed, unless pharmacy is the launch market |
| R-DEC-37 | Jewellery as a separate app, not inside the Shop | Yes |
| R-DEC-38 | ERP pieces need separate approval each; keep the "Shop" name until accounts and branches exist | Yes |
| ADR-064 | Camera-scan fallback decoder (amends ADR-025) | Lazy WASM decoder; native BarcodeDetector first |
| ADR-065 | GST provider for e-way bill and e-invoice | Choose before P5; JSON export first |

## 7. Open questions

1. Which business type is the launch focus after Shop and Udhaar? That decides whether P4 moves up.
2. Label printer sizes the target shops use (50×25 mm, 38×25 mm, A4 sheets).
3. Should a mixed shop pick types per category from the start (§1.2), or start with business-level only and add category scope when a real mixed shop asks?
4. Budget for GST provider calls (P5).

# 14 · Starter setup per business type: categories, units, GST and fields

Status: **plan, not authorisation** (R-DEC-01). Written 25 Oct 2026 against `dev` at `ec188be`. Companion to [13-business-types-and-scanning-plan.md](13-business-types-and-scanning-plan.md) (Phase F0). No code has changed.

**What this is:** for each business type in plan 13, the item categories, units, common HSN codes with suggested GST, extra item and bill fields, expense categories, and labels that a new shop of that type should start with. Each list is compared with what `dev` seeds today.

**Rule this respects (PLT-03 FR-8, canon):** *presets never hard-wire behaviour.* Everything below is written **once at onboarding** into rows the owner can edit. Nothing branches on `business_type` afterwards (a test asserts this). GST rates are **suggestions the owner confirms**, never stored on the item (INV-01 BR-4). Rates are the GST 2.0 slabs in force from 22 Sep 2025. Always check the exact HSN, because some products split by price or type.

---

## 1. What `dev` has today

| Data | Where | What is seeded |
|---|---|---|
| Units (GST UQC) | `seed_reference_data.py` `UNITS` | **23 system units:** NOS, PCS, KGS, GMS, LTR, MLT, MTR, CMS, SQF, SQM, BOX, BAG, BTL, PAC, SET, DOZ, PRS, ROL, TON, HRS, BDL, QTL, CAN. A shop can add its own. |
| Favourite units | `presets.py` → setting `inventory.favourite_units` | 3–6 codes per business type (9 types) |
| GST rates | `TAX_RATES` | GST0, 0.25, 3, 5, 18, 40, Exempt, Nil, Non-GST (12% and 28% end 21 Sep 2025) |
| HSN/SAC starter | `HSN_STARTER` | **47 codes**, mostly grocery and FMCG, plus a few for cement, mobile, TV, AC, T-shirts, footwear, pens and services |
| Expense categories | `EXPENSE_CATEGORIES` + preset extras | 9 for everyone (Rent, Salaries, Electricity, Transport, Purchases-misc, Food, Marketing, Fees, Other) + 0–3 per type |
| Customer / supplier labels | preset `party_labels` | e.g. distribution: Retailer / Company; services: Client / Vendor |
| Default due days | preset | 7, 15 or 30 |
| **Item categories** | — | **None.** Every new shop starts with an empty category list. |
| Item fields | `inventory_item` | Name, SKU, barcode, unit, HSN, tax, purchase/selling price, MRP, reorder level, image, description. No size, batch, IMEI, weight or brand. |

**Biggest gaps:** no starter categories at all; the HSN starter covers grocery well but almost nothing for medicines, hardware, auto parts, garments above ₹2,500, jewellery or stationery; units are missing CTN, DRM, TBS, UNT, OTH and YDS, which pharmacy and wholesale need.

Legend for the tables below: **✓** already seeded on dev · **＋** to add · *(feature)* = needs the plan-13 phase in brackets.

---

## 2. Business by business

### 2.1 Kirana / general store

| Setup | Starter list |
|---|---|
| Item categories ＋ | Atta, rice and grains · Dal and pulses · Oil and ghee · Masala and spices · Sugar, salt and jaggery · Tea and coffee · Biscuits and snacks · Namkeen · Dairy and eggs · Bakery · Cold drinks and juice · Soap and detergent · Personal care · Household and cleaning · Pooja items · Baby care · Frozen · Loose items |
| Units | ✓ NOS, PCS, KGS, GMS, LTR, MLT, PAC, BTL, BOX, DOZ · ＋ CTN (carton, for supplier purchases) |
| Common HSN → GST | ✓ rice 1006, atta 1101, dal 0713, oils 1507/1508/1514, sugar 1701, tea 0902, salt 2501, biscuits 1905, namkeen 2106, soap 3401, shampoo 3305, toothpaste 3306, detergent 3402, aerated drinks 2202 (40%) · ＋ 0402 milk powder (5%), 0409 honey (5%), 1904 cornflakes/poha (5%), 2009 juices (5%), 3307 agarbatti (5%), 9619 sanitary pads/diapers (check) |
| Extra item fields | MRP ✓ · box ↔ piece *(P1)* · expiry for packed food, optional *(P4)* · scale barcode *(S)* |
| Bill extras | none |
| Expense extras | ✓ Packaging, Shop maintenance |
| Labels / due days | Customer / Supplier · 7 days ✓ |

### 2.2 Medical store / pharmacy

| Setup | Starter list |
|---|---|
| Item categories ＋ | Tablets and capsules · Syrups · Injections · Ointments and creams · Drops (eye/ear) · Surgical and dressings · Ayurvedic · Homeopathy · Baby care · Health supplements · Personal care · Devices (BP, glucometer, thermometer) · OTC · Veterinary |
| Units | ✓ NOS, PCS, BTL, BOX, PAC, MLT, GMS · ＋ TBS (tablets), OTH (strip; GST has no "strip" code, so show the word "Strip" and file as OTH), UNT (units), TUB (tubes) |
| Common HSN → GST | ＋ 3004 medicines in measured doses (5%), 3003 bulk medicines (5%), 3005 bandages and dressings (5%), 3006 surgical goods (5%), 9018 medical instruments (5%), 9025 thermometers (5%), 2106 supplements (check 5%/18%), 3304 cosmetics (18%) · some life-saving drugs 0% (owner confirms per item) |
| Extra item fields | Salt / composition · Schedule (H, H1, X) *(P4)* · manufacturer · batch no. and expiry *(P4)* · strip ↔ tablet units *(P1)* · rack *(P1)* |
| Bill extras | Doctor name, patient name (only with Schedule H/H1) *(P4)* · drug licence no. on print *(P4)* |
| Expense extras | ＋ Expired stock write-off, Cold storage power |
| Labels / due days | Customer / Distributor · 7 days |

### 2.3 Mobile and electronics

| Setup | Starter list |
|---|---|
| Item categories ＋ | Smartphones · Feature phones · Tablets · Laptops and computers · TVs · Home appliances (fridge, washing machine) · Small appliances (mixer, iron, fan) · Audio (earphones, speakers) · Chargers and cables · Covers and screen guards · Memory cards and pen drives · Smart watches · Spare parts · Repair service |
| Units | ✓ NOS, PCS, SET, BOX · nothing new |
| Common HSN → GST | ✓ 8517 mobiles (18%), 8528 TVs (18%), 8415 AC (18%) · ＋ 8471 laptops (18%), 8504 chargers (18%), 8518 earphones/speakers (18%), 8523 memory cards (18%), 8418 refrigerators (18%), 8450 washing machines (18%), 8509 mixers (18%), 8516 irons/heaters (18%), 3926 plastic covers (18%), 9987 repair service (18%) |
| Extra item fields | Brand · model · colour/storage variant *(P2)* · IMEI/serial *(P3)* · warranty months *(P3)* |
| Bill extras | IMEI on bill, warranty end date *(P3)* · finance/EMI note (free text) |
| Expense extras | ＋ Repair parts, Demo units |
| Labels / due days | Customer / Supplier · 7 days |

### 2.4 Garments and footwear

| Setup | Starter list |
|---|---|
| Item categories ＋ | Men · Women · Kids · Sarees · Ethnic wear · Innerwear · Winter wear · Uniforms · Footwear men · Footwear women · Footwear kids · Accessories (belts, bags, socks) · Fabric (by metre) |
| Units | ✓ PCS, NOS, PRS (pairs), SET, MTR · ＋ YDS (yards, for fabric) |
| Common HSN → GST | ✓ 6109 T-shirts, 6403 footwear · ＋ 6203/6204 men's/women's suits and trousers, 6205/6206 shirts, 6211 tracksuits, 5208 cotton fabric, 5407 synthetic fabric, 6402/6404 other footwear. **Garments and footwear: 5% up to ₹2,500 a piece, 18% above** (rate depends on selling price, so the bill editor must pick the slab per line) |
| Extra item fields | Size and colour *(P2)* · brand · barcode per size *(P2)* · labels *(P2)* |
| Bill extras | Exchange (return + new sale) in one step |
| Expense extras | ＋ Alteration, Packaging bags |
| Labels / due days | Customer / Supplier · 7 days |

### 2.5 Hardware, electrical, paint, sanitary, tiles

| Setup | Starter list |
|---|---|
| Item categories ＋ | Wires and cables · Switches and sockets · MCB and DB · Lights and fans · Pipes and fittings (PVC, CPVC, GI) · Sanitary ware · Taps and bath fittings · Tiles · Paint · Primer and putty · Hand tools · Power tools · Fasteners (nails, screws, bolts) · Locks and hinges · Cement and building material · Adhesives and sealants · Plumbing |
| Units | ✓ NOS, PCS, BOX, ROL (coil/roll), MTR, KGS, BAG, SET, SQF, SQM, LTR, BDL · ＋ DRM (drums of paint), CTN |
| Common HSN → GST | ✓ 2523 cement (18%) · ＋ 8544 wires (18%), 8536 switches/MCB (18%), 8539 LED lamps (18%), 8414 fans (18%), 3917 PVC pipes (18%), 6910 sanitary ware (18%), 8481 taps (18%), 6907 tiles (18%), 3208/3209 paint (18%), 3214 putty (18%), 8205 hand tools (18%), 8467 power tools (18%), 7318 screws/bolts (18%), 8301 locks (18%), 3506 adhesives (18%) |
| Extra item fields | Box ↔ piece, coil ↔ metre *(P1)* · size/rating/shade variants *(P2)* · brand |
| Bill extras | Site / contractor name (free text) · delivery challan ✓ |
| Expense extras | ＋ Loading and unloading, Delivery vehicle |
| Labels / due days | Customer / Supplier · 15 days (contractor credit) |

### 2.6 Auto parts and two-wheeler spares

| Setup | Starter list |
|---|---|
| Item categories ＋ | Engine parts · Brake parts · Clutch and gear · Suspension · Electricals and lights · Filters · Lubricants and oils · Tyres and tubes · Batteries · Body parts · Accessories · Bearings · Belts and chains |
| Units | ✓ NOS, PCS, SET, LTR, BTL, CAN · nothing new |
| Common HSN → GST | ＋ 8708 car parts (18%), 8714 two-wheeler parts (18%), 2710 lubricants (18%), 4011 tyres (18%), 8507 batteries (18%), 8421 filters (18%), 8482 bearings (18%) |
| Extra item fields | Other part numbers / OEM no. *(P1)* · fits vehicle (text) *(P1)* · rack *(P1)* · brand |
| Bill extras | Vehicle no. *(P1)* · mechanic name |
| Expense extras | ＋ Courier |
| Labels / due days | Customer / Supplier · 15 days (mechanics on credit) |

### 2.7 Wholesale / distributor (FMCG, grain, building material)

| Setup | Starter list |
|---|---|
| Item categories ＋ | By company/brand (e.g. HUL, ITC, Dabur) · Food and grocery · Personal care · Home care · Beverages · Confectionery · Grains and pulses · Schemes and free goods |
| Units | ✓ BOX, PAC, NOS, BAG, DOZ, KGS, QTL, TON · ＋ CTN (case/carton), DRM |
| Common HSN → GST | same as kirana (2.1), bought in cases |
| Extra item fields | Case ↔ piece *(P1)* · batch and expiry for FMCG *(P4)* · scheme / free quantity *(later)* |
| Bill extras | Transporter, vehicle no., e-way bill no. *(P5)* · IRN and QR above ₹5 crore *(P5)* · salesman / route (later) |
| Expense extras | ✓ Fuel, Vehicle maintenance, Scheme discounts (distribution) · ✓ Loading and unloading, Godown rent (wholesale) |
| Labels / due days | Retailer / Company ✓ (distribution) · 15 days ✓ |

### 2.8 Café, bakery and sweet shop

| Setup | Starter list |
|---|---|
| Item categories ＋ | Tea and coffee · Cold drinks and shakes · Snacks · Sandwiches and burgers · Pizza · Cakes and pastries · Bread and buns · Cookies · Indian sweets · Namkeen · Ice cream · Combos |
| Units | ✓ NOS, PCS, KGS, GMS, PAC, BOX, BTL, LTR · nothing new |
| Common HSN → GST | ✓ 1905 bakery (5%), 1704 confectionery (5%), 2106 namkeen/sweets (5%), 9963 food service (5%, no input credit) · ＋ 2105 ice cream (5%), 1806 chocolate items ✓ (5%), 1901 cake mixes (5%) · plain bread and roti are nil (check HSN) |
| Extra item fields | Add-ons (extra cheese, size) *(P6)* · track stock off for made items ✓ (food preset) · expiry for packed items *(P4)* |
| Bill extras | Kitchen ticket print *(P6)* · table/token no. (text) |
| Expense extras | ✓ Gas and fuel, Raw material, Delivery charges |
| Labels / due days | Customer / Supplier · 7 days ✓ |

### 2.9 Jewellery (own app, P7)

| Setup | Starter list |
|---|---|
| Item categories ＋ | Gold jewellery · Silver jewellery · Diamond jewellery · Platinum · Gold coins and bars · Silver articles (utensils, idols) · Gemstones · Imitation |
| Units | ✓ GMS, NOS, PCS, SET, PRS · ＋ carat is a field for stones, not a GST unit; weights to 3 decimals (mg) already work |
| Common HSN → GST | ＋ 7113 jewellery (3%), 7108 gold bars/coins (3%), 7106 silver (3%), 7114 silver articles (3%), 7102 diamonds (0.25% cut/polished ✓ rate exists), 7117 imitation (check), making charge as job work 9988 (5%) |
| Extra item fields | Tag no. · gross weight · stone weight · net weight · purity (24K/22K/18K, 916/750) · HUID · making charge (per gram or %) · wastage % · stone value |
| Bill extras | Today's rate per purity · weight breakdown · old gold taken in · PAN above ₹2 lakh cash (owner confirms rule) |
| Expense extras | ＋ Hallmarking charges, Karigar (artisan) charges |
| Labels / due days | Customer / Supplier · 0 days |

### 2.10 Stationery, books and gifts

| Setup | Starter list |
|---|---|
| Item categories ＋ | Notebooks and registers · Pens and pencils · Art and craft · Office supplies · School books · Guides and competitive books · Files and folders · Printing and xerox · Gifts and toys · Greeting cards |
| Units | ✓ NOS, PCS, PAC, BOX, DOZ, SET · ＋ "Ream" as the shop's own unit (file as OTH) |
| Common HSN → GST | ✓ 4820 notebooks (exempt), 9608 pens (18%) · ＋ 4901 printed books (exempt), 9609 pencils and crayons (0%, check), 4802 paper (check), 9503 toys (check), 9989 printing service (18%) |
| Extra item fields | ISBN as barcode ✓ · edition/class (text) · book-set bundle (later) |
| Bill extras | School / class (text) |
| Expense extras | ＋ Printing, Courier |
| Labels / due days | Customer / Supplier · 7 days |

### 2.11 Services billed by item (salon, tailor, repair, printing)

| Setup | Starter list |
|---|---|
| Item categories ＋ | Services · Packages · Products sold · Spare parts |
| Units | ✓ NOS, HRS · nothing new |
| Common HSN → GST | ✓ 9987 repair (18%), 9983 professional (18%), 9997 other services (18%) · ＋ 9996 salon/beauty (18%, check), 9988 tailoring job work (5%) |
| Extra item fields | Duration (later) · staff who did it (later) |
| Bill extras | Ready-by date, job card no. (later) |
| Expense extras | ✓ Tools and equipment, Travel |
| Labels / due days | Client / Vendor ✓ · 30 days ✓ |

### 2.12 Agri inputs (seeds, fertiliser, pesticides)

| Setup | Starter list |
|---|---|
| Item categories ＋ | Seeds · Fertilisers · Pesticides · Fungicides · Herbicides · Bio products · Sprayers and tools · Cattle feed |
| Units | ✓ KGS, GMS, LTR, MLT, BAG, PAC, BTL, QTL |
| Common HSN → GST | ＋ 1209 seeds (exempt), 3102/3105 fertilisers (5%), 3808 pesticides (check: bio 5%, chemical 18%), 2309 cattle feed (check), 8424 sprayers (check) |
| Extra item fields | Batch and expiry *(P4)* · licence-required flag |
| Bill extras | Seller licence no. on print · farmer name and village |
| Expense extras | ＋ Transport |
| Labels / due days | Farmer / Company · 30 days (crop credit) |

---

## 3. What to add to the code (for Phase F0)

| Add | Where | Size |
|---|---|---|
| 6 more UQC units: CTN, DRM, TBS, TUB, UNT, YDS (+ OTH as fallback for strip/ream) | `seed_reference_data.py` `UNITS` (idempotent) | small |
| ~120 more HSN starter rows from the tables above | `HSN_STARTER` (or the full public master via the planned `seed_hsn`) | small |
| `category_starters` per preset, created once at onboarding as normal editable categories | `presets.py` + `onboarding.py` (same place favourite units are written, `onboarding.py:653`) | small |
| New preset rows for the finer types in plan 13 §1.2 (kirana, medical, mobile_electronics, garments_footwear, hardware_electrical, auto_parts, cafe_bakery, jewellery, stationery, agri) with units, expense extras, labels and due days from §2 | `presets.py`, `BusinessType` | small |
| Feature defaults per preset (`shop.features.*`) | plan 13 §1.2 | with F0 |
| Price-based GST slab (garments and footwear ≤ ₹2,500 → 5%, above → 18%) | tax engine rule keyed on HSN + unit price | medium; needed before garments launch |

**Tests:** each preset seeds its categories, units and expense categories exactly once (re-running onboarding changes nothing); no code reads `business_type` after onboarding (existing canon test stays green); HSN search finds each new code in EN and HI.

## 4. Open questions for the owner

1. Should starter categories be shown as a pick-list on first use ("Tick the ones you sell"), or created silently? Silent is simpler for the users you describe; the empty-state card can offer "Remove ones you don't use".
2. Hindi names for categories: write them now alongside English (the app already ships both locales)?
3. Agri inputs and stationery were not in plan 13's tile list. Add them as tiles, or keep them under "Other" with these presets?

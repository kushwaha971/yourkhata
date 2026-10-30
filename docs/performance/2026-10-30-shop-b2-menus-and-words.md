# B2 — Menus and words per business

> **Status: STARTED, in test** (30 Oct 2026). Design: §B2 of
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

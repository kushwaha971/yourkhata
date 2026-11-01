# G1 — Today's rate (Jewellery)

> **Status: built, in test** (score at the end). Design: §G1 of
> `docs/revamp/design/shop-fixes-and-business-types.html` (mocks `M.pRate`,
> `M.dRate`, data `RATES`). Harness to write: `e2e/g1-rate.mjs`.

## Who needs it, and why (gate 10)

A jeweller prices every bill by weight × today's rate. Today the rate lives on
a slate or in the owner's head, so two counter staff can bill the same chain at
two prices. Typing it once each morning, and every bill that day using it and
keeping it, removes that error. Sharing the board on WhatsApp is how jewellers
already advertise the rate. No paid rate feed (ADR-021).

## Spec to check

| # | What | Source (design) | Check |
|---|---|---|---|
| R1 | Four rates, per gram: Gold 24K (999), Gold 22K (916), Gold 18K (750), Silver (999) | `RATES` | exact names, read back from the API |
| R2 | Phone header "Today's rate", sub "<Day> <d Mon> · used by every bill today" | `M.pRate` | text, date = server's today |
| R3 | Each row shows "Yesterday ₹X" and a numeric input (130 × 40) | `M.pRate` | computed size, `inputmode=decimal` |
| R4 | Note "Per gram. Type it each morning from your association's board or your bullion dealer. No rate feed is used." | `M.pRate` | exact words |
| R5 | Card "Share today's rate" / "Sends a picture of the rate board to WhatsApp." + Share on WhatsApp | `M.pRate` | opens the share sheet (no new dependency) |
| R6 | Dock: Same as yesterday (soft), Save rates (primary), in reach above the keyboard | `M.pRate` | position, 44 px targets |
| R7 | Desktop header "Today's rate" / "<Weekday> <d Mon> · bills issued today use these rates", actions Share on WhatsApp, Same as yesterday, Save rates | `M.dRate` | text, order |
| R8 | Desktop grid `420px minmax(0,1fr)`: rates card left, history right | `M.dRate` | computed column widths at 1280 and 1024 |
| R9 | Desktop rows "Down/Up ₹X from yesterday", input "₹ value / g" | `M.dRate` | sign and figure from the API |
| R10 | Note "Set at <time> by <name>. A bill keeps the rate it was issued at, even if you change it later today." | `M.dRate` | who/when read back |
| R11 | "Rate history" table, Month filter, columns Date, 22K, 24K, Silver, Set by ("Owner, 10:05 am") | `M.dRate` | rows read back, one per day |
| R12 | Only a jewellery shop sees it (Part G intro: own feature switch) | Part G / Part H | another kind gets 404 and no menu row |

## Behaviour and rules (to build)

- One row per shop per day (`tenant`, `date`, the four rates, set by, set at);
  saving again the same day replaces that day's values (the design's "even if you
  change it later today"). Past days are read-only history.
- **Same as yesterday** fills the inputs from the latest earlier day; it does
  not save until Save rates.
- A rate must be a positive amount with at most two decimals; empty is allowed
  for a metal the shop doesn't sell (it shows "—" in history).
- Feature key `shop.features.rates` (the name Part H proposes), on by default only for jewellery.
- Permission: setting rates is the owner's/manager's; staff can read.
- "A bill keeps the rate it was issued at" is G2's (the jewellery bill copies
  the rate onto the bill). G1 only stores and serves the day's rate.

## Conflicts listed (not chosen silently)

1. The mock's purity set is fixed at four. A shop selling 14K or platinum has
   nowhere to type it. **Built as designed (four);** more purities wait for
   the owner.
2. "Share on WhatsApp" sends a *picture*. Rendering an image needs either a
   canvas drawing (no dependency) or a new library. **Planned: canvas plus the
   browser's share sheet**, with a text fallback where image sharing isn't
   supported.

## Conflicts found while building (listed for the owner)

3. **Phone header Back arrow.** `M.pRate` draws Back beside the title. No Shop
   page opened from More has its own Back on a phone (the top bar and bottom bar
   do that job); adding it to this page alone would make it the odd one out.
   Not added; the owner's call.
4. **1024 px has no mock.** The design draws 1280 only. At 1024 the history's
   five money columns cut in 300 px, so below 1280 the history sits under the
   rates card (card keeps 420 px).
5. **320 px dock.** At 320 the two dock buttons drop to 14 px text so Save
   rates stays on screen; 390 and up keep the design's 46 px / 15 px.
6. **Button type.** The design's buttons are 14 px / 600 (desktop) and
   46 px / 15 px (phone bar). Ours come from the shared button token,
   16–17 px / 700, and the documented 44 px `lg` (DESIGN-SYSTEM.md), on every
   screen. Heights match on desktop (40 px). Changing the type here alone
   would make this one screen differ; changing it everywhere is the owner's
   call.
7. **Money box look.** The design writes "₹12,710 / g" right-aligned; the
   shared `UbMoneyInput` keeps ₹ at the left and has no "/ g" suffix. Not
   changed for one screen.
8. **History bar.** The design's history bar has a search field beside
   "Month"; with one row a day, a month is at most 31 rows, so only the month
   picker is built. Listed in case the owner wants it.

## Next steps (as written before building)

1. Backend: model + migration, `GET/PUT /shop/rates/today`, `GET /shop/rates?month=`,
   feature key, permission, tests.
2. Frontend: route `/rates`, menu row gated by the key, slice + service, phone
   and desktop compositions.
3. `e2e/g1-rate.mjs`: measure, read back with a `--skew`, LOOK at every size,
   theme and language; monkey; b-regression.

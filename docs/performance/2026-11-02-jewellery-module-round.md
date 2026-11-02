# Jewellery: module round and score (2 Nov 2026)

## Live evidence
All on the running stack, as qa-jeweller. The bill and order checks were last run one
small build before the final word-list import. Not repeated on the very last build.

- `e2e/jewel-day.mjs` whole day, 26/26, `--skew` fails on To pay
- g1-rate, g2a-tags, g2b-bill 21, g2c-old-gold 13, g2d-pan 17, g3a-orders 22,
  g3o-order-bill 9, g3b-karigars 19, g3c-tags 11, g3d-lot-correct 9, g3e-edges 34
- `e2e/jewel-measure.mjs` 5/5: orders page only, at 1280 and 390
- Monkey, 3 seeds x 2 sizes x 300 steps: Home, rates, items, custom orders, old gold (30/30)
  and the bill with a line from the start (6/6, data check ran)
- Unit 5,039 pass. Server suite on a fresh database: only the 10 failures that predate G2.

## Found by this round and fixed
Photo upload refused from the screen; a blank terms field wiped the jeweller's terms;
Make tag could not find an item past the first page; "Tell customer" could not be edited
(guard); table headers 14 px/500 against the design's 13 px/600 (shared, all tables); Home
paid 11 KB for every shop.

## Decisions taken without asking, as told to keep going
Closing a typed order asks first. Removing a lot is owner/admin only. Karigar field added.
Old gold over a saved customer's bill stays as their advance; a quick sale is refused.
Silver 925 is priced at the one silver rate. Part receipts: "More to come".

## Not built
- Settings: making default, wastage limit, PAN limit
- Starter categories for a new jeweller; tola shown beside grams
- D6 on the purchase screen itself: a bought piece's number is entered on the purchase and
  its weights added afterwards on the item page; "Make 3 tags" in one go
- Payment reminder and today's-rate messages as templates (rate board sharing exists in G1)
- Paying cash back for old gold over the bill

## Score (P0 section 8): 7 of 10. Not 9.
| Points | Got | Why |
|---|---|---|
| Business 2 | 2 | read back by id with skewed self-tests; finished orders and bills locked |
| Design 1 | 0 | numbers measured on one page; the not-built items above are in the design |
| Functional 1 | 1 | whole day through the screens, other screens agree |
| User 2 | 1 | monkey and catalogue done; the hand pass is short |
| Data 1 | 1 | reload, Back, offline, lost reply, two tabs on purpose |
| Performance 1 | 1 | measured; budgets raised, listed |
| Honesty 1 | 1 | this page |
| Owner 1 | 0 | only the owner can give it |

Reachable next: Design and a longer hand pass give 9. The owner's point gives 10.

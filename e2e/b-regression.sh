#!/usr/bin/env bash
# §10 regression of every delivered Shop piece's harness, one after another,
# against E2E_BASE. Each run's log: $OUT/<name>.log; one line per harness here.
OUT=${OUT:-/tmp/e2e-shots/b-thread/reg}
mkdir -p "$OUT"
cd "$(dirname "$0")/.."
run() {
  local name=$1; shift
  node e2e/"$@" > "$OUT/$name.log" 2>&1
  echo "$name exit $? :: $(tail -1 "$OUT/$name.log")"
}
run a3-customer-box-look a3-customer-box-look.mjs
run a3-functional a3-functional.mjs
run a4-money a4-money.mjs
run a4-remove-undo a4-remove-undo.mjs
run a4-functional a4-functional.mjs
run a4-edges-390 a4-edges.mjs --width=390
run a4-edges-1280 a4-edges.mjs --width=1280
run a5-measure a5-measure.mjs
run a6-forms a6-forms.mjs
run a7-measure a7-measure.mjs
run a8-first-tap a8-first-tap.mjs
run c1-scan c1-scan.mjs
run c2-find c2-find.mjs
run c3-count c3-count.mjs
# B's own (sign-up harnesses b1-signup / b1-edges spend the DB-backed
# register_ip budget, so they run on their own, not in every regression).
run b1-pick b1-pick.mjs
run b2-menus b2-menus.mjs
run b2-edges b2-edges.mjs
run b3-features b3-features.mjs
run c-journey c-journey.mjs
run d1-units d1-units.mjs
run d1-parts d1-parts.mjs
run d1-transfer d1-transfer.mjs
run d2-variants d2-variants.mjs
run d2-labels d2-labels.mjs
run d3-imei d3-imei.mjs
run d4-batches d4-batches.mjs
run d5-eway d5-eway.mjs
run d6-addons d6-addons.mjs
run d12-strip d12-strip.mjs
run d13-docs d13-docs.mjs
run d14-print d14-print.mjs
run d-edges d-edges.mjs
run d-look d-look.mjs
run ad-certify ad-certify.mjs
run ad-onboard ad-onboard.mjs
# Part G
run g1-rate g1-rate.mjs
run g2a-tags g2a-tags.mjs
run g2b-bill g2b-bill.mjs
run g2c-old-gold g2c-old-gold.mjs
run g2d-pan g2d-pan.mjs
run g3a-orders g3a-orders.mjs
run g3b-karigars g3b-karigars.mjs
run g3c-tags g3c-tags.mjs
run g3d-lot-correct g3d-lot-correct.mjs
run g3e-edges g3e-edges.mjs
run g3o-order-bill g3o-order-bill.mjs
run g4-finish g4-finish.mjs
run g4b-bought-cashback g4b-bought-cashback.mjs
run g5-repairs repairs.mjs
run g6-exchange exchange.mjs
run g7-sites sites.mjs
run g8-vehicles vehicles.mjs
run g9-schemes schemes.mjs
run g10-cafe-orders cafe-orders.mjs
run g11-phone-orders phone-orders.mjs
run g12-other-look g12-other-look.mjs
run g-day g-day.mjs
# Shop round (11 Nov): the day book and the jewellery day were outside the
# regression and went stale unseen; they run with every piece now.
run day-book day-book.mjs
run jewel-day jewel-day.mjs

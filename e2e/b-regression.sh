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

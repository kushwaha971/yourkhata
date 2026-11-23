#!/usr/bin/env bash
# Usage: plab.sh <list id> <list name>
export NODE_PATH=$(npm root -g)
D=/home/claude/yourkhata/docs/performance/data/2026-10-24-price-lists
for round in 1 2; do for side in old new; do
  if [ $side = old ]; then dir=/tmp/claude-0/wt-old; else dir=/home/claude/yourkhata; fi
  (cd $dir && ./e2e/serve.sh >/dev/null 2>&1)
  node $D/plperf.mjs $D/pl-$side-$round.json "$1" "$2"
done; done
(cd /home/claude/yourkhata && ./e2e/serve.sh >/dev/null 2>&1)
echo AB_DONE

#!/usr/bin/env bash
# Usage: ccab.sh — old (dcaddbc worktree) and new alternately, 2 rounds.
export NODE_PATH=$(npm root -g)
D=/home/claude/yourkhata/docs/performance/data/2026-10-24-cash-count
for round in ${ROUNDS:-1 2}; do for side in old new; do
  if [ $side = old ]; then dir=/tmp/claude-0/wt-old; else dir=/home/claude/yourkhata; fi
  (cd $dir && ./e2e/serve.sh >/dev/null 2>&1)
  node $D/ccperf.mjs $D/cc-$side-$round.json
done; done
(cd /home/claude/yourkhata && ./e2e/serve.sh >/dev/null 2>&1)
echo AB_DONE

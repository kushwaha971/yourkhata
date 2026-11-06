#!/usr/bin/env bash
# Usage: ssab.sh <partyId> — c4f37e1 (worktree) and this build alternately.
export NODE_PATH=$(npm root -g)
D=/home/claude/yourkhata/docs/performance/data/2026-10-25-shop-settlement
for round in ${ROUNDS:-1 2}; do for side in old new; do
  if [ $side = old ]; then dir=/tmp/claude-0/wt-old; else dir=/home/claude/yourkhata; fi
  pgrep -f "[n]ext-server \(v" | xargs -r kill; sleep 1
  (cd $dir && ./e2e/serve.sh >/dev/null 2>&1)
  node $D/ssperf.mjs $D/ss-$side-$round.json "$1"
done; done
pgrep -f "[n]ext-server \(v" | xargs -r kill; sleep 1
(cd /home/claude/yourkhata && ./e2e/serve.sh >/dev/null 2>&1)
echo AB_DONE

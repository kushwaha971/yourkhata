#!/usr/bin/env bash
# Serve the production build the way `output: standalone` requires.
#
# `next start` CANNOT serve this build — the standalone bundle is its own
# server and `next start` answers 500/text-plain for every chunk. The two
# copies below are the documented requirement: Next deliberately leaves
# `.next/static` and `public` out of the standalone output.
#
# `rm -rf` before each copy, because `cp -r src dst` when `dst` already exists
# copies INTO it — producing `.next/standalone/.next/static/static`, a server
# that 500s on every asset, and half an hour of looking at the wrong thing.
set -euo pipefail
# The repo is the parent of this script's folder, so the same script serves the
# cloud workspace (/home/claude/repo) and a checkout on the owner's Mac. Logs go
# to $UB_E2E_LOGS (default /tmp/claude-0); `setsid` is Linux-only, so it is used
# when present and plain `nohup` detaches otherwise.
REPO=$(cd "$(dirname "$0")/.." && pwd)
LOGS=${UB_E2E_LOGS:-/tmp/claude-0}
mkdir -p "$LOGS"
DETACH=$(command -v setsid || true)
FE=$REPO/frontend

# PORT lets several sessions serve their own builds side by side (A4 on 3000,
# A5 3001, A7 3002, A8 3003). Only what holds THIS port is stopped: a blanket
# pkill took down every other session's server with it.
PORT=${PORT:-3000}
# A stale `next-server` from an earlier session holds the port and serves an
# OLD build, which looks exactly like a broken new one.
lsof -ti "tcp:$PORT" -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null || true
sleep 2

rm -rf "$FE/.next/standalone/.next/static" "$FE/.next/standalone/public"
cp -r "$FE/.next/static" "$FE/.next/standalone/.next/static"
cp -r "$FE/public" "$FE/.next/standalone/public"

cd "$FE/.next/standalone"
PORT=$PORT HOSTNAME=0.0.0.0 $DETACH nohup node server.js > $LOGS/fe-run-$PORT.log 2>&1 < /dev/null &
sleep 7

# `sed -n 1p` rather than `head -1`: head exits after one line, `ls` then dies
# of SIGPIPE, and under `pipefail` the whole script exits 141 AFTER the server
# came up — a green stack reported as a failure.
CHUNK=$(ls "$FE/.next/static/chunks" | grep '\.js$' | sed -n 1p)
printf 'page   %s\n' "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$PORT/login)"
printf 'chunk  %s %s\n' \
  "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/_next/static/chunks/$CHUNK")" \
  "$(curl -s -o /dev/null -w '%{content_type}' "http://127.0.0.1:$PORT/_next/static/chunks/$CHUNK")"

#!/usr/bin/env bash
# DreamReel — Acceptance (E2E) test.
#
# Verifies after the per-user GMI-key architecture change that:
#   1. The local API can be started and serves /health
#   2. Every public route is wired (does not 500/404)
#   3. The dev-login + key-save + generate flow works in mock mode
#   4. AES-256-GCM encryption is in effect
#
# All output is mirrored to /tmp/dreamreel-acceptance.log so a CI
# failure can be diagnosed from that single file. The Acceptance
# job in .github/workflows/ci.yml uploads it as a workflow artifact.
#
# Full dream-generation E2E requires a real GMI key and is verified
# out-of-band via scripts/prod.sh verify against the deployed
# Cloudflare Worker.

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="$REPO_ROOT/apps/api"
B="http://localhost:8787"

LOG=/tmp/dreamreel-acceptance.log
: > "$LOG"

# Mirror every line of output to the log.
exec > >(tee -a "$LOG") 2>&1

banner() { echo; echo "── $1"; }

banner "0. Environment"
echo "  REPO_ROOT=$REPO_ROOT"
echo "  node:    $(node --version 2>/dev/null || echo 'missing')"
echo "  pnpm:    $(pnpm --version 2>/dev/null || echo 'missing')"
echo "  curl:    $(curl --version 2>/dev/null | head -1 || echo 'missing')"
echo "  sqlite3: $(command -v sqlite3 2>/dev/null || echo 'NOT installed')"
echo "  ffmpeg:  $(ffmpeg -version 2>/dev/null | head -1 || echo 'NOT installed')"
echo "  has tsx binary:  $(test -x "$API_DIR/node_modules/.bin/tsx" && echo yes || echo no)"

banner "1. Start API on :8787 (or reuse)"
NEED_START=0
APIPID=""
if ! curl -fsS -o /dev/null --max-time 2 "$B/health" 2>/dev/null; then
    NEED_START=1
    echo "  starting API ..."
    cd "$API_DIR"
    ( node --import tsx src/index.ts > /tmp/dreamreel-acceptance-api.log 2>&1 ) &
    APIPID=$!
    cd "$REPO_ROOT"
    started=0
    for i in $(seq 1 60); do
        sleep 0.5
        if curl -fsS -o /dev/null --max-time 2 "$B/health" 2>/dev/null; then
            started=1
            echo "  API is up (after $((i*500))ms)."
            break
        fi
    done
    if [[ $started -eq 0 ]]; then
        echo "  ERROR: API did not start within 30s. Tail of log:"
        tail -60 /tmp/dreamreel-acceptance-api.log || true
        if [[ -n "$APIPID" ]]; then kill "$APIPID" 2>/dev/null || true; fi
        echo "  See $LOG for the full transcript."
        exit 1
    fi
else
    echo "  API already running on :8787."
fi

banner "2. API checks"
bash "$REPO_ROOT/scripts/test-api.sh"

banner "3. Frontend page reachability (informational)"
WEB="http://localhost:3000"
for path in / /me; do
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$WEB$path" 2>/dev/null || echo 000)
    if [[ "$code" == "200" ]]; then
        echo "  ✓ $path -> 200"
    else
        echo "  ⚠ $path -> $code (web not running; informational only)"
    fi
done

# Cleanup
if [[ "$NEED_START" -eq 1 && -n "$APIPID" ]]; then
    kill "$APIPID" 2>/dev/null || true
    wait "$APIPID" 2>/dev/null || true
fi

banner "Done"
echo "  Full log: $LOG"
echo "===================================================="
echo "  Acceptance complete."
echo "===================================================="

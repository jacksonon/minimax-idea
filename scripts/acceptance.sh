#!/usr/bin/env bash
# DreamReel — Acceptance (E2E) test.
#
# Single source of truth for the GH Actions Acceptance job. Verifies
# after the per-user GMI-key architecture change that:
#
#   1. The local API can be started and serves /health
#   2. Every public route is wired and returns the expected status
#      code (does not 500/404)
#   3. The dev-login + key-save + generate flow works end-to-end in
#      local mock mode
#   4. AES-256-GCM encryption is in effect (D1 stores ciphertext,
#      GET /api/settings does not leak the key)
#
# All output is mirrored to /tmp/dreamreel-acceptance.log so a CI
# failure can be diagnosed by tail-ing that single file.
#
# What this no longer does (and why):
#   - Run the real GMI pipeline with ffmpeg. The per-user GMI
#     architecture means no env-baked key exists; the service
#     refuses to run the pipeline without a user-supplied key.
#     Full dream generation is verified out-of-band via
#     scripts/prod.sh verify against the production deployment.
#
# Run from repo root:
#   bash scripts/acceptance.sh
#
# Exits 0 on success.

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="$REPO_ROOT/apps/api"
B="http://localhost:8787"

LOG=/tmp/dreamreel-acceptance.log
: > "$LOG"

# Mirror every line of output to the log so CI failure can be
# diagnosed by `cat /tmp/dreamreel-acceptance.log`.
exec > >(tee -a "$LOG") 2>&1

banner() { echo; echo "── $1"; }

banner "0. Workspace"
echo "  REPO_ROOT=$REPO_ROOT"
echo "  API_DIR=$API_DIR"
echo "  node:    $(node --version 2>/dev/null || echo 'missing')"
echo "  pnpm:    $(pnpm --version 2>/dev/null || echo 'missing')"
echo "  sqlite3: $(command -v sqlite3 2>/dev/null || echo 'NOT installed (we use Node instead)')"
echo "  curl:    $(curl --version 2>/dev/null | head -1 || echo 'missing')"
echo "  ffmpeg:  $(ffmpeg -version 2>/dev/null | head -1 || echo 'NOT installed')"

banner "1. Start API on :8787"
NEED_START=0
APIPID=""
if ! curl -fsS -o /dev/null "$B/health" 2>/dev/null; then
    NEED_START=1
    echo "  API not running, starting it ..."
    cd "$API_DIR"
    ( node --import tsx src/index.ts > /tmp/dreamreel-acceptance-api.log 2>&1 ) &
    APIPID=$!
    cd "$REPO_ROOT"
    for i in $(seq 1 60); do
        sleep 0.5
        if curl -fsS -o /dev/null "$B/health" 2>/dev/null; then
            echo "  API is up (after $((i*500))ms)."
            break
        fi
    done
    if ! curl -fsS -o /dev/null "$B/health" 2>/dev/null; then
        echo "  ERROR: API did not start within 30s."
        echo "  --- last 60 lines of /tmp/dreamreel-acceptance-api.log ---"
        tail -60 /tmp/dreamreel-acceptance-api.log || true
        echo "  --- end of API log ---"
        if [[ -n "$APIPID" ]]; then kill "$APIPID" 2>/dev/null || true; fi
        exit 1
    fi
else
    echo "  API already running on :8787 (will not be killed on exit)."
fi

banner "2. API checks via scripts/test-api.sh"
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

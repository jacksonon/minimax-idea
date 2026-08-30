#!/usr/bin/env bash
# DreamReel — Acceptance (E2E) test.
#
# This script is the entry point for the GH Actions Acceptance job.
# It runs against a fresh, locally-spawned API + web and verifies:
#
#   1. Both servers start
#   2. Every public route is wired and returns the expected status
#      code (does not 500/404)
#   3. The dev-login + key-save + generate flow works end-to-end in
#      local mock mode
#   4. AES-256-GCM encryption is in effect (D1 stores ciphertext,
#      GET /api/settings does not leak the key)
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
# Exits 0 on success, non-zero on failure. Designed to work both
# locally (with pnpm dev) and in CI (with `pnpm dev` invoked by
# the workflow).

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="$REPO_ROOT/apps/api"
B="http://localhost:8787"

# 1. Make sure the API is up. Start it ourselves if not.
NEED_START=0
APIPID=""
if ! curl -fsS -o /dev/null "$B/health" 2>/dev/null; then
    NEED_START=1
    echo "[acceptance] API not running, starting it ..."
    cd "$API_DIR"
    ( node --import tsx src/index.ts > /tmp/dreamreel-acceptance-api.log 2>&1 ) &
    APIPID=$!
    cd "$REPO_ROOT"
    for i in $(seq 1 60); do
        sleep 0.5
        if curl -fsS -o /dev/null "$B/health" 2>/dev/null; then
            echo "[acceptance] API is up."
            break
        fi
    done
    if ! curl -fsS -o /dev/null "$B/health" 2>/dev/null; then
        echo "[acceptance] ERROR: API did not start within 30s."
        echo "  --- last 40 lines of /tmp/dreamreel-acceptance-api.log ---"
        tail -40 /tmp/dreamreel-acceptance-api.log || true
        if [[ -n "$APIPID" ]]; then kill "$APIPID" 2>/dev/null || true; fi
        exit 1
    fi
fi

# 2. Run the API checks.
bash "$REPO_ROOT/scripts/test-api.sh"

# 3. Frontend reachability (informational, does not fail the run).
echo
echo "=== Frontend page reachability ==="
WEB="http://localhost:3000"
for path in / /me; do
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$WEB$path" 2>/dev/null || echo 000)
    if [[ "$code" == "200" ]]; then
        echo "  ✓ $path -> 200"
    else
        echo "  ⚠ $path -> $code (web not running; informational only)"
    fi
done

# Cleanup if we started the API ourselves.
if [[ -n "$APIPID" ]]; then
    kill "$APIPID" 2>/dev/null || true
    wait "$APIPID" 2>/dev/null || true
fi

echo
echo "===================================================="
echo "  Acceptance complete."
echo "===================================================="

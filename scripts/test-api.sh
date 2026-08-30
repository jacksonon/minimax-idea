#!/usr/bin/env bash
# Local end-to-end test of the API. Spins up the API on :8787 (if
# not already running), exercises every route, and asserts that
# the response matches what production Cloudflare Workers will see.
#
# Run from repo root:
#   bash scripts/test-api.sh
#
# Exits 0 on success, non-zero on any failure. The script is safe
# to re-run: each invocation uses a fresh dev session cookie and
# only writes to apps/api/dev.db (gitignored).

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="$REPO_ROOT/apps/api"
B="http://localhost:8787"

# 1. Make sure the API is running. If not, start it in the background.
NEED_START=0
if ! curl -fsS -o /dev/null "$B/health" 2>/dev/null; then
    NEED_START=1
    echo "Starting API on :8787 ..."
    cd "$API_DIR"
    pnpm dev > /tmp/dreamreel-api.log 2>&1 &
    APIPID=$!
    cd "$REPO_ROOT"
    # Wait up to 15s for /health to come up
    for i in $(seq 1 30); do
        sleep 0.5
        if curl -fsS -o /dev/null "$B/health" 2>/dev/null; then
            echo "API is up."
            break
        fi
    done
    if ! curl -fsS -o /dev/null "$B/health" 2>/dev/null; then
        echo "ERROR: API did not start within 15s. See /tmp/dreamreel-api.log."
        exit 1
    fi
fi

# 2. Reset dev DB so the test is deterministic.
#    (Only if we own the DB; if you have real data, comment this out.)
if [[ "${DREAMREEL_KEEP_DB:-0}" != "1" ]]; then
    sqlite3 "$API_DIR/dev.db" "DELETE FROM user_settings; DELETE FROM sessions; DELETE FROM users; DELETE FROM dreams;" >/dev/null 2>&1 || true
fi

pass=0; fail=0
check() {
    local name="$1"; local expected="$2"; local got="$3"
    if [[ "$got" == *"$expected"* ]]; then
        echo "  ✓ $name"; pass=$((pass+1))
    else
        echo "  ✗ $name"
        echo "      expected: $expected"
        echo "      got:      $got"
        fail=$((fail+1))
    fi
}

echo
echo "=== Local API end-to-end ==="

# Health
g=$(curl -fsS $B/health)
check "/health ok=true" '"ok":true' "$g"
check "/health ai=mock (or gmi if you set AI_PROVIDER=gmi)" '"ai":' "$g"

# GitHub OAuth endpoint
s=$(curl -sS -o /tmp/prod-verify.body -w '%{http_code}' $B/api/auth/github)
check "/api/auth/github returns 503 when client id is missing" "503" "$s"
check "/api/auth/github body mentions GitHub" "GitHub" "$(cat /tmp/prod-verify.body)"

# Anonymous /me
g=$(curl -fsS $B/api/auth/me)
check "/api/auth/me returns user:null when anonymous" '"user":null' "$g"

# Unauthenticated generation
g=$(curl -sS -X POST -H 'Content-Type: application/json' -d '{"transcript":"e2e test"}' $B/api/dreams/generate)
check "POST /api/dreams/generate anon → unauthenticated" "unauthenticated" "$g"

# Dev login (only available in non-production)
rm -f /tmp/e2e.cookies
curl -fsS -c /tmp/e2e.cookies -X POST $B/api/auth/dev-login -H 'Content-Type: application/json' -d '{"handle":"e2e"}' -o /dev/null

# Generate in mock mode (no key required)
g=$(curl -sS -b /tmp/e2e.cookies -X POST -H 'Content-Type: application/json' -d '{"transcript":"my e2e test dream"}' $B/api/dreams/generate)
check "POST /api/dreams/generate in mock mode" "dream_id" "$g"

# Save a key
g=$(curl -sS -b /tmp/e2e.cookies -X PUT $B/api/settings -H 'Content-Type: application/json' -d '{"gmiApiKey":"sk-test-e2e-fake","gmiBaseUrl":"https://api.gmicloud.ai"}')
check "PUT /api/settings saves (returns hasKey:true)" "hasKey" "$g"

# D1: ciphertext not plaintext
ENC=$(sqlite3 "$API_DIR/dev.db" "SELECT gmi_api_key FROM user_settings LIMIT 1;")
check "D1 stores ciphertext (has {1} separator)" "{1}" "$ENC"
if echo "$ENC" | grep -q "sk-test-e2e-fake"; then
    echo "  ✗ FAIL: D1 stored PLAINTEXT key (encryption broken)"; fail=$((fail+1))
else
    echo "  ✓ D1 does NOT contain plaintext key"; pass=$((pass+1))
fi

# GET settings does not return the key
g=$(curl -fsS -b /tmp/e2e.cookies $B/api/settings)
if echo "$g" | grep -q "sk-test-e2e-fake"; then
    echo "  ✗ FAIL: GET /api/settings leaked the plaintext key"; fail=$((fail+1))
else
    echo "  ✓ GET /api/settings does not leak the plaintext key"; pass=$((pass+1))
fi

echo
if [[ $fail -eq 0 ]]; then
    echo "All $pass checks passed."
    if [[ $NEED_START -eq 1 ]]; then
        echo
        echo "(API was started by this script; it is still running in the background."
        echo " Stop it with: kill $APIPID)"
    fi
else
    echo "$fail of $((pass+fail)) failed."
    exit 1
fi

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

# 1. Make sure the API is running. The caller is expected to have
#    started it. If not, we'll start it ourselves and clean up.
#    In CI, scripts/acceptance.sh starts it before calling us.
NEED_START=0
APIPID=""
if ! curl -fsS -o /dev/null "$B/health" 2>/dev/null; then
    NEED_START=1
    echo "API not running, starting it ..."
    cd "$API_DIR"
    ( node --import tsx src/index.ts > /tmp/dreamreel-api.log 2>&1 ) &
    APIPID=$!
    cd "$REPO_ROOT"
    for i in $(seq 1 60); do
        sleep 0.5
        if curl -fsS -o /dev/null "$B/health" 2>/dev/null; then
            break
        fi
    done
    if ! curl -fsS -o /dev/null "$B/health" 2>/dev/null; then
        echo "ERROR: API did not start within 30s. See /tmp/dreamreel-api.log."
        if [[ -n "$APIPID" ]]; then kill "$APIPID" 2>/dev/null || true; fi
        exit 1
    fi
fi

# 2. Reset dev DB so the test is deterministic.
#    (Only if we own the DB; if you have real data, comment this out.)
#    Uses a one-shot Node script so we don't depend on the sqlite3
#    CLI being installed (CI runners don't ship it by default).
if [[ "${DREAMREEL_KEEP_DB:-0}" != "1" && -f "$API_DIR/dev.db" ]]; then
    cd "$API_DIR"
    node --import tsx -e "
      import('./src/db/index.js').then(async ({ getDb }) => {
        const db = getDb();
        await db.run('DELETE FROM user_settings');
        await db.run('DELETE FROM sessions');
        await db.run('DELETE FROM users');
        await db.run('DELETE FROM dreams');
        process.exit(0);
      }).catch((e) => { console.error('reset failed:', e); process.exit(1); });
    " 2>/dev/null || true
    cd "$REPO_ROOT"
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

# D1: ciphertext not plaintext. Use a one-shot Node script so
# we don't depend on the sqlite3 CLI being installed.
cd "$API_DIR"
ENC=$(node --import tsx -e "
  import('./src/db/index.js').then(async ({ getDb }) => {
    const db = getDb();
    const row = await db.first('SELECT gmi_api_key FROM user_settings LIMIT 1');
    process.stdout.write(row?.gmi_api_key ?? '');
    process.exit(0);
  }).catch((e) => { console.error(e); process.exit(1); });
" 2>/dev/null || echo "")
cd "$REPO_ROOT"
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
if [[ $fail -ne 0 ]]; then
    echo "$fail of $((pass+fail)) failed."
    # Clean up the API we started even on failure.
    if [[ "$NEED_START" -eq 1 && -n "$APIPID" ]]; then
        kill "$APIPID" 2>/dev/null || true
    fi
    exit 1
fi

echo "All $pass checks passed."

# If we started the API ourselves, leave it running for follow-up
# inspection unless DREAMREEL_STOP_API=1 is set.
if [[ "$NEED_START" -eq 1 && -n "$APIPID" ]]; then
    if [[ "${DREAMREEL_STOP_API:-0}" == "1" ]]; then
        kill "$APIPID" 2>/dev/null || true
    else
        echo
        echo "(API was started by this script; it is still running in"
        echo " the background (pid=$APIPID). Stop it with:"
        echo "   kill $APIPID"
        echo " or set DREAMREEL_STOP_API=1)"
    fi
fi

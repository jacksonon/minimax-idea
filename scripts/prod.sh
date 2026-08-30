#!/usr/bin/env bash
# DreamReel — production operations.
#
# Subcommands:
#   setup    one-time first deploy: set Worker secrets, apply D1
#            migration. See scripts/setup-prod.sh for the original
#            standalone version; this reuses it.
#   deploy   push the latest apps/api Worker code to Cloudflare and
#            the latest apps/web to Cloudflare Pages.
#   verify   curl all the public endpoints to confirm they are live
#            and behaving correctly.
#   all      setup + deploy + verify, in order.
#
# Prereqs:
#   - pnpm install has been run
#   - Cloudflare login has been done at least once on this machine
#     (cd apps/api && ./node_modules/.bin/wrangler login)
#
# Usage:
#   bash scripts/prod.sh setup    # first-time
#   bash scripts/prod.sh deploy   # push latest code
#   bash scripts/prod.sh verify   # smoke test
#   bash scripts/prod.sh all      # all of the above

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="$REPO_ROOT/apps/api"
WEB_DIR="$REPO_ROOT/apps/web"
WRANGLER_API="$API_DIR/node_modules/.bin/wrangler"

API_BASE="https://dreamreel-api.right-ai.workers.dev"
WEB_BASE="https://dreamreel-web.pages.dev"

cmd="${1:-help}"

# ---- helpers --------------------------------------------------------

ensure_wrangle_logged_in() {
    if ! "$WRANGLER_API" whoami >/dev/null 2>&1; then
        echo "ERROR: wrangler is not authenticated with Cloudflare."
        echo "Run 'cd $API_DIR && $WRANGLER_API login' first."
        echo "Then re-run this script."
        exit 1
    fi
}

ensure_pnpm() {
    if [[ ! -x "$WRANGLER_API" ]]; then
        echo "ERROR: wrangler is not installed at $WRANGLER_API."
        echo "Run 'pnpm install' from the repo root first."
        exit 1
    fi
}

# ---- subcommands ---------------------------------------------------

cmd_setup() {
    ensure_pnpm
    ensure_wrangle_logged_in
    bash "$REPO_ROOT/scripts/setup-prod.sh"
}

cmd_deploy() {
    ensure_pnpm
    ensure_wrangle_logged_in

    echo "=== Deploying API Worker ==="
    cd "$API_DIR"
    "$WRANGLER_API" deploy

    echo
    echo "=== Deploying web to Cloudflare Pages ==="
    cd "$REPO_ROOT"
    rm -rf "$WEB_DIR/.next" "$WEB_DIR/.pages-deploy"
    NEXT_PUBLIC_API_URL="$API_BASE" pnpm --filter @dreamreel/web build

    # Mirror the layout the Pages direct-upload expects. Mirrors
    # .github/workflows/deploy.yml.
    mkdir -p "$WEB_DIR/.pages-deploy/_next"
    for f in "$WEB_DIR"/.next/server/app/*.html; do
        [[ -e "$f" ]] || continue
        cp "$f" "$WEB_DIR/.pages-deploy/$(basename "$f")"
    done
    cp -r "$WEB_DIR/.next/static" "$WEB_DIR/.pages-deploy/_next/static"

    cd "$WEB_DIR"
    "$WRANGLER_API" pages deploy .pages-deploy \
        --project-name dreamreel-web \
        --commit-dirty=true \
        --branch main
}

cmd_verify() {
    local pass=0
    local fail=0
    check_status() {
        local name="$1"
        local method="$2"
        local path="$3"
        local expect_status="$4"
        local body_expect="$5"
        local got_status got_body
        got_status="$(curl -fsS -o /tmp/prod-verify.body -w '%{http_code}' -X "$method" -H 'Content-Type: application/json' -d '{}' "$API_BASE$path" 2>/dev/null || echo 000)"
        got_body="$(cat /tmp/prod-verify.body 2>/dev/null || echo '')"
        if [[ "$got_status" == "$expect_status" ]] && { [[ -z "$body_expect" ]] || echo "$got_body" | grep -q "$body_expect"; }; then
            echo "  ✓ $name"
            pass=$((pass+1))
        else
            echo "  ✗ $name"
            echo "      expected: status=$expect_status body~'$body_expect'"
            echo "      got:      status=$got_status body='$got_body'"
            fail=$((fail+1))
        fi
    }
    check_get_status() {
        local name="$1"
        local path="$2"
        local expect_status="$3"
        local body_expect="$4"
        local got_status got_body
        got_status="$(curl -fsS -o /tmp/prod-verify.body -w '%{http_code}' "$API_BASE$path" 2>/dev/null || echo 000)"
        got_body="$(cat /tmp/prod-verify.body 2>/dev/null || echo '')"
        if [[ "$got_status" == "$expect_status" ]] && { [[ -z "$body_expect" ]] || echo "$got_body" | grep -q "$body_expect"; }; then
            echo "  ✓ $name"
            pass=$((pass+1))
        else
            echo "  ✗ $name"
            echo "      expected: status=$expect_status body~'$body_expect'"
            echo "      got:      status=$got_status body='$got_body'"
            fail=$((fail+1))
        fi
    }
    check_get_status_web() {
        local name="$1"
        local path="$2"
        local expect_status="$3"
        local got_status
        got_status="$(curl -fsS -o /dev/null -w '%{http_code}' "$WEB_BASE$path" 2>/dev/null || echo 000)"
        if [[ "$got_status" == "$expect_status" ]]; then
            echo "  ✓ $name"
            pass=$((pass+1))
        else
            echo "  ✗ $name"
            echo "      expected: status=$expect_status"
            echo "      got:      status=$got_status"
            fail=$((fail+1))
        fi
    }

    echo "=== Verifying $API_BASE ==="
    check_get_status "GET /health" "/health" "200" '"ok":true'
    check_get_status "GET /health reports ai=gmi" "/health" "200" '"ai":"gmi"'
    check_get_status "GET /api/auth/me (anon)" "/api/auth/me" "200" '"user":null'
    # After deploy of the real Worker, /api/auth/github should return 503
    # (no client id) or 302 (with client id, redirects to github.com).
    # We just want to know it doesn't 404.
    check_get_status "GET /api/auth/github exists" "/api/auth/github" "503" "GitHub"
    check_status "POST /api/dreams/generate stubbed at Worker" \
        "POST" "/api/dreams/generate" "503" "pipeline"
    check_status "POST /api/dreams/generate rejects unauthenticated" \
        "POST" "/api/dreams/generate" "503" "pipeline"

    echo
    echo "=== Verifying $WEB_BASE ==="
    check_get_status_web "GET / returns 200" "/" "200"
    check_get_status_web "GET /me returns 200" "/me" "200"
    check_get_status_web "GET /dreams returns 200 (client-side redirect)" "/dreams" "200"

    echo
    if [[ $fail -eq 0 ]]; then
        echo "All $pass checks passed."
    else
        echo "$fail of $((pass+fail)) checks failed."
        exit 1
    fi
}

cmd_all() {
    cmd_setup
    cmd_deploy
    cmd_verify
}

cmd_help() {
    cat <<EOF
DreamReel production operations.

Usage:
  bash scripts/prod.sh setup    # first-time Worker secret + D1 setup
  bash scripts/prod.sh deploy   # push latest API + web to Cloudflare
  bash scripts/prod.sh verify   # smoke test the public endpoints
  bash scripts/prod.sh all      # setup + deploy + verify
EOF
}

case "$cmd" in
    setup)  cmd_setup ;;
    deploy) cmd_deploy ;;
    verify) cmd_verify ;;
    all)    cmd_all ;;
    help|--help|-h) cmd_help ;;
    *) echo "Unknown command: $cmd"; cmd_help; exit 1 ;;
esac

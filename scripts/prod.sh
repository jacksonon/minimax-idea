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
    check() {
        local name="$1"
        local cmd="$2"
        local expect="$3"
        local got
        got="$(eval "$cmd" 2>/dev/null || echo '__fail__')"
        if echo "$got" | grep -q "$expect"; then
            echo "  ✓ $name"
            pass=$((pass+1))
        else
            echo "  ✗ $name"
            echo "      expected to contain: $expect"
            echo "      got: $got"
            fail=$((fail+1))
        fi
    }

    echo "=== Verifying $API_BASE ==="
    check "GET /health" \
        "curl -fsSL $API_BASE/health" \
        '"ok":true'
    check "GET /health reports ai=gmi" \
        "curl -fsSL $API_BASE/health" \
        '"ai":"gmi"'
    check "GET /api/auth/me (anon)" \
        "curl -fsSL $API_BASE/api/auth/me" \
        '"user":null'
    check "GET /api/auth/github (no creds → 503)" \
        "curl -fsSL -o /dev/null -w '%{http_code}' $API_BASE/api/auth/github" \
        '^503$'
    check "POST /api/dreams/generate (no auth → 401)" \
        "curl -fsSL -X POST -H 'Content-Type: application/json' -d '{}' $API_BASE/api/dreams/generate" \
        'unauthenticated'
    check "POST /api/dreams/generate (no key → 503 stub, not 422)" \
        "curl -fsSL -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' $API_BASE/api/dreams/generate" \
        '^503$'

    echo
    echo "=== Verifying $WEB_BASE ==="
    check "GET / returns 200" \
        "curl -fsSL -o /dev/null -w '%{http_code}' $WEB_BASE/" \
        '^200$'
    check "GET /me returns 200" \
        "curl -fsSL -o /dev/null -w '%{http_code}' $WEB_BASE/me" \
        '^200$'
    check "GET /dreams returns 200 (client-side redirect)" \
        "curl -fsSL -o /dev/null -w '%{http_code}' $WEB_BASE/dreams" \
        '^200$'

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

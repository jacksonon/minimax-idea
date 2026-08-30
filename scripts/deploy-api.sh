#!/usr/bin/env bash
# DreamReel — deploy the API Worker.
#
# The Deploy GitHub Action only deploys apps/web to Pages. The API
# Worker (dreamreel-api) is deployed from this machine because the
# Cloudflare account's API token used by GitHub Actions only has
# Pages write scope, not Workers write scope.
#
# Prereqs:
#   - pnpm install has been run
#   - wrangler is authenticated (`./node_modules/.bin/wrangler login`)
#
# Usage:
#   bash scripts/deploy-api.sh

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="$REPO_ROOT/apps/api"
WRANGLER="$API_DIR/node_modules/.bin/wrangler"

cd "$API_DIR"

if [[ ! -x "$WRANGLER" ]]; then
    echo "ERROR: wrangler is not installed at $WRANGLER."
    echo "Run 'pnpm install' from the repo root first."
    exit 1
fi

if ! "$WRANGLER" whoami >/dev/null 2>&1; then
    echo "ERROR: wrangler is not authenticated with Cloudflare."
    echo "Run 'cd $API_DIR && $WRANGLER login' first."
    exit 1
fi

echo "Deploying API Worker ..."
"$WRANGLER" deploy

echo
echo "Verifying /health on the deployed Worker ..."
HEALTH_URL="https://dreamreel-api.right-ai.workers.dev/health"
HEALTH="$(curl -fsSL "$HEALTH_URL" 2>/dev/null || echo 'unreachable')"
echo "  $HEALTH_URL"
echo "  $HEALTH"

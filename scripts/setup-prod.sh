#!/usr/bin/env bash
# DreamReel — one-shot production setup. Run this once per environment.
#
# What it does (in order):
#   1. Generates a fresh GMI_ENC_KEY
#   2. Sets GMI_ENC_KEY, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET as
#      Cloudflare Worker secrets via wrangler
#   3. Applies the D1 migration that adds key_encrypted
#   4. Verifies the deploy via /health
#
# You only need to provide the two GitHub OAuth values when prompted.
# Get them at https://github.com/settings/developers — the OAuth app
# callback URL must be https://dreamreel-api.right-ai.workers.dev/api/auth/github/callback
#
# Prereqs:
#   - pnpm install has been run (so node_modules/.bin/wrangler exists)
#   - You can run `pnpm exec wrangler whoami` without it asking for
#     auth — i.e. you've already done `wrangler login` once on this
#     machine.
#
# Usage:
#   bash scripts/setup-prod.sh
#
# Re-running is safe; wrangler secret put overwrites existing secrets.

set -e

# Find the repo root no matter where the script is invoked from.
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="$REPO_ROOT/apps/api"

cd "$API_DIR"

# Sanity check
if [[ ! -x node_modules/.bin/wrangler ]]; then
    echo "ERROR: wrangler is not installed in $API_DIR."
    echo "Run 'pnpm install' from the repo root first."
    exit 1
fi

WRANGLER=(pnpm exec wrangler)

# Confirm we're logged in to Cloudflare. If not, give a single hint
# and bail.
if ! "${WRANGLER[@]}" whoami >/dev/null 2>&1; then
    echo "ERROR: wrangler is not authenticated with Cloudflare."
    echo "Run 'cd $API_DIR && pnpm exec wrangler login' first."
    echo "Then re-run this script."
    exit 1
fi

# 1. Generate GMI_ENC_KEY (32 random bytes, base64 encoded)
GMI_ENC_KEY="$(openssl rand -base64 32)"
echo
echo "Generated GMI_ENC_KEY (32 bytes, base64):"
echo "  $GMI_ENC_KEY"
echo

# 2. Push secrets. `wrangler secret put` reads the value from stdin
#    when given `--` and no positional arg, or from a heredoc. We
#    use a here-string so the value never lands in a tempfile.
echo "[1/4] Setting GMI_ENC_KEY ..."
"$API_DIR"/node_modules/.bin/wrangler secret put GMI_ENC_KEY <<<"$GMI_ENC_KEY" >/dev/null

# GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are supplied by the
# operator. Read them interactively (no echo so the secret doesn't
# leak into scrollback).
echo
echo "[2/4] GITHUB_CLIENT_ID"
echo "  Get this from https://github.com/settings/developers"
printf "  paste here: "
read -r GITHUB_CLIENT_ID
if [[ -z "$GITHUB_CLIENT_ID" ]]; then
    echo "ERROR: empty GITHUB_CLIENT_ID, aborting."
    exit 1
fi
"$API_DIR"/node_modules/.bin/wrangler secret put GITHUB_CLIENT_ID <<<"$GITHUB_CLIENT_ID" >/dev/null

echo
echo "[3/4] GITHUB_CLIENT_SECRET"
printf "  paste here: "
read -rs GITHUB_CLIENT_SECRET
echo
if [[ -z "$GITHUB_CLIENT_SECRET" ]]; then
    echo "ERROR: empty GITHUB_CLIENT_SECRET, aborting."
    exit 1
fi
"$API_DIR"/node_modules/.bin/wrangler secret put GITHUB_CLIENT_SECRET <<<"$GITHUB_CLIENT_SECRET" >/dev/null

# 4. Apply D1 migration. wrangler will prompt to confirm; we pipe
#    'y' so the script runs unattended.
echo
echo "[4/4] Applying D1 migration ..."
printf 'y\n' | "${WRANGLER[@]}" d1 migrations apply dreamreel-db

# 5. Verify
echo
echo "Verifying /health on the deployed Worker ..."
HEALTH_URL="https://dreamreel-api.right-ai.workers.dev/health"
HEALTH="$(curl -fsSL "$HEALTH_URL" 2>/dev/null || echo 'unreachable')"
echo "  $HEALTH_URL"
echo "  $HEALTH"

if echo "$HEALTH" | grep -q '"ai":"gmi"'; then
    echo
    echo "Setup complete. The production Worker is healthy and AI is 'gmi'."
    echo
    echo "Next:"
    echo "  1. Open https://dreamreel-web.pages.dev/me?tab=key"
    echo "  2. Paste your own GMI API key (the one from console.gmicloud.ai)"
    echo "  3. Go back to the home page and record a dream — it'll bill your"
    echo "     own GMI account, not the host's."
else
    echo
    echo "Setup pushed, but the health check did not return ai=gmi."
    echo "If the response above shows 'ai: unconfigured' or is unreachable,"
    echo "wait a moment and re-run this script, or check the Worker logs:"
    echo "  cd $API_DIR && pnpm exec wrangler tail"
fi

#!/usr/bin/env bash
# DreamReel — one-shot production setup. Run this once per environment.
#
# What it does (in order):
#   1. Generates a fresh GMI_ENC_KEY
#   2. Sets GMI_ENC_KEY, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET as
#      Cloudflare Worker secrets via wrangler (3 calls — wrangler's
#      CLI requires one call per secret)
#   3. Applies the D1 migration that adds key_encrypted
#   4. Verifies the deploy via /health
#
# You only need to provide the two GitHub OAuth values when prompted.
# Get them at https://github.com/settings/developers — the OAuth app
# callback URL must be https://dreamreel-api.right-ai.workers.dev/api/auth/github/callback
#
# Prereqs:
#   - pnpm install has been run (so node_modules/.bin/wrangler exists
#     in apps/api). The script invokes wrangler via its full path
#     so you don't need it on your global PATH.
#   - You have run `pnpm exec wrangler login` once on this machine
#     so wrangler is authenticated with Cloudflare. The script
#     checks this and bails with a clear message if not.
#
# Usage:
#   bash scripts/setup-prod.sh
#
# Re-running is safe; wrangler secret put overwrites existing values.

set -e

# Find the repo root no matter where the script is invoked from.
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="$REPO_ROOT/apps/api"
WRANGLER="$API_DIR/node_modules/.bin/wrangler"

cd "$API_DIR"

# Sanity check
if [[ ! -x "$WRANGLER" ]]; then
    echo "ERROR: wrangler is not installed at $WRANGLER."
    echo "Run 'pnpm install' from the repo root first."
    exit 1
fi

# Confirm we're logged in to Cloudflare. If not, give a single hint
# and bail.
if ! "$WRANGLER" whoami >/dev/null 2>&1; then
    echo "ERROR: wrangler is not authenticated with Cloudflare."
    echo "Run 'cd $API_DIR && $WRANGLER login' first."
    echo "Then re-run this script."
    exit 1
fi

# 1. Generate GMI_ENC_KEY (32 random bytes, base64 encoded)
GMI_ENC_KEY="$(openssl rand -base64 32)"
echo
echo "Generated GMI_ENC_KEY (32 bytes, base64):"
echo "  $GMI_ENC_KEY"
echo

# 2. Push the auto-generated secret. The other two are read from
#    the operator's terminal. `wrangler secret put` reads the value
#    from stdin, so we pipe the value in (never lands in a tempfile).
#    The 'silent' suppression keeps the table-of-secrets noise out
#    of the terminal.
echo "[1/4] Setting GMI_ENC_KEY ..."
"$WRANGLER" secret put GMI_ENC_KEY <<<"$GMI_ENC_KEY" >/dev/null

# 3. Read the two GitHub OAuth values from the operator.
echo
echo "[2/4] GITHUB_CLIENT_ID"
echo "  Get this from https://github.com/settings/developers"
printf "  paste here: "
read -r GITHUB_CLIENT_ID
if [[ -z "$GITHUB_CLIENT_ID" ]]; then
    echo "ERROR: empty GITHUB_CLIENT_ID, aborting."
    exit 1
fi
"$WRANGLER" secret put GITHUB_CLIENT_ID <<<"$GITHUB_CLIENT_ID" >/dev/null

echo
echo "[3/4] GITHUB_CLIENT_SECRET (input is hidden)"
printf "  paste here: "
read -rs GITHUB_CLIENT_SECRET
echo
if [[ -z "$GITHUB_CLIENT_SECRET" ]]; then
    echo "ERROR: empty GITHUB_CLIENT_SECRET, aborting."
    exit 1
fi
"$WRANGLER" secret put GITHUB_CLIENT_SECRET <<<"$GITHUB_CLIENT_SECRET" >/dev/null

# 4. Apply D1 migration. wrangler will prompt to confirm; we pipe
#    'y' so the script runs unattended.
echo
echo "[4/4] Applying D1 migration ..."
printf 'y\n' | "$WRANGLER" d1 migrations apply dreamreel-db

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
    echo "  $WRANGLER tail"
fi

#!/usr/bin/env bash
# wrangler shim — runs wrangler inside apps/api without bouncing out of
# the workspace root (which trips wrangler's "workspace detection").
#
# Usage: scripts/wrangler.sh <args>...

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$REPO_ROOT/apps/api"

if [ ! -f "$APP_DIR/wrangler.toml" ]; then
  echo "wrangler.toml not found at $APP_DIR/wrangler.toml" >&2
  exit 1
fi

# Hand wrangler a path inside apps/api so it doesn't try to be clever
# about the parent pnpm workspace.
exec node "$APP_DIR/node_modules/wrangler/bin/wrangler.js" \
  --config "$APP_DIR/wrangler.toml" \
  --cwd "$APP_DIR" \
  "$@"

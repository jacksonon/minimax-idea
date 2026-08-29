#!/usr/bin/env bash
# Build and deploy the Web app to Cloudflare Pages (static-only).
# Dynamic routes (/dreams/[id], /share/[token]) require a real Next.js
# deployment via @cloudflare/next-on-pages; this script only ships the
# pre-rendered static pages plus their JS/CSS assets.

set -e
cd "$(dirname "$0")/.."

REPO_ROOT="$(pwd)"
APP_DIR="$REPO_ROOT/apps/web"
WRANGLER="$REPO_ROOT/apps/api/node_modules/wrangler/bin/wrangler.js"

echo "→ Building $APP_DIR…"
( cd "$APP_DIR" && npx next build )

echo "→ Assembling static deploy dir…"
rm -rf "$APP_DIR/.pages-deploy"
mkdir -p "$APP_DIR/.pages-deploy"
# Copy every prerendered static page (anything that ends in .html in
# the app/ output, except the dynamic route subdirs like [id] and [token]).
for f in "$APP_DIR"/.next/server/app/*.html; do
  name=$(basename "$f")
  cp "$f" "$APP_DIR/.pages-deploy/$name"
done
mkdir -p "$APP_DIR/.pages-deploy/_next"
cp -r "$APP_DIR/.next/static" "$APP_DIR/.pages-deploy/_next/static"

echo "→ Deploying to Cloudflare Pages…"
node "$WRANGLER" pages deploy "$APP_DIR/.pages-deploy" \
  --project-name=dreamreel-web --commit-dirty=true

echo "→ Cleaning up…"
rm -rf "$APP_DIR/.pages-deploy" "$APP_DIR/.next"
echo "✓ Done. Visit https://dreamreel-web.pages.dev/"

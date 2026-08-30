#!/usr/bin/env bash
# DreamReel — one-time production secret setup.
#
# This script prints the wrangler commands needed to configure a fresh
# production deployment. It does NOT actually push secrets (you have
# to type them in or pipe them in yourself, because they should never
# appear in this script's output or in the shell history).
#
# What gets configured:
#   1. GMI_ENC_KEY          — AES-256-GCM key for encrypting user
#                             API keys at rest
#   2. GITHUB_CLIENT_ID     — OAuth app client id
#   3. GITHUB_CLIENT_SECRET — OAuth app client secret
#   4. D1 migration         — adds the key_encrypted column
#
# What does NOT get configured:
#   - GMI_API_KEY is intentionally NOT set. The service is a host
#     only. Every user must bring their own GMI key (entered at
#     /me?tab=key).
#
# Usage:
#   bash scripts/setup-secrets.sh              # just print the commands
#   bash scripts/setup-secrets.sh --generate  # also generate a fresh
#                                             # GMI_ENC_KEY and print
#                                             # it (you'll need to set
#                                             # it as a Worker secret
#                                             # with `wrangler secret
#                                             # put`)

set -e

if [[ "${1:-}" == "--generate" ]]; then
    echo "# Generated GMI_ENC_KEY (run 'wrangler secret put GMI_ENC_KEY' and paste this):"
    openssl rand -base64 32
    echo
fi

cat <<'EOF'
# === One-time production setup for the dreamreel-api Worker ===
# Run these from the apps/api directory. We use `pnpm exec wrangler`
# because wrangler lives in apps/api/node_modules/.bin/ (not on the
# global PATH). If you have wrangler installed globally, you can drop
# the `pnpm exec` prefix.

cd "$(dirname "$0")/../apps/api"

# 1. Set the encryption key for user-stored GMI keys.
#    Paste the value (or a fresh `openssl rand -base64 32`) when prompted.
pnpm exec wrangler secret put GMI_ENC_KEY

# 2. Set the GitHub OAuth client id and secret.
#    Create the OAuth app at https://github.com/settings/developers
#    with callback URL = ${ALLOWED_ORIGIN}/api/auth/github/callback
pnpm exec wrangler secret put GITHUB_CLIENT_ID
pnpm exec wrangler secret put GITHUB_CLIENT_SECRET

# 3. Apply the database migration that adds the key_encrypted column.
pnpm exec wrangler d1 migrations apply dreamreel-db

# === Optional: rotate GMI_ENC_KEY (re-encrypts all user keys) ===
# Re-encrypting in bulk is a one-shot script we have not written yet.
# If you need to rotate, the safe path is:
#   1. decrypt all rows with the old key
#   2. re-encrypt with the new key
#   3. write back
# For now, rotation requires users to re-enter their keys.

# === After running, verify the Worker boots cleanly ===
#   curl https://dreamreel-api.right-ai.workers.dev/health
# should return { ok: true, ai: "gmi", canGenerate: true, needsAuth: true }
EOF

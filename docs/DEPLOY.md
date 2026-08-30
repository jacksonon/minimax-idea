# Deployment Guide — DreamReel

> **Audience**: anyone deploying DreamReel to Cloudflare. Reading order: §1 → §2 → §3 → §4 → §5 → §6. Expect ~30 min for a first deploy.

## Table of contents

1. [What you're deploying](#1-what-youre-deploying)
2. [One-time prerequisites](#2-one-time-prerequisites)
3. [Create Cloudflare resources](#3-create-cloudflare-resources)
4. [Set the Worker secrets](#4-set-the-worker-secrets)
5. [Deploy](#5-deploy)
6. [Verify](#6-verify)
7. [Day-to-day operations](#7-day-to-day-operations)
8. [Roll back](#8-roll-back)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. What you're deploying

DreamReel ships as **two independent Cloudflare artifacts**, both built from this monorepo:

| Path | What it is | Where it lives | URL |
|---|---|---|---|
| `apps/web` | Next.js 14 (App Router), static-exported, deployed as Cloudflare Pages | Cloudflare Pages project `dreamreel-web` | `https://dreamreel-web.pages.dev` |
| `apps/api` | Hono app on Cloudflare Workers, talks to D1/R2/KV and proxies each user's GMI key to GMI Cloud | Cloudflare Worker `dreamreel-api` | `https://dreamreel-api.<account>.workers.dev` |

**Architecture invariants** (any change here is a project decision, not an "obvious" thing):

- **Users bring their own GMI API key.** The service is a host; it does **not** bill any GMI usage itself. Each user enters their key in `/me?tab=key`, the Worker encrypts it with AES-256-GCM (`GMI_ENC_KEY`) and stores it in D1. At generation time, the per-user key is decrypted and used to call the four GMI models (M3 / H3 / Music 3.0 / Speech 2.8).
- **GitHub OAuth is the only sign-in.** The dev login (`/api/auth/dev-login`) is local-only and returns 403 in production.
- **`/me` is the dashboard.** Profile / My dreams / API key, with `?tab=` for deep links. `/dreams` redirects to `/me?tab=dreams`.
- **The Cloudflare Worker cannot run the dream pipeline** because `ffmpeg` is not available in workerd. `POST /api/dreams/generate` returns 503 with a "no ffmpeg" message; the user is told to run `pnpm dev:api` locally (or deploy a Cloudflare Container that runs the composition step) for end-to-end generation. Everything else (auth, dream list, settings) **does** work in the Worker.
- **The hosting service never logs or returns a user's GMI key.** The encrypted ciphertext is in D1; only the user themselves, with their session cookie, can decrypt it.

## 2. One-time prerequisites

You need:

1. **Node 20+ and pnpm 11+**.
2. **A Cloudflare account.** Sign up at https://dash.cloudflare.com/sign-up. The free tier is enough for everything except storage of generated videos (which lives in R2, also free).
3. **This repo cloned and `pnpm install` run at the root.**
4. **A GitHub OAuth App** (free):
   - Go to https://github.com/settings/developers → **New OAuth App**
   - **Authorization callback URL**: `https://dreamreel-api.<your-cloudflare-subdomain>.workers.dev/api/auth/github/callback`
     (e.g. `https://dreamreel-api.dreamreel-app.workers.dev/api/auth/github/callback`)
   - Copy the **Client ID** and generate a **Client secret**. You'll paste both into the Worker in step 4.

## 3. Create Cloudflare resources

These are created **once per Cloudflare account**. They survive deploys and only need to be redone if you create a new Cloudflare account.

```bash
# 1. Install wrangler's auth state (browser popup)
cd apps/api
./node_modules/.bin/wrangler login
```

If you ran `bash scripts/setup-prod.sh` at this point, you have already completed this step. Otherwise:

```bash
# 2. D1 database (metadata for users, dreams, sessions, settings)
./node_modules/.bin/wrangler d1 create dreamreel-db
# → prints { "database_id": "..." }. Paste it into apps/api/wrangler.toml
#   in the [[d1_databases]] section (replacing the placeholder).

# 3. R2 bucket (generated video/audio artifacts)
./node_modules/.bin/wrangler r2 bucket create dreamreel-media

# 4. KV namespace (rate-limit counters, share tokens)
./node_modules/.bin/wrangler kv namespace create dreamreel-kv
# → prints { "id": "..." }. Paste it into apps/api/wrangler.toml
#   in the [[kv_namespaces]] section.

# 5. Cloudflare Pages project (the web app)
cd ../web
./node_modules/.bin/wrangler pages project create dreamreel-web \
  --production-branch=main
# No env vars need to be set here — the GitHub Actions workflow
# sets NEXT_PUBLIC_API_URL at build time.
```

After step 2 and 4, **edit `apps/api/wrangler.toml`** to paste the IDs. The file should look roughly like:

```toml
[[d1_databases]]
binding = "DB"
database_name = "dreamreel-db"
database_id = "6186c4a3-52c8-4ab0-bdea-b606b313eff3"   # ← yours

[[kv_namespaces]]
binding = "KV"
id = "c625d5edc18d4cea80bb31f82b527079"                # ← yours
```

`name = "dreamreel-api"`, `main = "src/worker.ts"`, and the `[vars]` block can stay as-is — they describe deployment-time configuration, not your account.

## 4. Set the Worker secrets

The Worker needs three secrets. **All three are required for the per-user-key architecture to work**:

| Secret | Why | How to get the value |
|---|---|---|
| `GMI_ENC_KEY` | AES-256-GCM key for encrypting user API keys at rest. Without it, every `PUT /api/settings` and every `GET /api/settings` will 500. | `openssl rand -base64 32` |
| `GITHUB_CLIENT_ID` | OAuth app client id. Without it, `/api/auth/github` returns 503 and users cannot sign in. | github.com/settings/developers |
| `GITHUB_CLIENT_SECRET` | OAuth app client secret. Same. | github.com/settings/developers (generated once, stored only there) |

The **automated path** does all three plus the D1 migration in one command:

```bash
bash scripts/setup-prod.sh
# or:  bash scripts/setup-prod.sh --generate   # also mints a fresh GMI_ENC_KEY
```

The script will:
- Verify `wrangler login` is done (bails with a clear hint if not)
- Generate a fresh `GMI_ENC_KEY` and `wrangler secret put` it
- Read `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` from your terminal (the second is hidden)
- Apply the D1 migration that adds the `key_encrypted` column

If you'd rather do it by hand:

```bash
cd apps/api

# 1. Generate and upload the encryption key
openssl rand -base64 32 | ./node_modules/.bin/wrangler secret put GMI_ENC_KEY

# 2. Upload the GitHub OAuth credentials
./node_modules/.bin/wrangler secret put GITHUB_CLIENT_ID     # paste, Enter
./node_modules/.bin/wrangler secret put GITHUB_CLIENT_SECRET # paste, Enter (hidden)

# 3. Apply D1 migrations
./node_modules/.bin/wrangler d1 migrations apply dreamreel-db
```

Verify with `wrangler secret list` — you should see all three.

> **Why isn't `GMI_API_KEY` in the table?** Because the service is a host, not a customer. Each user brings their own GMI key. If `GMI_API_KEY` *is* set in the env, the Worker still refuses to use it for user-initiated dream generation — see `routes/dreams.ts`. Set it only if you really know what you're doing (e.g. for a smoke test of the AI plumbing).

## 5. Deploy

**Both halves are deployed from a single command:**

```bash
# From the repo root
bash scripts/prod.sh deploy
```

What it does:
1. `wrangler deploy` (from `apps/api`) — bundles `src/worker.ts` and pushes to Cloudflare Workers.
2. `pnpm --filter @dreamreel/web build` — produces a Pages-compatible static export.
3. `wrangler pages deploy .pages-deploy` (from `apps/web`) — pushes to Cloudflare Pages.

**For the API Worker alone** (e.g. iterating on a single route):

```bash
cd apps/api
./node_modules/.bin/wrangler deploy --env ""
```

**For the web app alone** (e.g. tweaking only UI):

```bash
cd apps/web
pnpm exec wrangler pages deploy .pages-deploy \
  --project-name dreamreel-web \
  --commit-dirty=true \
  --branch main
```

> **The `--env ""` flag is intentional.** `wrangler.toml` declares a top-level environment *and* a `[env.dev]` block. `wrangler deploy` will otherwise warn about ambiguity. We always target the top-level (production) environment.

> **The CI workflow (`.github/workflows/deploy.yml`) deploys only the web app.** It does not have a Cloudflare token with Workers-write scope, so the API Worker has to be deployed from a local machine. This is by design — the API doesn't change as often as the UI, and a broken Worker deploy can break everything for users, so we want a human in the loop.

## 6. Verify

After deploy:

```bash
bash scripts/prod.sh verify
```

What it checks:

```
=== Verifying https://dreamreel-api.<sub>.workers.dev ===
  ✓ GET /health
  ✓ GET /health env=production
  ✓ GET /api/auth/me (anon) returns {"user":null}
  ✓ /api/auth/github wired (302 redirect to github.com)
  ✓ POST /api/dreams/generate 503 (no ffmpeg, new body)

=== Verifying https://dreamreel-web.pages.dev ===
  ✓ GET / returns 200
  ✓ GET /me returns 200
  ✓ GET /dreams returns 200 (client-side redirect to /me?tab=dreams)
```

A few of these are **warnings**, not failures, when the API Worker is on an older bundle:

```
⚠ /api/auth/github 404 — older Worker bundle.
  Run 'bash scripts/prod.sh deploy' to refresh.
```

This happens right after you've changed the API code but haven't deployed yet. Once the deploy command above runs, the warning goes away on the next verify.

**To test the full end-to-end with your own browser:**

1. Open `https://dreamreel-web.pages.dev/me?tab=key` in an incognito window.
2. Click **Sign in with GitHub**, complete the OAuth dance, paste your own GMI Cloud API key, save.
3. Go back to the home page, hold the mic, speak a dream. *The web build is the demo UI; the API Worker doesn't have ffmpeg so the page will say "Server is unreachable" after a moment.* That's expected — for a real end-to-end demo with video, run the API locally (`pnpm dev:api`) and point the web at it.

## 7. Day-to-day operations

The repo includes three scripts for production operations. None of them require writing Cloudflare config files — they all read `wrangler.toml` and the Worker name from the repo.

| Command | What it does | Requires wrangler login? |
|---|---|---|
| `bash scripts/prod.sh setup` | First-time: set Worker secrets, apply D1 migration. Idempotent. | Yes |
| `bash scripts/prod.sh deploy` | Push the latest API Worker + web build to Cloudflare. | Yes |
| `bash scripts/prod.sh verify` | Smoke-test the public endpoints. | No |
| `bash scripts/prod.sh all` | All of the above. | Yes |

**Local API testing** (no wrangler needed, no Cloudflare):

```bash
bash scripts/test-api.sh
```

Spins up `apps/api` on `:8787` in mock mode and runs 11 checks: health, OAuth endpoint presence, anonymous /me, anonymous generate rejection, dev login, mock-mode generation, key save, AES-GCM ciphertext in D1, GET /api/settings does not leak the key. Exits non-zero on any failure.

**Acceptance / E2E** (the GH Actions Acceptance job calls this):

```bash
DREAMREEL_E2E_LOCAL=1 bash scripts/acceptance.sh
```

Without `DREAMREEL_E2E_LOCAL=1`, the script just smoke-tests the deployed endpoints — no local server, no port contention.

## 8. Roll back

- **Cloudflare Worker**: dashboard → Workers & Pages → `dreamreel-api` → Deployments → click a previous version → **Rollback**. Wrangler keeps the last ~5 deployments.
- **Cloudflare Pages**: same UI under `dreamreel-web`. Pick a previous deployment.
- **D1**: schema migrations are additive. If you need to roll back a migration, write a forward migration that undoes it (e.g. add a column you later want to drop) — do not edit a shipped migration.
- **R2**: object versioning can be enabled per bucket. There is no general "rollback".
- **GMI_ENC_KEY rotation**: requires re-encrypting every existing user row. There is no script for this yet; the safe path is to write a one-shot migration that decrypts with the old key and re-encrypts with the new one. Until that's written, rotating `GMI_ENC_KEY` invalidates all stored user keys (users will need to re-enter them).

## 9. Troubleshooting

### `wrangler secret list` shows the secrets, but the Worker can't read them

This happens when `wrangler secret put` and `wrangler deploy` were run with different `--env` values. **Always use `--env ""`** for both, and always use the same Cloudflare account (verify with `wrangler whoami`).

### `/api/auth/github` returns 404 in production

The deployed Worker is running an older bundle. Run `bash scripts/prod.sh deploy`. After it finishes, the new bundle is live and the route will be present.

### `POST /api/dreams/generate` returns 503 with "no ffmpeg"

Expected in production. The Cloudflare Worker runtime cannot run `ffmpeg`. To run a real end-to-end generation:
- Run the API locally with `pnpm dev:api` (uses Node + ffmpeg installed via `brew install ffmpeg`)
- Or deploy a Cloudflare Container that hosts the composition step (the API was designed to support this — see `services/composite.ts`)

### CORS error in browser console

`ALLOWED_ORIGIN` in `wrangler.toml` is the exact scheme+host of the web app. Update it if you change the Pages project name. The default `https://dreamreel.pages.dev` matches the default project name `dreamreel-web`.

### D1 "no such column: key_encrypted"

The D1 schema migration `0002_settings_encryption.sql` was not applied. Run `wrangler d1 migrations apply dreamreel-db`.

### Worker deploy fails with "Service core: Uncaught TypeError: fileURLToPath"

You're on an old bundle that statically imports `node:url` or `node:path` from `src/env.ts`. Run `bash scripts/prod.sh deploy` to push a fixed bundle. The new `env.ts` is Node-free.

### Local dev can't reach the API

```bash
# 1. Make sure apps/api/.dev.vars exists with a GMI_ENC_KEY
ls apps/api/.dev.vars

# 2. Start the API
cd apps/api && pnpm dev
# → "DreamReel API listening on http://localhost:8787"

# 3. Check from another terminal
curl http://localhost:8787/health
```

If the API is running but `/health` 500s, look at the API console — usually a missing `GMI_ENC_KEY` in `.dev.vars` or a stale D1 schema.

---

**END OF DEPLOY.md**

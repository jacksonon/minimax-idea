# Deployment Guide — DreamReel

> **Audience**: anyone (or any AI agent) who wants to deploy DreamReel to Cloudflare in 15 minutes.

## Two apps, one repo

- `apps/web` → **Cloudflare Pages** (Next.js static export, served at `dreamreel.app`)
- `apps/api` → **Cloudflare Workers** (Hono, served at `api.dreamreel.app`)
- D1 / R2 / KV → Cloudflare managed
- AI calls → GMI Cloud (M3, H3, Music 3.0, Speech 2.8)

## One-time setup

```bash
# 0. Install
pnpm install

# 1. Login to Cloudflare
pnpm wrangler login
```

## Create Cloudflare resources

```bash
# D1
pnpm wrangler d1 create dreamreel-db
# → prints {database_id: "..."}. Copy this into apps/api/wrangler.toml.

# R2
pnpm wrangler r2 bucket create dreamreel-media

# KV
pnpm wrangler kv:namespace create dreamreel-kv
# → prints {id: "..."}. Copy this into apps/api/wrangler.toml.
```

## Apply D1 schema

```bash
cd apps/api
pnpm wrangler d1 migrations apply dreamreel-db --remote
cd ../..
```

## Set Worker secrets

```bash
cd apps/api

# GMI Cloud — get from https://console.gmicloud.ai
pnpm wrangler secret put GMI_API_KEY

# NextAuth — generate: openssl rand -base64 32
pnpm wrangler secret put NEXTAUTH_SECRET

# OAuth (use production client IDs/secrets, not dev)
pnpm wrangler secret put GITHUB_ID
pnpm wrangler secret put GITHUB_SECRET
pnpm wrangler secret put GOOGLE_ID
pnpm wrangler secret put GOOGLE_SECRET

# Optional
pnpm wrangler secret put DISCORD_WEBHOOK_URL
cd ../..
```

## Set Pages env vars

In Cloudflare dashboard → Pages → `dreamreel-web` → Settings → Environment variables:

| Variable | Value |
|---|---|
| `NEXTAUTH_URL` | `https://dreamreel.app` |
| `NEXTAUTH_SECRET` | (same as Worker) |
| `NEXT_PUBLIC_API_URL` | `https://api.dreamreel.app` |
| `GITHUB_ID` | (same as Worker) |
| `GITHUB_SECRET` | (same as Worker) |
| `GOOGLE_ID` | (same as Worker) |
| `GOOGLE_SECRET` | (same as Worker) |

## Update OAuth callback URLs

In GitHub OAuth app settings:
- Authorization callback URL: `https://dreamreel.app/api/auth/callback/github`

In Google Cloud Console:
- Authorized redirect URI: `https://dreamreel.app/api/auth/callback/google`

## Deploy the Worker

```bash
cd apps/api
pnpm wrangler deploy
cd ../..
```

## Deploy the Web app

```bash
cd apps/web
pnpm build
pnpm exec wrangler pages deploy .next --project-name=dreamreel-web
# OR: connect the GitHub repo in Cloudflare Pages dashboard for auto-deploy
cd ../..
```

## Smoke test

```bash
# 1. API health
curl https://api.dreamreel.app/health
# → {"ok":true,"env":"production","ai":"gmi"}

# 2. Open the site
open https://dreamreel.app

# 3. Click the mic, hold, speak a dream.
# 4. Wait 90 seconds. Watch a 30-second film.

# 5. Verify D1 row
pnpm --filter api wrangler d1 execute dreamreel-db --remote \
  --command "SELECT id, status, emotion_tag, created_at FROM dreams ORDER BY created_at DESC LIMIT 1"
```

## Roll back

```bash
# Worker: wrangler keeps the last 5 deployments; roll back in the dashboard
# Pages: same — pick a previous deployment in the Pages dashboard
# D1: schema migrations are additive. Don't drop tables in production.
# R2: there's no rollback — but object versioning can be enabled per bucket.
```

## Cost estimate (MiniMax Week)

> **Important**: M3, M2.7, Music 3.0, and Speech 2.8 are **free during the contest**. **H3 is paid** even during the contest (see the contest FAQ). Run with `H3_ENABLED=true` only if you have credits; otherwise the pipeline falls back to a 30s slideshow.

| Item | Estimated cost |
|---|---|
| H3 video (~$0.10 per 5s clip × 4 clips × 50 demos) | ~$20 (skip if `H3_ENABLED=false`) |
| Music 3.0 (free during contest) | $0 |
| Speech 2.8 (free during contest) | $0 |
| M3 (free during contest) | $0 |
| Cloudflare Workers + Pages | Free tier |
| D1 reads/writes | Free tier |
| R2 storage (50 × 1MB) | Free tier |
| **Total with H3** | **~$20** |
| **Total without H3 (slideshow mode)** | **$0** |

---

**END OF DEPLOY.md**

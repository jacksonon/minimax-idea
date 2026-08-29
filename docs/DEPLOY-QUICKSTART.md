# Quick Deploy Guide

> One-shot deployment to Cloudflare. Verified working as of 2026-08-29.

## 1. Prerequisites

- Node 20+, pnpm 11+
- Cloudflare account
- R2 enabled in dashboard (https://dash.cloudflare.com/?to=/:account/r2) — required, free tier
- GitHub repo with this code

## 2. Create Cloudflare resources (one-time)

```bash
# Login
./scripts/wrangler.sh login

# D1 database
./scripts/wrangler.sh d1 create dreamreel-db
# → note the database_id, paste into apps/api/wrangler.toml

# R2 bucket
./scripts/wrangler.sh r2 bucket create dreamreel-media

# KV namespace
./scripts/wrangler.sh kv namespace create dreamreel-kv
# → note the id, paste into apps/api/wrangler.toml

# Pages project
./scripts/wrangler.sh pages project create dreamreel-web --production-branch main
```

## 3. Update wrangler.toml

In `apps/api/wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "dreamreel-db"
database_id = "<paste from step 2>"

[[kv_namespaces]]
binding = "KV"
id = "<paste from step 2>"
```

## 4. Deploy the Worker

```bash
cd apps/api
../scripts/wrangler.sh deploy
```

Note the URL: `https://dreamreel-api.<account>.workers.dev`

## 5. Deploy the Web

```bash
cd apps/web
npx next build
# Create static deploy dir (only static routes; dynamic ones won't work in this static deploy)
mkdir -p .pages-deploy
cp ../.next/server/app/index.html .pages-deploy/index.html
cp ../.next/server/app/dreams.html .pages-deploy/dreams.html
mkdir -p .pages-deploy/_next
cp -r ../.next/static/* .pages-deploy/_next/

../scripts/wrangler.sh pages deploy .pages-deploy --project-name=dreamreel-web
```

URL: `https://dreamreel-web.pages.dev`

## 6. (Optional) Secrets

```bash
cd apps/api
../scripts/wrangler.sh secret put GMI_API_KEY
../scripts/wrangler.sh secret put NEXTAUTH_SECRET
../scripts/wrangler.sh secret put GITHUB_ID
../scripts/wrangler.sh secret put GITHUB_SECRET
../scripts/wrangler.sh secret put GOOGLE_ID
../scripts/wrangler.sh secret put GOOGLE_SECRET
```

Without secrets, the deployed Worker runs in **static demo mode** (only GET endpoints, no generation).
With GMI_API_KEY set, the Worker will call real GMI models.

## 7. Verify

```bash
# API
curl https://dreamreel-api.<account>.workers.dev/health
# → {"ok":true,"env":"production","ai":"gmi","h3":false,...}

# Web
open https://dreamreel-web.pages.dev
```

## 8. Custom domain (optional)

In Cloudflare dashboard:
- Pages → dreamreel-web → Custom domains → add `dreamreel.app`
- Worker → dreamreel-api → Triggers → add route `api.dreamreel.app/*`

Then update wrangler.toml:
```toml
ALLOWED_ORIGIN = "https://dreamreel.app"
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "workspace detection" error from wrangler | Always run wrangler from inside `apps/api`. The `scripts/wrangler.sh` shim does this. |
| `ERR_PNPM_IGNORED_BUILDS: workerd` | Add `"workerd"` to `onlyBuiltDependencies` in `package.json` AND `pnpm-workspace.yaml`. |
| Pages deploy: "no production branch" | Run `wrangler pages project create ... --production-branch main` first. |
| CORS error in browser console | Set `ALLOWED_ORIGIN` to the exact Pages URL, including scheme. |
| Worker logs missing | `wrangler tail` in another terminal. |


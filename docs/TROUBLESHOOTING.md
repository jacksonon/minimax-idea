# Troubleshooting

> **The dev journal of every problem we hit and how we fixed it.** Save the next developer (or AI agent) an hour per issue.

---

## Table of contents

1. [pnpm / dependency issues](#1-pnpm--dependency-issues)
2. [better-sqlite3 / native build](#2-better-sqlite3--native-build)
3. [ffmpeg / video generation](#3-ffmpeg--video-generation)
4. [Server runtime / ports](#4-server-runtime--ports)
5. [API errors / pipeline](#5-api-errors--pipeline)
6. [Frontend / Next.js](#6-frontend--nextjs)
7. [Deployment / Cloudflare](#7-deployment--cloudflare)
8. [CI / GitHub Actions](#8-ci--github-actions)

---

## 1. pnpm / dependency issues

### `ERR_PNPM_IGNORED_BUILDS: Ignored build scripts: better-sqlite3, esbuild`

pnpm 11+ requires explicit approval for native build scripts. Fix:

`pnpm-workspace.yaml` (commit this):
```yaml
packages:
  - 'apps/*'
  - 'packages/*'

onlyBuiltDependencies:
  - better-sqlite3
  - esbuild
```

Then `pnpm install`. The native build runs automatically.

### `pnpm dev` fails with "Command failed with exit code 1: pnpm install"

`pnpm dev` re-checks dependencies before running. If `onlyBuiltDependencies` is missing, the install step in dev mode fails. Fix as above.

### `ELIFECYCLE Command failed` after pulling new code

Most likely a new dep was added without your lockfile being updated. Run:

```bash
pnpm install
```

### Workspace package not resolving

If `import { ... } from '@dreamreel/shared'` fails:

1. Check `apps/api/tsconfig.json` has `paths: { "@dreamreel/shared": ["../../packages/shared/src/index.ts"] }`.
2. Check `apps/api/package.json` has `"@dreamreel/shared": "workspace:*"`.
3. Restart the dev server.

---

## 2. better-sqlite3 / native build

### `Could not locate the bindings file ... better_sqlite3.node`

The native binding wasn't compiled. Fix:

```bash
cd apps/api/node_modules/better-sqlite3
npm run install
# (or from root: pnpm rebuild better-sqlite3)
```

### `node-gyp` errors on M-series Mac

Node 25 + homebrew + arm64 sometimes has Python or gyp issues. Verify:

```bash
which python3 && python3 --version
xcode-select -p  # should print a path
```

### Mismatched binding after `pnpm install`

`pnpm` symlinks `.pnpm/<pkg>@<v>/node_modules/better-sqlite3` into `apps/api/node_modules/`. If the symlink breaks (rare), delete `node_modules` and reinstall.

```bash
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install
```

---

## 3. ffmpeg / video generation

### `Filter '...' has output unconnected` (composite step)

Means a filter chain has a label that nothing consumes. Most common cause: xfade offset errors or label renames.

**Fix**: Use `concat` instead of chained `xfade`. See `apps/api/src/services/composite.ts`.

### `Conversion failed: Nothing was written into output file`

The filter graph silently failed. Common causes:

1. **Wrong input index in filter**: `[0:v]` is the *first* input's video. If you `-i anullsrc` first, audio is `[0:a]`, not `[0:v]`. The video is `[1:v]`.
2. **Filter using a source without input**: `sine=frequency=...` needs its own `-i` flag, you can't just put it in the filter chain.

**Debug trick**: run ffmpeg with the same args directly to see the full error:

```bash
ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=stereo \
  -f lavfi -i "color=c=0x1a1a2e:s=1280x720:d=5:r=24" \
  -filter_complex "..." \
  -map "[out]" -map "0:a" -c:v libx264 ... /tmp/test.mp4
```

### `ffmpeg exit 234: Could not open encoder before EOF`

Almost always a `noise=` filter on a 0-frame input. `noise` requires pre-existing frames; if the input is empty, the chain has nothing to filter. Remove the noise filter or chain it AFTER a `format=yuv420p` that produces frames.

### `music.mp3 is not a valid MP3` (composite error)

You wrote the MP3 to the same path you're trying to read it back from, then deleted the original. The mock provider used to do this — see the `tmp/<id>.mp3` workaround in `apps/api/src/services/ai/mock.ts`.

### Video output is `7.5s` instead of `30s`

Your xfade chain's offset is wrong. The chained xfade pattern doesn't stack durations — each xfade REPLACES, not appends. Use `concat=n=4:v=1:a=0` instead. See `composite.ts`.

### `Generated music is 3GB and never stops`

The sine filter had no duration cap. The mock now uses `-t 30` on each input. If you see runaway files, check the input is bounded.

---

## 4. Server runtime / ports

### `EADDRINUSE: address already in use :::8787`

An older `tsx` process is still bound. Kill it:

```bash
pkill -f "tsx src/index.ts"
lsof -i:8787
```

Or, on macOS:

```bash
lsof -ti:8787 | xargs kill -9
```

### `EADDRINUSE: address already in use :::3000`

Same for Next.js:

```bash
pkill -f "next dev"
lsof -ti:3000 | xargs kill -9
```

### Workers health endpoint returns `{}` or empty

Hono's `c.req.header()` may return `undefined`. Our middleware handles that, but if you added a new route that calls `c.req.header('x-foo')` directly, wrap in `?? ''`.

### `Cannot find module 'better-sqlite3'` in dev

`pnpm-workspace.yaml` is missing the `onlyBuiltDependencies` entry. See §1.

---

## 5. API errors / pipeline

### Dream stuck at `stage='scene-2'` forever

Old bug: the pipeline's `advanceScene` was inside `.finally()`, which runs after `await Promise.all` resolves — too late for the UI. Fixed: `advanceScene` is now called at the start of each parallel video promise. See `apps/api/src/services/pipeline.ts`.

### "Rate limit exceeded" with low traffic

`rate_limits` table is per-IP-per-hour. Even localhost hits it if you ran the script 3+ times. Reset:

```bash
rm -f apps/api/dev.db*
```

### `dream_id` is empty in the response

You probably hit the moderation filter (returns 422, no dream_id) or rate limit (returns 429, no dream_id). Check the actual HTTP status:

```bash
curl -i -X POST http://localhost:8787/api/dreams/generate \
  -H "Content-Type: application/json" \
  -d '{"transcript":"test"}'
```

### `emotion_tag` is `null` after generation

M3 didn't return a valid enum value. The pipeline saves whatever the model returns, then zod-validates on the way out. If your prompt is producing off-enum values, see `docs/prompts/screenplay.md` and the test corpus at `docs/prompts/test-corpus.json`.

### `error_message: "All scene generations failed"`

All 4 H3 calls returned null. In production with GMI Cloud this means your API key is invalid or rate-limited. In local mock mode, check `apps/api/storage/clips/` — if files exist there, the bug is in `composite.ts`. If not, the bug is in `mock.ts`.

### Final video file size is tiny (~21KB) and only 7.5s

You have the xfade bug. Use `concat`. See §3.

---

## 6. Frontend / Next.js

### `next dev` fails with "Port 3000 is in use"

See §4.

### Fonts not loading

We're loading from Google Fonts via `<link>` in `layout.tsx`. If the network is blocked, fonts fall back to `system-ui`. This is fine — don't try to self-host without a reason.

### `<video>` autoplay not working

Browsers block autoplay without `muted` or user interaction. We use `autoPlay` (not muted) so it only works after a user click on the page. To make it autoplay with sound, you'd need `muted` + a `playsInline` + a button to unmute.

### CORS errors in the browser console

Check `apps/api/src/env.ts` → `ALLOWED_ORIGIN`. It must match the URL Next.js is served on (default `http://localhost:3000`). For a different port, set `ALLOWED_ORIGIN` in `apps/api/.dev.vars`.

### `useStore` not updating after `setUser`

`zustand` v5 changed selectors. Make sure the consumer is using the store correctly:

```tsx
const user = useStore((s) => s.user);  // OK
const { user } = useStore();  // also OK but less optimal
const { user } = useStore.getState();  // BAD — won't re-render
```

### `useEffect` polling never cleans up

Check the cleanup return:

```tsx
useEffect(() => {
  const id = setInterval(...);
  return () => clearInterval(id);  // MUST be returned
}, [dep]);
```

---

## 7. Deployment / Cloudflare

### Worker deploy fails: "could not resolve binding DB"

The `database_id` in `wrangler.toml` is wrong. Re-run `pnpm wrangler d1 create dreamreel-db` and copy the actual ID.

### `wrangler secret list` shows a secret, but the Worker can't read it

The Cloudflare Worker runtime nests secrets **under `c.env.env`**, not at the top level of `c.env`. So `c.env?.GITHUB_CLIENT_ID` is always `undefined`; the correct access is `c.env?.env?.GITHUB_CLIENT_ID` (or `c.env?.env?.[key]`).

The repo's route handlers use a small `getEnv(c, key)` helper that checks both layers, so this is handled for you. If you add a new route and read a secret directly from `c.env`, the value will always be undefined.

You can verify what the Worker actually sees by hitting a debug route that prints `Object.keys(c.env.env)`:
```ts
app.get('/__debug/env', (c) => c.json(Object.fromEntries(
  Object.keys((c.env as any).env ?? {}).map((k) => [k, 'set' in ((c.env as any).env[k])])
)));
```

The default response is `ai: "mock"` (i.e. the worker has no GMI key in env, which is correct — users bring their own). If you need the worker itself to call GMI, set `GMI_API_KEY` via `wrangler secret put`.

### `wrangler secret put` and `wrangler deploy` were run with different `--env` values

The `wrangler.toml` declares a top-level environment *and* a `[env.dev]` block. `wrangler secret put` without `--env` writes to the top-level env; `wrangler deploy` without `--env` warns about ambiguity and may pick `dev`. The two then target different storage and the secret is invisible to the deployed Worker.

**Fix:** always pass `--env ""` to both. The deploy script in `scripts/prod.sh` does this. The full sequence:

```bash
cd apps/api
./node_modules/.bin/wrangler secret put GMI_ENC_KEY --env ""          # paste
./node_modules/.bin/wrangler secret put GITHUB_CLIENT_ID --env ""     # paste
./node_modules/.bin/wrangler secret put GITHUB_CLIENT_SECRET --env "" # paste
./node_modules/.bin/wrangler deploy --env ""
```

Verify with `./node_modules/.bin/wrangler secret list` (lists names only) and a quick `curl https://<api>/api/auth/github` (should return 302, not 503).

### Worker runtime fails to start: "The 'path' argument must be of type string or an instance of URL. Received undefined" at `fileURLToPath`

Some module in the bundle statically imports `node:url` and calls `fileURLToPath(import.meta.url)`. In `workerd`, `import.meta.url` is `undefined`, so the call throws and the Worker fails to boot with the cryptic "service core: Uncaught TypeError" message above.

The repo's `src/env.ts` is Node-only (originally). If you re-introduce a `node:url` or `node:path` import into something `worker.ts` transitively pulls in (like a service module), the Worker will refuse to start. Use `process.cwd()` and pass config through function arguments instead. The pattern in `services/ai/gmi.ts` (a `makeGmiProvider(config)` factory that takes its config as an argument) is the safe one.

### Pages deploy: "No build output found"

Next.js's `next build` outputs to `.next/`, but Pages wants `out/` (for static) or runs the build itself (for SSR). Two options:

1. **Static export**: add `output: 'export'` to `next.config.js`, then `out/` is the build dir.
2. **Pages Functions**: use `@cloudflare/next-on-pages` adapter. Slower deploys, but full SSR.

We chose option 1 for simplicity.

### `EAI_AGAIN` errors from `api.gmicloud.ai`

The Worker is timing out the request. Either:
- The model is genuinely slow (H3 takes 30-60s).
- We're not passing `signal` correctly and not aborting on timeout.

Set `AbortSignal.timeout(60_000)` on the fetch in `apps/api/src/services/ai/gmi.ts`.

---

## 8. CI / GitHub Actions

### First CI run fails on `pnpm install` with native build error

Same as local §1 — `onlyBuiltDependencies` in `pnpm-workspace.yaml` must include `better-sqlite3`. It does, but check the YAML is committed.

### Install step fails with `ERR_PNPM_IGNORED_BUILDS` even with `onlyBuiltDependencies` set

pnpm 11 + Node 20 in CI: `actions/setup-node@v4` was failing on Node 20 because the GH-hosted runner only ships Node 24 (Node 20 is deprecated). Bumping `NODE_VERSION` to `'22'` in `.github/workflows/ci.yml` fixed it. Always use a Node version the runner still supports.

### Install step still fails after fixing Node version

Add `--ignore-scripts` to `pnpm install` in CI (matching the Deploy workflow). pnpm 11 hard-errors on native build scripts that aren't in `onlyBuiltDependencies`, even when the lockfile approved them previously.

### E2E job times out at 8 min

`scripts/acceptance.sh` polls up to 120s. Total budget should be 4-5 min. If GitHub-hosted runners are slow, increase `timeout-minutes` in `.github/workflows/ci.yml`.

### E2E job fails on `scripts/acceptance.sh` with EADDRINUSE

Both `scripts/acceptance.sh` and `scripts/test-api.sh` were trying to bind to :8787. `scripts/acceptance.sh` is the single owner now — it starts the API itself, then calls `test-api.sh` which uses the existing server. If you've added a third script that also starts a server, you'll get port conflicts in CI. The fix is to either (a) make every script that needs the API check-and-start or (b) only let `scripts/acceptance.sh` start it and have everything else assume the server is up.

### Playwright install fails in E2E

The step has `|| true` to ignore failures — it's optional. The E2E doesn't actually drive a browser; it uses `curl` against the API.

### Acceptance logs are silent — failures show only "Run acceptance script" failed in the workflow UI

The script writes a detailed transcript to `/tmp/dreamreel-acceptance.log` and uploads it as the `acceptance-logs` artifact. Open the failed run in the GitHub Actions UI, scroll to the **Artifacts** section at the bottom of the page, and download `acceptance-logs` to see exactly which check failed and why.

### Artifact `acceptance-dream` is empty

The full dream-generation E2E was removed in favor of the smoke-test approach. We no longer run the pipeline in CI (it requires ffmpeg, the user has not provided a GMI key, and the production Worker can't run ffmpeg anyway). The `acceptance-dream` artifact upload was deleted from `.github/workflows/ci.yml` when that change was made.

---

## Bonus: when in doubt, run the test scripts

```bash
# Local API end-to-end (boots the API on :8787, runs 11 checks)
bash scripts/test-api.sh

# End-to-end against the deployed production (no local server)
bash scripts/acceptance.sh

# Production smoke test (requires the latest code already deployed)
bash scripts/prod.sh verify
```

If a check fails, the script names which step broke and prints the actual response vs. what was expected. The local `test-api.sh` tails the dev API log on startup failure; the CI `acceptance.sh` writes a full transcript to `/tmp/dreamreel-acceptance.log` and uploads it as a workflow artifact (`acceptance-logs`).

---

**END OF TROUBLESHOOTING.md**

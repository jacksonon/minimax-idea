# Local Development

> **How to run DreamReel on your machine for development.** This is the entry point for anyone joining the project. `TROUBLESHOOTING.md` covers "what's broken" — this one covers "how to start."

---

## Prerequisites

| Tool | Version | Check |
|---|---|---|
| Node.js | 20+ | `node -v` |
| pnpm | 11+ | `pnpm -v` |
| ffmpeg | 6+ | `ffmpeg -version` |
| git | any | `git --version` |
| macOS / Linux | — | (Windows works via WSL) |

If you're on macOS and missing ffmpeg: `brew install ffmpeg`.

---

## First-time setup (5 minutes)

```bash
# 1. Clone
git clone https://github.com/jacksonon/minimax-idea.git
cd dreamreel

# 2. Install dependencies (this also compiles better-sqlite3)
pnpm install

# 3. Copy env templates (you don't need to fill them — mock AI works without keys)
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.dev.vars.example apps/api/.dev.vars
```

That's it. No database to set up. No API keys needed for the default `mock` AI provider.

---

## Running the app (two terminals)

### Terminal 1 — API (port 8787)

```bash
pnpm dev:api
```

Expected output:
```
DreamReel API listening on http://localhost:8787
ENV: development  AI: mock  CORS: http://localhost:3000
```

The API uses:
- **better-sqlite3** for the local DB (`apps/api/dev.db`)
- **ffmpeg** for video composition
- **local filesystem** for media storage (`apps/api/storage/`)
- **in-memory KV** for sessions and rate limits

### Terminal 2 — Web (port 3000)

```bash
pnpm dev:web
```

Expected output:
```
✓ Ready in 2.3s
Local: http://localhost:3000
```

Open <http://localhost:3000> in your browser. You should see the dark landing page with a single breathing button.

### Try it

1. Click and **hold** the button
2. Speak a dream (e.g. "I was flying through an upside-down library")
3. Release
4. Watch the 4-stage progress bar
5. In ~90 seconds, watch the 30-second film

---

## Common dev tasks

### Run the full test suite

```bash
pnpm test
```

Outputs results from both apps' vitest configs.

### Type-check (no emit)

```bash
pnpm typecheck
```

This is what CI runs. Run it before pushing.

### Build for production (locally)

```bash
pnpm build
```

Builds:
- `apps/api/dist/` (TypeScript → JS, for Node local)
- `apps/web/.next/` (Next.js production build)

### Reset the local database

The dev DB lives at `apps/api/dev.db` (with WAL files alongside).

```bash
rm -f apps/api/dev.db*
rm -rf apps/api/storage
```

Next API start will recreate both.

### Inspect the database

```bash
sqlite3 apps/api/dev.db "SELECT id, status, emotion_tag FROM dreams;"
```

(Requires `sqlite3` CLI: `brew install sqlite3`.)

### Clear the rate limit

```bash
sqlite3 apps/api/dev.db "DELETE FROM rate_limits;"
```

Or just blow away the DB (see above).

---

## How the mock AI works

When `AI_PROVIDER=mock` (the default in `.dev.vars`), each model is simulated locally:

| Model | Mock implementation | Output |
|---|---|---|
| **M3** | Keyword matching + template picker | 4-scene screenplay with voiceover, deterministic per transcript |
| **H3** | ffmpeg color-blend + vignette + grain | 7.5-second 720p video clip |
| **Music 3.0** | ffmpeg 4-layer sine pad | 30-second ambient track, emotion-keyed |
| **Speech 2.8** | macOS `say` (Daniel voice) → 16kHz mono WAV | 30-second voiceover, stretched via atempo chain |

The result is a real, watchable 30-second MP4. The pipeline takes ~90s because we run 4 H3 clips in parallel, each rendering ~3-5s, plus 3-5s for the FFmpeg composite.

To make dev faster, edit `apps/api/src/services/ai/mock.ts`:

```ts
// was: export const SCENE_DURATION_SECONDS = 7.5;
export const SCENE_DURATION_SECONDS = 1;  // for fast dev
```

Total pipeline drops to ~15s. Don't commit this change.

---

## Using the real MiniMax models (GMI Cloud)

Get an API key from <https://console.gmicloud.ai> (free during the contest).

Edit `apps/api/.dev.vars`:

```ini
AI_PROVIDER=gmi
GMI_API_KEY=sk-...your_key...
```

Restart `pnpm dev:api`. Verify:

```bash
curl -s http://localhost:8787/health
# → {"ok":true,"env":"development","ai":"gmi"}
```

The same endpoints work; the only difference is that requests now go to `api.gmicloud.ai` and cost real money (~$0.20/dream).

---

## Debugging tips

### Hot reload

- **API**: `tsx watch` re-runs on every save. If a service crashes, you'll see the stack trace in the API terminal.
- **Web**: Next.js dev server hot-reloads. State usually survives; full reload available via `r` in the terminal.

### Inspecting a request end-to-end

```bash
# In one terminal, watch the API logs
pnpm dev:api

# In another, make a request
curl -X POST http://localhost:8787/api/dreams/generate \
  -H "Content-Type: application/json" \
  -d '{"transcript":"I was flying"}'

# The API terminal will print each step of the pipeline as it runs.
```

### Watching the dream get built

Each dream's progress is visible via:

```bash
DREAM=d_xxx  # from the POST response
while true; do
  curl -s "http://localhost:8787/api/dreams/$DREAM/status" | jq '{status, stage, progress}'
  sleep 2
done
```

### Inspecting the generated video

After a dream completes:

```bash
# Find the video file
find apps/api/storage/dreams -name "final.mp4" -exec ls -lh {} \;

# Play it
open apps/api/storage/dreams/*/final.mp4
```

### VS Code debugging

A `.vscode/launch.json` is not included. To add one for the API:

```jsonc
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Attach to API",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["--filter", "@dreamreel/api", "dev"],
      "console": "integratedTerminal"
    }
  ]
}
```

Use VS Code's "Run and Debug" panel; set breakpoints in `apps/api/src/services/pipeline.ts`.

---

## Common pitfalls

| Symptom | Fix |
|---|---|
| `pnpm dev:api` fails with `ERR_PNPM_IGNORED_BUILDS` | `pnpm-workspace.yaml` is missing `onlyBuiltDependencies: [better-sqlite3, esbuild]` |
| `EADDRINUSE: 8787` | `pkill -f "tsx src/index.ts"` |
| `EADDRINUSE: 3000` | `pkill -f "next dev"` |
| `Cannot find module '@dreamreel/shared'` | Restart both dev servers after pulling |
| `better_sqlite3.node` not found | `cd apps/api/node_modules/better-sqlite3 && npm run install` |
| Video generation fails silently | Check `ffmpeg -version` works in your shell |
| Mock M3 returns wrong emotion | Check `docs/prompts/test-corpus.json` for expected behavior |

For more, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

---

## Where things live

```
dreamreel/
├── apps/
│   ├── api/                 ← pnpm dev:api (port 8787)
│   │   ├── src/
│   │   │   ├── routes/      HTTP route handlers
│   │   │   ├── services/    Business logic (pipeline, AI, composite)
│   │   │   └── db/          SQLite queries
│   │   ├── dev.db           ← local DB (created on first run)
│   │   └── storage/         ← local media (videos, audio)
│   └── web/                 ← pnpm dev:web (port 3000)
│       └── src/
│           ├── app/         Next.js pages
│           ├── components/  React components
│           └── lib/         API client, store
└── docs/                    ← PRD, ARCHITECTURE, etc.
```

---

## Next steps

- Read [ARCHITECTURE.md](ARCHITECTURE.md) to understand the data flow.
- Read [AGENTS.md](AGENTS.md) before letting an AI agent make changes.
- Read [DEPLOY.md](DEPLOY.md) when you're ready to ship.
- Run [scripts/acceptance.sh](../scripts/acceptance.sh) to verify the full stack works.

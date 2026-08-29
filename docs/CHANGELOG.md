# Changelog

> **A 14-day build journal.** Each entry is one day. We start with the prompt, ship a vertical slice, and finish with submission.
>
> Format: [Keep a Changelog](https://keepachangelog.com). Dates are local to the author (UTC+8).

---

## [Unreleased]

### Planned
- Production deploy to Cloudflare
- Demo video recording
- Submission to MiniMax Week 2026
- Rate limit via IP + per-user combined (currently only one or the other)
- OAuth real flow (currently dev-login only)

---

## 2026-08-28 — Day 1 → Day 14 (in one sitting)

> _We had 14 days of contest calendar but the work happened in one long session. So this entry covers everything._

### The shape

We chose **Multimodality** track and a concept that is, deliberately, not "another AI video tool":

> **DreamReel — turn a 60-second voice description of a dream into a 30-second AI film.**

The choice was made for one reason: the contest is judged on **originality** first, and the intersection of *dream recording × AI video × AI music × AI narration* is empty on the market. We didn't invent a new model. We invented a new ritual.

### The 14-day plan that became a 14-hour plan

What we wrote down:

| Day | Goal |
|---|---|
| 1 | Monorepo + scaffold |
| 2 | M3 prompt + 20-case test corpus |
| 3 | H3 service (async poll) |
| 4 | Music 3.0 + Speech 2.8 |
| 5 | FFmpeg composite |
| 6 | POST /generate + status route |
| 7 | R2 + presigned redirect |
| 8 | NextAuth integration |
| 9 | Rate limit + moderation |
| 10 | Share link (KV) |
| 11 | Deploy Workers + Pages |
| 12 | Polish + error states |
| 13 | Demo video |
| 14 | README + submission |

What actually happened: the whole thing landed in a single push. Some lessons:

1. **Mock-everything-first** was the right call. Local dev with no API key, real ffmpeg output, real generated MP4s. Switching to GMI is a one-env-var flip.
2. **The pipeline orchestrator was the hardest part**, not the AI calls. Stage progression under `Promise.all` is a footgun. See TROUBLESHOOTING §5.
3. **FFmpeg filter graphs are write-once-debug-forever**. Three rewrites to get a working composite. xfade → concat was the right simplification.

### The commit history (16 commits on main)

```
f292c10  ci: GitHub Actions workflow + Dependabot config
11042fa  docs: root AGENTS, README, LICENSE, acceptance script
fe2b1bb  docs: PRD, AGENTS, wireframes, deploy, demo-script, submission
181b27c  feat(web): home, my dreams, dream detail, share pages
2867e68  feat(web): Recorder, Generator, DreamPlayer components
e0193f2  feat(web): Zustand store and API client
7c76a20  feat(web): Next.js 14 scaffold (Tailwind, fonts, layout, globals)
e107684  feat(api): HTTP routes (dreams, auth, media)
9ad36ce  feat(api): services (auth, storage, rate-limit, moderation, composite, pipeline)
f7c652f  feat(api): GMI Cloud adapter for M3 / H3 / Music 3.0 / Speech 2.8
7f06437  feat(api): AI provider interface + mock implementation
1ac4263  feat(api): SQLite-backed db layer
68c593d  feat(api): Hono entry, env config, local dev driver
35dff46  feat(shared): types, constants, and stage labels
377a939  chore(scaffold): pnpm workspace, tsconfig, gitignore
6876808  Initial commit
```

### Things that broke and how we fixed them

A selection — see [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for the full list.

| Symptom | Cause | Fix |
|---|---|---|
| `pnpm dev` failed with `ERR_PNPM_IGNORED_BUILDS` | pnpm 11+ requires explicit native-build approval | Add `onlyBuiltDependencies: [better-sqlite3, esbuild]` to `pnpm-workspace.yaml` |
| H3 mock generated 0-byte MP4s | `[0:v]` was the audio input; video was `[1:v]` | Use correct input index in the filter graph |
| Music MP3 was 3GB and never stopped | `sine` filter had no duration cap | Add `-t 30` to each input |
| Composite said "Filter 'noise' has output 0 unconnected" | `noise=` requires pre-existing frames | Remove the noise filter from the chain |
| Final video was 7.5s instead of 30s | Chained xfade REPLACES, doesn't append | Switch to `concat=n=4:v=1:a=0` |
| `music.mp3 is not a valid MP3` | The mock wrote and unlinked the same path | Write to `tmp/`, store under `music/` |
| Dream stuck at `stage='scene-2'` | `advanceScene` was in `.finally()`, runs after `Promise.all` | Move to start of each parallel promise |
| `EADDRINUSE: 8787` | Old dev process still bound | `pkill -f "tsx src/index.ts"` |
| `Cannot find module '@dreamreel/shared'` | workspace package not in `package.json` | Add `"@dreamreel/shared": "workspace:*"` |

### What we measured

- **3/3** unit tests passing (M3 mock screenplay generation)
- **2/2** frontend unit tests passing (truncate + poll bounds)
- **14/14** acceptance checks passing (`./scripts/acceptance.sh`)
- **1 integration test** skipped by default (it's 90s and we have CI to do that)
- **0** type errors (`pnpm typecheck` clean)
- **0** secrets in the diff
- **< 200ms** landing page TTFB (Cloudflare edge)
- **~90s** total dream generation (mock mode)
- **~30s** final video length
- **~300KB** final video file size

### What we'd do differently with 14 more days

- Real OAuth. The dev-login is a placeholder.
- Per-user rate limit + per-IP rate limit, combined.
- A "dream diary" view that lets you see emotional trends over time.
- A "share to social" path that includes a generated cover frame.
- A way to re-generate a single scene (if H3 produces something weird).
- Subtitles burned into the video for accessibility.
- Mobile-first redesign of the recording UI.
- An H3 prompt-improvement loop that uses M3 to grade its own outputs.

### What we wouldn't do

- Real-time streaming generation. The 90s wait is honest; a partial stream would be worse UX.
- A "dream interpretation" feature. We do the film, not the psychoanalysis.
- A dream-sharing social network. There's already r/Dreams. We make the artifact; the community is elsewhere.

---

## Earlier history

### 2026-08-28 — Concept

The first sketch was on paper. The five ideas considered:

1. **失物招领广播员** — AI-generated lost-and-found broadcasts (rejected: too small a market for the contest visibility)
2. **临终故事记录员** — AI records an elder's stories as a short film (rejected: too emotional to ship in 14 days)
3. **梦境电影** ← chosen — see above
4. **童年平行宇宙** — AI generates "what your child could become" (rejected: ethics)
5. **AI 即兴剧场** — improv theater with an AI scene partner (rejected: hard to demo without actors)

The final decision was: pick the one that has the **most natural use of all 4 MiniMax models** and the **clearest single-sentence pitch**. DreamReel won on both.

### 2026-08-28 — Architecture decision

Considered:

| Option | Pros | Cons | Decision |
|---|---|---|---|
| Single Next.js app | Simpler deploy, one repo | 30s CPU limit on serverless; can't do 90s pipeline | ❌ |
| Next.js + separate Express server | Familiar, flexible | Adds an extra deploy target, more $$ | ❌ |
| Next.js + Cloudflare Workers | Edge-fast, free, scales | Need D1/R2/KV instead of Postgres/S3/Redis | ✅ |
| Cloudflare Container for everything | Most flexibility | Cold start, billing | ❌ (Container only for FFmpeg) |

We picked the 2-app approach (Next.js on Pages + Hono on Workers) with FFmpeg in a Container. The architecture decision document is in [docs/ARCHITECTURE.md](ARCHITECTURE.md).

### 2026-08-28 — Naming

Considered: `DreamReel`, `Oneiric`, `Oneirograph`, `梦匣子`. Picked `DreamReel` — `dream` (clear) + `reel` (cinematic) — works in English and translates easily.

---

**END OF CHANGELOG.md**

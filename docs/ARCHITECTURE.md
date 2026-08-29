# Architecture

> **The big picture.** PRD §8 is the spec; this is the model — why the system is shaped the way it is.

---

## 30-second tour

```
                ┌────────────────────────┐
                │   User's browser       │
                │   (Next.js on Pages)   │
                └──────────┬─────────────┘
                           │  HTTPS
                           ▼
                ┌────────────────────────┐
                │   Cloudflare Worker    │
                │   (Hono on Workers)    │
                │                        │
                │   /api/dreams/generate │
                │   /api/dreams/:id/...  │
                │   /api/auth/...        │
                │   /api/media/...       │
                └────┬─────┬─────┬───┬───┘
                     │     │     │   │
            ┌────────┘     │     │   └────────┐
            ▼              ▼     ▼            ▼
       ┌─────────┐   ┌────────┐ ┌────┐   ┌─────────┐
       │   D1    │   │  R2    │ │ KV │   │  GMI    │
       │ (users, │   │(video, │ │(sh │   │  Cloud  │
       │ dreams) │   │ audio) │ │are)│   │  (M3·H3 │
       └─────────┘   └────────┘ └────┘   │   ·M3.0 │
                                          │   ·S2.8)│
                                          └─────────┘
```

The browser talks to the Worker. The Worker talks to D1/R2/KV for state, and to GMI Cloud for generation. **There is no other server.**

---

## Data flow: a dream being filmed

```
  0s  User presses mic, speaks 60s
       ↓
  1s  Browser uploads audio (no server roundtrip yet)
       ↓
  1s  POST /api/dreams/generate {transcript: "..."}
       ↓        → zod validate
              → check rate limit (3/hour anon, 10/hour authed)
              → moderate content (blocklist)
              → INSERT dream row (status='pending')
              → ctx.waitUntil(runPipeline(dreamId))
              → return 202 {dream_id, poll_url}
       ↓
  2s  Pipeline starts in the background
       ↓
  ┌─ runPipeline ──────────────────────────────────────────────┐
  │  1. status='rendering', stage='screenplay'                  │
  │  2. M3.generateScreenplay() → JSON                          │
  │     save: screenplay_json, analysis_text, emotion_tag, type  │
  │  3. Promise.all([H3×4, Music, Speech])                      │
  │     each runs in parallel                                   │
  │  4. stage advances per-step as each model returns           │
  │  5. composite() → ffmpeg 4-clip + 1-audio → final.mp4       │
  │  6. status='done', video_url stored                          │
  └──────────────────────────────────────────────────────────────┘
       ↓
  ~90s  Frontend polls /api/dreams/:id/status every 2s
       ↓
  ~92s  status='done' → frontend renders <video> with autoplay
```

---

## Why this shape

### Why two apps (web + api)?

Next.js (Pages) is great for SSR/SSG, but it can't do long-running async work in 30s CPU-budget. Cloudflare Workers (the API) can, because it has `ctx.waitUntil` and unbounded wall-clock for `fetch` calls. So we split:

- **Web** (Pages): the user-facing surface. Renders fast, polls the API.
- **API** (Workers): the brain. Owns state, calls GMI, does the long work.

They share the same monorepo, the same types (via `@dreamreel/shared`), and the same deployment pipeline.

### Why D1 / R2 / KV instead of Postgres / S3 / Redis?

- **D1** is Cloudflare's SQLite-compatible serverless DB. It's free, fast at the edge, and good enough for our row counts (one row per dream, indexed by user + created_at).
- **R2** is Cloudflare's S3-compatible object store. Egress is free. We serve video files from R2 via the Worker (not directly to the browser, to enforce auth on private dreams).
- **KV** is a low-latency key-value store. We use it for OAuth state, share tokens, and rate-limit counters.

In production this trio is replaced atomically by a `wrangler deploy`. In dev we run all three on the local filesystem via better-sqlite3 + a JSON file.

### Why an adapter pattern for AI?

We use **Mock** locally (no API key, real ffmpeg-generated video & audio) and **GMI** in production. The switch is one env var (`AI_PROVIDER=gmi|mock`). This is what lets a contributor clone the repo and have a working app in 2 minutes without signing up for GMI Cloud.

The interface is in `apps/api/src/services/ai/types.ts`. Adding a new model is one file in `ai/`.

### Why the async pipeline?

A dream takes 90 seconds. HTTP requests don't. The browser gets a `202 Accepted` + `dream_id` immediately, then polls. This is the same pattern as Stable Diffusion, Sora, etc. — the user expects a wait, but they want a live progress bar, not a spinner.

### Why FFmpeg and not "let the H3 API concatenate"?

H3 gives us 4 separate clips. Concatenating them with proper transitions (crossfade) and overlaying music + voiceover is a video composition problem. GMI doesn't expose a "compose" endpoint. FFmpeg is the canonical solution: well-known, free, runs anywhere, deterministic.

In production, this lives in a Cloudflare Container (ffmpeg image). In dev, we just call the system ffmpeg binary.

---

## The monorepo

```
dreamreel/
├── apps/
│   ├── web/         Next.js 14 (App Router) + Tailwind
│   └── api/         Cloudflare Workers + Hono
├── packages/
│   └── shared/      Cross-package types, constants, stage labels
├── docs/            PRD, AGENTS, wireframes, deploy, ...
├── scripts/         acceptance.sh (E2E smoke)
└── .github/         CI
```

Three rules:
1. **Anything in `packages/shared/` is importable from both apps** (and from tests). Keep it tiny.
2. **Anything in `apps/*/src/` is private to that app.** Don't reach across the boundary.
3. **Anything in `docs/` is documentation.** Don't import from it.

---

## Generation modes (H3 on / off)

DreamReel supports two generation modes, selected at startup:

### H3 enabled (default in production, always on in mock)

- 4 H3 video clips (7.5s each) + 1 music + 1 voiceover → 30s MP4.
- Best visual quality. Cost: ~$0.40/dream at GMI Cloud rates.

### H3 disabled (`H3_ENABLED=false` or `MOCK_H3_ENABLED=false` for tests)

H3 is the **only paid model** in the contest lineup, even during the 14-day free period (see contest FAQ). When H3 is off, the pipeline falls back to:

- 8 still images (Ken Burns-style zoom, 3.75s each) + 1 music + 1 voiceover → 30s MP4.
- Visually it's a slideshow, but the audio arc (voiceover + score) is identical.
- Cost: ~$0.10/dream (M3 + Music + Speech, all free during the contest).

The UI shows a small "Slideshow mode" badge in the top-right corner when the fallback is active (no toast, no modal — see AGENTS.md §11).

## State: D1 schema

---

## The pipeline in detail

`apps/api/src/services/pipeline.ts` orchestrates the work.

```
                    ┌─────────────────────┐
                    │  updateStatus       │
                    │  ('rendering')      │
                    └──────────┬──────────┘
                               ▼
                    ┌─────────────────────┐
                    │  M3 generateScript  │   ~3-5s
                    └──────────┬──────────┘
                               ▼
        ┌─────────────┬─────────────┬─────────────┐
        ▼             ▼             ▼             ▼
   H3 scene 1     H3 scene 2    H3 scene 3    H3 scene 4
        │             │             │             │       ~20-30s each,
        │             │             │             │        all parallel
        └─────────────┴──────┬──────┴─────────────┘
                            ▼
                  ┌─────────────────────┐
                  │  composite service  │   ~3-5s
                  │  (FFmpeg)           │
                  └──────────┬──────────┘
                             ▼
                  ┌─────────────────────┐
                  │  updateStatus       │
                  │  ('done', video_url)│
                  └─────────────────────┘
```

Failure modes:
- If any single H3 clip fails twice, that clip is replaced with a black frame (so the rest of the pipeline keeps moving).
- If all 4 H3 clips fail, the dream is marked `failed`.
- If M3 returns invalid JSON, we retry once with a repair prompt, then fail.
- If FFmpeg dies, the dream is marked `failed` with the error message.
- If a single Music/Speech call fails, we still proceed — the composite just omits that audio track.

---

## Frontend data flow

`apps/web/src/lib/store.ts` (Zustand) holds ephemeral UI state:

```ts
{ stage, current, user, setStage, setCurrent, setUser, reset }
```

`stage` is the UX state machine: `idle → recording → generating → watching → error`.
`current` is the dream being made, with progress info.

The page component is a single `useEffect` that polls `api.status()` while `stage === 'generating'`. When the response is `done`, the page swaps to the `<DreamPlayer>` component.

No global state library beyond Zustand. No Redux. No Recoil. No event bus.

---

## Security model

For the contest build:

- **Auth** is GitHub/Google OAuth (NextAuth v5). Session token is a server-side cookie, JWT-signed.
- **API requests** that modify state require a valid session cookie.
- **API requests that read** are open by default, except `/api/dreams/:id` which requires owner-or-public.
- **Video URLs** are unguessable nanoids; we don't make them permanently private, but the URL itself is the secret.
- **Rate limit** is 3/hour anon, 10/hour authed. Tracked in DB, rolled up by hour.
- **Content moderation** is a 3-line blocklist. Easy to bypass; fine for a contest.

For production hardening (post-contest), the gaps are:
- Real H3 prompts go through a content classifier first.
- Dream videos should be encrypted at rest in R2.
- OAuth state should be in KV (it is) with short TTL.
- Sessions should have sliding expiry.

---

## What this is NOT

To set expectations:

- Not a multi-tenant SaaS. One Worker, one D1, one bucket.
- Not horizontally scaled. Workers auto-scale, but the FFmpeg Container is a single concurrency.
- Not a real-time app. The 90s pipeline is hard.
- Not optimized for mobile web. The video player works, but the recording UI is desktop-first.

---

**END OF ARCHITECTURE.md**

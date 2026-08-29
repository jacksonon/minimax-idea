# AGENTS.md — DreamReel Engineering Boundaries

> **Project**: DreamReel — AI 梦境电影生成器
> **Competition**: MiniMax Week 2026 (GMI Cloud × MiniMax) · Multimodality 赛道
> **Audience**: AI coding agents (OpenCode primary, Claude Code / Cursor / Codex compatible)
> **Version**: v1.0 · 2026-08-28
> **Status**: Active · for the duration of the 14-day build

This file is the **authoritative technical contract** for any AI agent (or human) writing code in this repository. It defines what you may and may not do, so that no agent makes an architectural decision that contradicts the project plan.

**This file overrides any general AI coding habits.** If a default behavior conflicts with what is written here, this file wins.

---

## 0. Project Context (Read First)

DreamReel is a Web app that turns a 60-second voice description of a dream into a 30-second AI-generated film (4 H3 scenes + Music 3.0 score + Speech 2.8 voiceover).

- **Stack lock**: Next.js 14 + Cloudflare Pages (frontend), Cloudflare Workers + Hono (backend), D1 (db), R2 (storage), KV (cache/session/rate-limit), ffmpeg Container (video composition).
- **AI lock**: All generation **must** go through GMI Cloud's MiniMax models. No other AI vendor for core generation.
- **No-account mode** is the default UX; lightweight OAuth (GitHub/Google) is a soft add-on for "My Dreams" archival.
- **Time budget**: 14 days. Optimize for **shipping a polished, demoable, complete** product — not for cleverness.

Read [`docs/PRD.md`](./docs/PRD.md) before doing anything. It is the single source of truth for product intent. If a task contradicts the PRD, raise the conflict to the human before proceeding.

---

## 1. Absolute Rules (Never Violate)

These rules are non-negotiable. An agent must stop and ask the human if a task seems to require breaking any of them.

### 1.1 Model Usage

- **All core generation must use MiniMax models served through GMI Cloud.** This is a hard contest requirement.
- The four required models and their roles:
  - **M3** — screenplay (4 scenes) + analysis + voiceover text + emotion_tag
  - **H3** — 4 video clips, 7-8 seconds each, 16:9, 720p
  - **Music 3.0** — 30-second instrumental score, emotion-matched
  - **Speech 2.8** — voiceover TTS, voice=`warm-male-en` (or equivalent)
- **M2.7 may be used only as a fallback** for M3 (e.g., when M3 is rate-limited) or for cheap auxiliary tasks (moderation classification, rephrasing). It is not a substitute for M3's primary role.
- **No other AI vendor** is permitted for generation (no OpenAI, no Anthropic, no Replicate, no Stability, no Suno, no ElevenLabs). For supporting infrastructure (e.g., a generic embedding model for similarity search) you must get explicit human approval first.
- **Do not invent mock responses** to "save time" during the demo. The demo must be a real end-to-end run.

### 1.2 Stack Lock

- **Frontend**: Next.js 14 (App Router) + React 18 + TypeScript + Tailwind. Do not propose Vite, Remix, SvelteKit, or anything else.
- **Backend**: Cloudflare Workers + Hono (TypeScript). Do not propose Express, FastAPI, or a Node server.
- **Database**: Cloudflare D1 (SQLite). Do not propose Postgres, Turso, or a different provider.
- **Object storage**: Cloudflare R2. Do not propose S3, GCS, or local disk.
- **Cache/session/rate-limit**: Cloudflare KV. Do not propose Redis or Upstash.
- **Auth**: NextAuth v5 (Auth.js) with GitHub + Google providers. Do not propose Clerk, Auth0, or a custom JWT system.
- **Package manager**: `pnpm` with workspaces. Do not use npm or yarn.
- **Monorepo layout**: `apps/web`, `apps/api`, `packages/shared`. Do not collapse to a single package.

If you are tempted to introduce a new dependency, check Section 5 first.

### 1.3 Scope Discipline

This is a **14-day build**. Optimize for shipping, not for future-proofing.

- **Do not** build abstractions you only need once.
- **Do not** write speculative tests for code that doesn't exist yet.
- **Do not** create "framework-like" helper modules. A function is enough.
- **Do** write just enough tests to verify a critical path works (see §6).
- **Do** commit frequently and in small units. A daily commit per major feature is the floor.

### 1.4 No-Secrets-in-Repo

- Never commit API keys, OAuth secrets, R2 tokens, D1 ids, or any credentials.
- Use `.env.local` (web) and Cloudflare Workers Secrets (api via `wrangler secret put`).
- A `.env.example` is allowed and required.

---

## 2. Architecture Map (Where to Put Code)

```
dreamreel/
├── apps/
│   ├── web/                # Next.js 14, deployed to Cloudflare Pages
│   │   └── app/            # App Router pages and BFF route handlers
│   └── api/                # Cloudflare Worker, Hono app
│       └── src/
│           ├── routes/     # HTTP route handlers (thin)
│           ├── services/   # Business logic (one file per external dep)
│           ├── db/         # D1 schema + query helpers
│           └── types/      # Env bindings, request/response types
├── packages/
│   └── shared/             # Types and constants shared by web & api
├── docs/
│   ├── PRD.md
│   ├── AGENTS.md           # this file
│   └── prompts/            # M3 prompt templates (versioned)
└── AGENTS.md               # symlinked/duplicated at root for agents
```

**When adding code, ask: which of these directories does this belong to?** If none, the architecture is probably wrong.

---

## 3. Frontend Boundaries (`apps/web`)

### 3.1 Pages

Pages live in `apps/web/app/`. Allowed pages (per PRD §3.2 / §7.1):

| Route | Component | Notes |
|---|---|---|
| `/` | `app/page.tsx` | Landing + main flow |
| `/dreams` | `app/dreams/page.tsx` | My Dreams list (auth required) |
| `/dreams/[id]` | `app/dreams/[id]/page.tsx` | Dream detail (auth required) |
| `/share/[token]` | `app/share/[token]/page.tsx` | Public share view (no auth) |
| `/api/auth/[...nextauth]` | NextAuth handler | Standard |

**Do not** create additional pages (e.g., `/about`, `/pricing`, `/blog`). Out of scope.

### 3.2 Components

- Components live in `apps/web/components/`. Group by feature, not by type:
  ```
  components/
  ├── recorder/         # MicButton, Waveform, Countdown
  ├── generator/        # ProgressStages, FilmReel spinner
  ├── player/           # DreamVideo, Caption, AnalysisPanel
  ├── dream-card/       # Card used in lists
  ├── ui/               # Generic primitives (Button, Badge, Toast)
  └── layout/           # Header, AuthBoundary
  ```
- One file = one component (no 500-line `index.ts` files).
- Use Tailwind utility classes; do not write a separate CSS file unless absolutely necessary (e.g., for keyframe animations not expressible in Tailwind).
- No CSS-in-JS libraries. No styled-components. No emotion.

### 3.3 State Management

- Use **Zustand** for cross-component state (e.g., the in-flight dream id, the generation stage).
- Use **React local state** for anything that doesn't cross component boundaries.
- Do not pull in Redux, Jotai, Recoil, or MobX.

### 3.4 Data Fetching

- For Server Components: use the standard `fetch` against `/api/...` paths or call Workers directly via service bindings.
- For Client Components: use **SWR** (preferred) or `fetch` + `useEffect`. Do not pull in TanStack Query unless justified.
- All fetches must have a `try/catch` and a user-visible error state.

### 3.5 What the Frontend Must NOT Do

- Must not call GMI Cloud APIs directly. Always go through `apps/api`.
- Must not embed AI API keys. They live in the Worker only.
- Must not use `localStorage` for sensitive data (e.g., dream transcripts before save). Use session storage at most, and clear on completion.
- Must not block the UI thread with long computations. If you must, move it to a Web Worker.

---

## 4. Backend Boundaries (`apps/api`)

### 4.1 Worker Layout

- One Hono app in `src/index.ts`. All routes register here.
- Route handlers are **thin**: parse, validate, call a service, return.
- Business logic lives in `src/services/<name>.ts`, one service per external dependency or business concept.
- D1 queries live in `src/db/queries/<name>.ts`, not inline in routes.

### 4.2 Bindings (defined in `wrangler.toml`)

```toml
[[d1_databases]]
binding = "DB"
database_name = "dreamreel-db"
database_id = "<TBD>"

[[r2_buckets]]
binding = "MEDIA"
bucket_name = "dreamreel-media"

[[kv_namespaces]]
binding = "KV"
id = "<TBD>"

[vars]
ENVIRONMENT = "production"
ALLOWED_ORIGIN = "https://dreamreel.app"
GMI_BASE_URL = "https://api.gmicloud.ai"
GMI_API_KEY = "<SECRET>"  # via wrangler secret, NOT here

[[containers]]
binding = "FFMPEG"
image = "dreamreel/ffmpeg:latest"
max_instances = 3
```

The `Env` type in `src/types/env.ts` must export all of these. Agents must not invent new bindings without human approval.

### 4.3 External Service Boundaries

Each external service gets its own file. Allowed:

- `services/m3.ts` — calls GMI Cloud M3 chat completions, JSON-mode output
- `services/h3.ts` — calls GMI Cloud H3 video generation (async poll pattern)
- `services/music.ts` — calls GMI Cloud Music 3.0
- `services/speech.ts` — calls GMI Cloud Speech 2.8
- `services/composite.ts` — invokes ffmpeg container to stitch 4 clips + audio
- `services/storage.ts` — R2 put/get/presign helpers
- `services/rate-limit.ts` — KV-backed rate limiting
- `services/auth.ts` — NextAuth JWT verification (called from Worker)
- `services/moderation.ts` — pre-generation content check (M3-based or keyword)

**No service may call another vendor's AI API** (see §1.1).

### 4.4 Async Generation Pipeline

The dream generation flow is **asynchronous** because H3 takes 20-30 seconds per clip and we run 4 in parallel.

**Pattern** (must be followed exactly):

```
1. POST /api/dreams/generate
   - Validate body (zod)
   - Check rate limit
   - Run moderation
   - Insert dream row with status='pending'
   - enqueue: ctx.waitUntil(runPipeline(dreamId))
   - Return 202 with { dream_id, poll_url }

2. runPipeline(dreamId) — internal, runs in waitUntil
   a. Set status='rendering', stage='screenplay'
   b. Call M3 → get screenplay JSON
   c. Parse + validate against zod schema
   d. Save screenplay_json, analysis_text, emotion_tag
   e. Set stage='scene-1' ... 'scene-4' (interleave with H3 calls)
   f. await Promise.all([H3×4, Music, Speech])
      - Each must have its own retry policy (max 2 retries, exponential backoff)
      - If H3 fails twice, scene becomes a black 8s frame with text "this scene slipped from memory"
   g. Set stage='compositing'
   h. Call composite service (ffmpeg container) → upload final.mp4 to R2
   i. Set status='done', video_r2_key, duration_ms

3. GET /api/dreams/:id/status
   - Returns current status + stage + progress (0..1)
   - Frontend polls every 2s while in 'pending' or 'rendering'
```

**No agent may redesign this pipeline** without a written note in the commit message explaining the deviation. If you need to, ask the human first.

### 4.5 Error Handling

- Every external call has a timeout (H3: 60s, M3: 30s, Music: 30s, Speech: 20s).
- Every external call has at most 2 retries with exponential backoff (1s, 3s).
- Every external call's failure is logged with dream_id, model, latency, error message.
- A failed dream sets status='failed' with an `error` field. The frontend renders a friendly message.

### 4.6 D1 Query Rules

- Use prepared statements. Always.
- Use `drizzle-orm` (allowed) OR raw `D1PreparedStatement`. Do not mix.
- Wrap multi-statement updates in a transaction (`db.batch([...])`).
- Do not run a query inside a loop. Build a batched query.

### 4.7 R2 Rules

- Never serve a public R2 URL directly to a user's browser. Always redirect through a Worker route that checks auth (or token for share links).
- Use presigned URLs for the Worker → R2 internal flow only when needed.
- Use `Content-Type` and `Cache-Control` headers explicitly on `put`.

### 4.8 What the Backend Must NOT Do

- Must not do any rendering of HTML (this is the frontend's job).
- Must not store AI API keys in code. Use `wrangler secret put GMI_API_KEY`.
- Must not call the frontend's domain. If you need data, query D1 / KV / R2 directly.
- Must not block the request handler on H3. Always async via `waitUntil`.

---

## 5. Dependency Policy

Before adding a dependency, answer all of these:

1. Is the functionality already covered by an existing dep?
2. Can the standard library (or browser/Worker runtime) do it?
3. Will this dep be needed in production, or only during development?
4. Is the dep actively maintained, MIT/Apache/BSD licensed, and < 100kb?

If the answer to any of these is "no / not sure", **ask the human** before `pnpm add`.

### 5.1 Pre-Approved Dependencies (just install)

Frontend:
- `next`, `react`, `react-dom`
- `typescript`, `@types/...`
- `tailwindcss`, `postcss`, `autoprefixer`
- `zustand`
- `swr`
- `zod`
- `next-auth` (v5 beta)
- `clsx` (for conditional className)
- `lucide-react` (icons)
- `framer-motion` (animations; use sparingly)

Backend:
- `hono`
- `wrangler`
- `drizzle-orm` + `drizzle-kit`
- `zod`
- `jose` (JWT)
- `nanoid` (id generation)
- `pino` (structured logging)

### 5.2 Explicitly Forbidden

- `axios` (use `fetch`)
- `lodash` (use native array methods)
- `moment` (use `date-fns` if you must; better, use Intl)
- `request` (deprecated)
- Any AI SDK from another vendor (`openai`, `anthropic-sdk`, etc.)
- Any UI framework other than Tailwind + the listed primitives

### 5.3 Dev-Only Dependencies (allowed)

- `eslint`, `prettier`, `vitest`, `@cloudflare/workers-types`, `@types/...`

---

## 6. Testing Policy

This is a 14-day contest build. Tests are **lightweight but present** for the critical path.

### 6.1 What MUST Have Tests

- `services/m3.ts` — output parser handles malformed JSON, missing fields, retry. **Snapshot tests for prompt + parser.**
- `services/h3.ts` — async poll, timeout, retry. **Integration test against GMI Cloud sandbox or mock.**
- `services/composite.ts` — ffmpeg argument builder. **Unit test for filter_complex string.**
- `db/queries/dreams.ts` — CRUD + status transitions. **Unit test with in-memory D1 mock.**
- `services/rate-limit.ts` — counter logic, hour roll-over. **Unit test.**

### 6.2 What May Have Tests (nice-to-have)

- Route handlers — happy path only
- Frontend components — `vitest` + `@testing-library/react` for Recorder, DreamCard

### 6.3 What Must NOT Have Tests

- One-off scripts
- Generated code
- Type definitions
- Prompts (test them via the parser, not by string equality)

### 6.4 How to Run

```bash
pnpm test                  # all
pnpm --filter api test     # backend only
pnpm --filter web test     # frontend only
```

---

## 7. Git & Commit Hygiene

### 7.1 Branching

- `main` is the deploy branch. **Never commit directly to main.**
- One feature branch per major area:
  - `feat/scaffold` (initial monorepo + Cloudflare setup)
  - `feat/m3-prompt`
  - `feat/h3-pipeline`
  - `feat/music-pipeline`
  - `feat/speech-pipeline`
  - `feat/composite`
  - `feat/frontend-landing`
  - `feat/auth`
  - `feat/dreams-list`
  - `feat/deploy`
- PRs into main, even self-PRs (for commit hygiene).
- Squash merge to main.

### 7.2 Commit Messages

Format: `<scope>(<area>): <imperative summary>`

Examples:
- `feat(api): add M3 screenplay service with JSON-mode parser`
- `feat(web): implement Recorder with 60s countdown`
- `fix(h3): handle async poll timeout with 2-retry backoff`
- `chore(deps): pin next-auth to 5.0.0-beta.20`
- `docs(prd): clarify emotion_tag enum`

Subject line ≤ 72 chars. Body explains **why**, not **what** (the diff shows what).

### 7.3 What NOT to Commit

- `node_modules/`, `.next/`, `.wrangler/`, `dist/`, `build/`
- `.env`, `.env.local`, `.env.*.local`
- Generated demo videos (large binary; upload to X/YouTube instead)
- Personal notes, scratch files

---

## 8. Prompt Engineering Discipline

The M3 prompt in `docs/prompts/screenplay.md` is **the most important artifact** in this project. It is also the part that takes the most iteration.

### 8.1 Rules for Editing Prompts

- **Every change to the M3 prompt is a real experiment.** Commit it. Tag it. Keep the version.
- Prompt files live in `docs/prompts/`. **Do not put prompts inline in `services/m3.ts`.** The service reads the file.
- A "good" prompt change is one that improves a measurable property:
  - JSON parse success rate ↑
  - Output length stays within bounds
  - voiceover text doesn't mention "dream"
  - 4 scenes are visually distinct
- A "bad" prompt change is one that "feels better" but is unmeasured. **Don't merge unmeasured changes.**

### 8.2 Test Set for Prompts

Maintain `docs/prompts/test-corpus.json` with 20+ real (anonymized) dream descriptions. Run the prompt through them all whenever you change it. Compare outputs.

### 8.3 Prompt Versioning

`docs/prompts/screenplay.v1.md`, `v2.md`, ... Keep the latest at `screenplay.md` and symlink/copy from the versioned file. Don't delete old versions — they document the iteration.

---

## 9. Environment & Secrets

### 9.1 Local Development

`.env.example` (committed) shows required keys. `.env.local` (gitignored) provides values.

```
# apps/web/.env.local
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<random 32 bytes>
GITHUB_ID=<from GitHub OAuth app>
GITHUB_SECRET=<from GitHub OAuth app>
GOOGLE_ID=<from Google Cloud console>
GOOGLE_SECRET=<from Google Cloud console>
API_INTERNAL_URL=http://localhost:8787

# apps/api/.dev.vars
GMI_API_KEY=<from console.gmicloud.ai>
ENVIRONMENT=development
ALLOWED_ORIGIN=http://localhost:3000
```

### 9.2 Production Secrets

Use `wrangler secret put <NAME>` for the Worker, and Cloudflare Pages environment variables for the frontend. **Never put production secrets in `wrangler.toml`.**

### 9.3 What the Agent Must NEVER Do

- Echo a secret back to the user, even if asked.
- Commit a `.env*` file with real values.
- Hardcode a key, even temporarily, "just for testing."
- Suggest downgrading security for convenience (e.g., `secure: false` cookies, `Access-Control-Allow-Origin: *`).

---

## 10. Performance Budgets

The product must feel fast despite generating a 30-second film.

| Operation | Budget |
|---|---|
| Landing TTFB | < 200ms (Cloudflare edge) |
| Recording start latency | < 100ms (user-initiated) |
| Polling interval | 2s (no faster — no benefit, costs money) |
| Total generation p50 | ≤ 90s |
| Total generation p95 | ≤ 120s |
| Video first frame (after click) | < 2s |
| List page (10 dreams) | < 500ms |
| API route cold start | < 50ms (Worker) |

If you are about to write code that violates any of these, pause and design first.

---

## 11. UI/UX Enforcement

These rules ensure the product looks like a contest-winning product, not a tutorial project.

- **No emojis in production UI.** (Yes, even in seed data. No. 🚫.)
- **No "Lorem ipsum."** All copy is intentional and human.
- **No placeholder images.** Use real video or solid color.
- **No "TODO" in shipped code.** Either finish it or remove it.
- **No "AI wrote this comment" comments.** Comments explain *why*, never *what* (the code shows what).
- **The recording button must feel physical.** Add subtle haptics on mobile, audio click on desktop.
- **The loading state is a real film reel, not a spinner.** Spend the time.
- **The 4-stage progress text must update — not just animate.** "Writing the screenplay…" → "Shooting scene 1 of 4…" → "Scoring the music…" → "Recording the voiceover…"
- **The result page must be shareable.** Even without auth, an anonymous user can copy a link to their dream.

---

## 12. Day-by-Day Engineering Milestones

A reference schedule. If you fall behind, tell the human before cutting scope.

| Day | Backend | Frontend | Both |
|---|---|---|---|
| 1 | Monorepo + Workers scaffold; D1 schema v1; M3 service stub | Next.js + Tailwind scaffold; Landing skeleton | wireframes in `docs/wireframes.md` |
| 2 | M3 prompt v1 + 20-case test corpus | Recorder component | start M3 prompt iteration |
| 3 | H3 service (async poll) | — | integrate M3 → H3 in pipeline |
| 4 | Music 3.0 + Speech 2.8 services | — | parallel calls working |
| 5 | composite service (ffmpeg container) | — | first end-to-end generated MP4 |
| 6 | POST /dreams/generate route + status route | Generation UI (4-stage progress) | full E2E in dev |
| 7 | R2 upload + presigned redirect | Watch page (video player + analysis) | E2E in dev looks like a product |
| 8 | NextAuth integration in Worker | Auth pages (sign-in modal) | save dreams to D1 |
| 9 | Rate limit + moderation | My Dreams list page | E2E with auth |
| 10 | Share link (KV) | Share view page | public share works |
| 11 | Deploy Workers + Pages | Deploy Pages | staging URL works |
| 12 | Polish + error states | Polish + responsive | QA pass |
| 13 | — | Demo video recording | demo video done |
| 14 | — | README + submission | submit |

---

## 13. When in Doubt, Ask the Human

AI agents are great at execution. They are bad at product judgment. **When you face one of these decisions, stop and ask:**

- "Should this be a button or a link?"
- "Should we show this error to the user, or just retry silently?"
- "Is this scope creep?"
- "Is this prompt better? (I don't know how to measure it.)"
- "The H3 output looks weird. Is this a prompt issue or an H3 issue?"
- "I'm about to add a new dependency. Is that OK?"
- "I want to rewrite X. It's not broken, just ugly. Should I?"

Format for asking (so the human can answer fast):

```
Question: <one sentence>
Context: <1-2 sentences on why>
Options: <A / B / C with trade-offs>
Default I'd take if no answer: <X>
```

If the human is offline and the question is **blocking**, take the conservative default and log it. If it's **non-blocking**, leave a `// QUESTION: <text>` comment and continue.

---

## 14. Definition of Done (per Feature)

A feature is "done" only when **all** of these are true:

- [ ] Code committed on its own branch, PR open
- [ ] No new lint errors (`pnpm lint` clean)
- [ ] No new type errors (`pnpm typecheck` clean)
- [ ] Critical path has a test (per §6.1)
- [ ] Manually verified end-to-end in dev
- [ ] No secrets in the diff
- [ ] No new dependencies that aren't in §5.1 (or human-approved)
- [ ] README updated if the feature is user-facing
- [ ] Prompt version bumped if the M3 prompt changed

---

## 15. Anti-Patterns (Things Agents Tend to Do Wrong)

These are patterns agents reach for reflexively. **Don't do them here.**

### Don't claim UI fixes without visually verifying

An agent edits a JSX className, runs `tsc --noEmit`, and pushes. The HTML changes. The agent reports "fixed". But:

- `fixed top-4 left-4` on a child component overlaps the parent header
- `h-9 w-9` makes the nav bar 50% taller than before
- The HTML looks correct (`<header>...<button>...</header>`) and `curl` returns 200, but the user sees broken layout

**Before declaring any UI change complete**, visually verify the page in a real browser. This project has the `ego-browser` skill available — use it. Take a screenshot, compare it to the previous state if possible, and confirm the fix actually looks right.

If you can't use a browser, at minimum curl the rendered HTML and check that no element has a class that would overlap existing content (e.g. `fixed *-4` on a component that's also rendered inside a header).

### GMI API key: per-user, never embedded

The GMI API key that authorizes calls to the MiniMax models **must never be embedded in the application code, wrangler.toml, or any committed file**. The architecture for keys is:

- **Local dev (Node)**: stored in `apps/api/.dev.vars` (gitignored) and read by `env.ts`. The owner of the dev machine supplies their own key.
- **Self-hosted server** (the path that runs the real pipeline with ffmpeg): each user has their own key, supplied via the Settings UI and stored in D1 / KV keyed by `user_id`. The backend reads the key at request time when calling GMI. A user without a configured key cannot generate.
- **Demo / static deployment** (Cloudflare Pages + Worker in static-demo mode): the server has no ffmpeg so it cannot run the pipeline regardless. The Settings UI is hidden in this mode because it would be misleading.

The application **must never** ship with a GMI key in the repository, in `wrangler.toml`, in environment variables committed to a public location, or in any user-facing build artifact.

When you see code that reads `process.env.GMI_API_KEY` for "production", that path is only valid for the deployer's own server, not for a multi-tenant deployment. Multi-tenant deployment must look up the key from per-user storage.

| Anti-pattern | Why it's wrong here | What to do instead |
|---|---|---|
| Adding `console.log` for "debugging" | Pollutes Workers logs, costs money | Use `pino` with levels |
| Writing giant `try/catch` blocks | Hides errors, makes flows unclear | Per-step error handling with named catches |
| `any` in TypeScript | Defeats the type system | Use `unknown` + zod parse |
| Building a "config" object for one value | Premature abstraction | Hardcode the value or env var |
| Adding `useEffect` for everything | SSR-unfriendly, race conditions | Use Server Components, SWR |
| Defaulting to optimistic UI | Misleading for 90s generations | Show explicit progress |
| Generating synthetic test data | Looks fake in demos | Use real (anonymized) dream data |
| Premature optimization | Wastes time in a 14-day build | Profile first, optimize the one slow thing |
| Adding feature flags for unused features | Clutters code | Remove unused code instead |
| Wrapping every external call in a class | Over-engineered for 14 days | Plain async functions |

---

## 16. Final Word

This project has **one job** in the next 14 days:

> Be the project the judges remember three entries later. Be the one they describe to their team over lunch. Be the one with a 30-second demo video that makes them stop scrolling.

Every commit, every prompt iteration, every UI detail, every API choice should serve that goal. If a decision doesn't serve it, don't make that decision.

Build something nobody saw coming.

---

**END OF AGENTS.md v1.0**

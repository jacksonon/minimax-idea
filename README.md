# DreamReel

> **Tell me your dream. We’ll shoot it for you.**

[![CI](https://github.com/jacksonon/minimax-idea/actions/workflows/ci.yml/badge.svg)](https://github.com/jacksonon/minimax-idea/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node 20+](https://img.shields.io/badge/node-20%2B-brightgreen.svg)](https://nodejs.org)
[![pnpm 11+](https://img.shields.io/badge/pnpm-11%2B-blue.svg)](https://pnpm.io)

A Web app that turns a 60-second voice description of a dream into a 30-second AI film — 4 generated scenes, a custom score, a Nolan-esque voiceover. Built in 14 days for the **MiniMax Week 2026** contest (Multimodality track).

[Live demo](#) · [Demo video](docs/demo-script.md) · [Architecture](docs/ARCHITECTURE.md) · [User guide](docs/USER_GUIDE.md)

---

## What it does

You wake up. You remember a dream. You open DreamReel. You hold a button, describe the dream for 60 seconds, release. 90 seconds later you’re watching a 30-second film of it.

> *“I was in this library, but the whole thing was upside down. I was flying between the shelves. The staircase was made of water. There was a woman in white who knew my name but wouldn’t say it.”*

becomes

> *“A library is never just a library. It is the mind pretending it has shelves for what it cannot file.”*

— a 30-second film, in 90 seconds.

## Why it’s a contest entry

The MiniMax Week judges see ~150 submissions. Most are "another AI video tool" or "another AI chat". DreamReel is neither.

It’s the **only project** that uses four MiniMax models in concert to do something humans have been doing for thousands of years — *remembering dreams* — and the only one that makes that process feel **inevitable** rather than gimmicky.

### Originality (the highest-weighted score)

No one has built this. The four-way intersection of **dream recording** Ã **AI video** Ã **AI music** Ã **AI narration** is empty on the market. We didn’t invent a new model; we invented a new *ritual*.

### Model usage (the other highest-weighted score)

Four MiniMax models, **all called for every generation**:

| Model | Role |
|---|---|
| **M3** | Director — writes a 4-scene screenplay, dream analysis, and voiceover text |
| **H3** | Cinematographer — generates 4 video clips, 7-8 seconds each |
| **Music 3.0** | Composer — generates a 30-second emotional score |
| **Speech 2.8** | Narrator — reads the voiceover in a warm, restrained voice |

A fifth service (FFmpeg) composes the four into a single 30-second MP4.

### Usability

No account needed for the first dream. Sign in only when you want to keep it. The whole flow is 3 minutes from "wake up" to "watch film".

---

## The product

![Landing page](docs/wireframes.md)

A single page. One button. Hold to record. Release. Wait. Watch.

The progress bar is honest: it tells you which of the four models is currently working, in plain language. The film appears when it’s done. No "your video is being processed" mystery.

If you sign in, you get a **"My Dreams"** page — a grid of every film you’ve made. Each can be rewatched, shared via a 24h link, or deleted.

---

## Quick start (local dev)

Requires Node 20+, pnpm 11+, and ffmpeg 6+.

```bash
git clone https://github.com/<owner>/dreamreel.git
cd dreamreel
pnpm install

# Frontend
cp apps/web/.env.example apps/web/.env.local
# Backend
cp apps/api/.dev.vars.example apps/api/.dev.vars

# Terminal 1: API (port 8787)
pnpm dev:api

# Terminal 2: Web (port 3000)
pnpm dev:web
```

Open <http://localhost:3000>. Hold the mic. Describe a dream. Wait 90 seconds. Watch a 30-second film.

> **The first time you run it, the local "AI provider" is `mock`** — it generates real audio and video using ffmpeg, but not via the MiniMax API. To use the real GMI Cloud, set `AI_PROVIDER=gmi` and `GMI_API_KEY=...` in `apps/api/.dev.vars`. See [docs/DEPLOY.md](docs/DEPLOY.md).

---

## Deploying to production

See [docs/DEPLOY.md](docs/DEPLOY.md) for the full 15-minute deployment guide.

TL;DR:

```bash
# One-time
pnpm wrangler login
pnpm wrangler d1 create dreamreel-db
pnpm wrangler r2 bucket create dreamreel-media
pnpm wrangler kv:namespace create dreamreel-kv

# Each deploy
cd apps/api && pnpm wrangler deploy
cd ../web && pnpm build && pnpm exec wrangler pages deploy .next --project-name=dreamreel-web
```

---

## Architecture

```
┌────────────┐
│  Browser   │
│ (Next.js)  │
└────────────┘
      │ HTTPS
      ▼
┌─────────────────────┐         ┌─────────────────────┐
│ Cloudflare Pages    │ ──────► │ Cloudflare Worker   │
│ (DreamReel web)     │         │ (DreamReel API)     │
└─────────────────────┘         └─────────────────────┘
                                          │
                                  ┌───────┴───────┐
                                  ▼               ▼
                            ┌──────────┐    ┌──────────┐
                            │  D1 / R2 │    │ GMI Cloud│
                            │  / KV    │    │  (M3·H3· │
                            │          │    │  Music·  │
                            │          │    │  Speech) │
                            └──────────┘    └──────────┘
```

The full product spec is in [`docs/PRD.md`](docs/PRD.md). The engineering rules for AI coding agents are in [`AGENTS.md`](AGENTS.md). The wireframes are in [`docs/wireframes.md`](docs/wireframes.md).

---

## Project structure

```
dreamreel/
├── apps/
│   ├── web/                  Next.js 14 (Cloudflare Pages)
│   └── api/                  Cloudflare Worker (Hono)
│       ├── migrations/       D1 schema migrations
│       └── wrangler.toml
├── packages/
│   └── shared/               Shared TypeScript types
├── docs/
│   ├── PRD.md                Product spec
│   ├── ARCHITECTURE.md       Big picture + data flow
│   ├── API.md                HTTP endpoint reference
│   ├── AGENTS.md             Engineering rules for AI agents
│   ├── wireframes.md         ASCII wireframes
│   ├── DEPLOY.md             15-min deploy guide
│   ├── demo-script.md        3-min demo video script
│   ├── SUBMISSION.md         Contest submission checklist
│   ├── TROUBLESHOOTING.md    Every problem we hit + how we fixed it
│   ├── CHANGELOG.md          14-day build journal
│   ├── USER_GUIDE.md         End-user manual (5-min read)
│   └── prompts/              M3 prompt templates (versioned)
├── scripts/
│   └── acceptance.sh         14-check end-to-end smoke test
├── .github/workflows/        CI
├── AGENTS.md                 Mirror of docs/AGENTS.md for AI tools
└── README.md
```

---

## Built with

- [Next.js 14](https://nextjs.org) — frontend
- [Cloudflare Workers](https://workers.cloudflare.com) + [Hono](https://hono.dev) — backend
- [Cloudflare D1](https://developers.cloudflare.com/d1) / [R2](https://developers.cloudflare.com/r2) / [KV](https://developers.cloudflare.com/kv) — data layer
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — local dev DB
- [ffmpeg](https://ffmpeg.org) — video composition
- [MiniMax M3 / H3 / Music 3.0 / Speech 2.8](https://www.gmicloud.ai) — AI models, served via [GMI Cloud](https://www.gmicloud.ai)
- [Tailwind CSS](https://tailwindcss.com) — styling
- [Zustand](https://github.com/pmndrs/zustand) — state
- [SWR](https://swr.vercel.app) — data fetching

---

## License

MIT.

---

**Sora lets you see the world. DreamReel lets you see your unconscious.**

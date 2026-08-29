# Submission Checklist — MiniMax Week 2026

> Last update: 2026-08-28. Deadline: **2026-09-06**.

## Status

- [x] Project scaffolded (Next.js + Workers + D1 + R2 + KV)
- [x] All 4 MiniMax models integrated (M3, H3, Music 3.0, Speech 2.8)
- [x] Adapter pattern: GMI Cloud for production, mock for local dev
- [x] E2E works locally: transcript → 30s MP4 in ~90s
- [x] Public repo at <https://github.com/<owner>/dreamreel>
- [ ] Deployed to Cloudflare (see [docs/DEPLOY.md](DEPLOY.md))
- [ ] Demo video recorded (script in [docs/demo-script.md](demo-script.md))
- [ ] Submission form filled
- [ ] X post published

## Submission form fields

URL: <https://www.gmicloud.ai/minimax-week#submit>

| Field | Value |
|---|---|
| Full name | <your name> |
| GMI Cloud account email | <your email> |
| Country | <your country> |
| X handle | <your @handle> |
| Solo or team | Solo |
| Team name | (empty) |
| Additional members | (empty) |
| Track | Multimodality |
| Project name | DreamReel |
| MiniMax models used | M3 · H3 · Music 3.0 · Speech 2.8 |
| Full description | (see template below) |
| Public repository | <https://github.com/<owner>/dreamreel> |
| Demo video | <YouTube / X link> |

### Full description template

```
DreamReel turns a 60-second voice description of a dream into a 30-second 
AI-generated film. You wake up, you remember a dream, you open DreamReel, 
you describe it. Ninety seconds later you have a 30-second film of it — 
four AI-generated scenes, a custom score, a voiceover.

The product is built around four MiniMax models working in concert:
- M3 acts as a film director, writing a 4-scene screenplay with voiceover 
  text and a poetic analysis.
- H3 generates the four video clips, 7-8 seconds each, with cinematic 
  prompts tailored to the dream's mood.
- Music 3.0 composes a 30-second emotional score matched to the dream's 
  dominant emotion (terror, love, surreal, melancholic, etc.).
- Speech 2.8 narrates the voiceover in a warm, restrained voice.
A fifth service (FFmpeg) composes the four into a single 30-second MP4.

The product has zero account friction for the first dream and a lightweight 
GitHub/Google OAuth for archival. It runs on Cloudflare Pages + Workers 
+ D1 + R2 + KV. Total cost per generation: under $0.20.

Why it's a winning entry: no one has built this. The intersection of 
dream recording × AI video × AI music × AI narration is empty on the 
market. We didn't invent a new model; we invented a new ritual.
```

### X post template

```
We just shipped DreamReel for @gmi_cloud MiniMax Week 2026.

You hold a button, describe a dream for 60 seconds, and 90 seconds later 
you're watching a 30-second film of it.

Four MiniMax models. One web app. Zero bullshit.

[link to demo]
[link to repo]
```

## Quality gates (must all pass before submitting)

```bash
# 1. Type-check both apps
pnpm typecheck

# 2. Run all tests
pnpm test

# 3. Lint
pnpm lint

# 4. Build both
pnpm build

# 5. E2E sanity (with API up)
curl -X POST http://localhost:8787/api/dreams/generate \
  -H "Content-Type: application/json" \
  -d '{"transcript":"my test dream"}'
# → returns 202 with dream_id, then /status eventually returns status=done
```

## Risks we are tracking

| Risk | Mitigation |
|---|---|
| H3 rate limits in production | Generation queue + per-user limit (10/hr) |
| D1 latency on cold start | SQLite locally + warm-up ping in Worker |
| OAuth callback misconfiguration | Triple-check callback URLs in GitHub/Google console |
| Demo video file size | 3-min cap, 1080p30, H.264 high profile, ~50-100MB |
| 4-min submit page timeout | Have all data pre-filled, only click "Submit" at the end |

---

**END OF SUBMISSION.md**

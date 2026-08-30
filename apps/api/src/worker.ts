// Cloudflare Worker entry point.
//
// This file is the wrangler `main` (see wrangler.toml). It builds a Hono app
// that ONLY uses Worker-compatible code paths. The Node-only code (better-
// sqlite3, ffmpeg, filesystem) lives in the local dev entry `src/index.ts`.
//
// In production:
//   - D1 is used for all metadata
//   - R2 is used for video / audio storage
//   - KV is used for share tokens and rate limits
//   - GMI Cloud is called for AI generation (M3, H3, Music, Speech)
//
// IMPORTANT: video composition (ffmpeg) does NOT run in Workers — see
// docs/ARCHITECTURE.md. For Worker deployment we ship a "static demo" mode
// where the API serves pre-generated content from R2. To create new dreams
// end-to-end, run `pnpm dev:api` locally.

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { settingsRoutes } from './routes/settings.js';

type Bindings = {
  DB?: D1Database;
  MEDIA?: R2Bucket;
  KV?: KVNamespace;
  ENVIRONMENT?: string;
  AI_PROVIDER?: 'mock' | 'gmi';
  GMI_BASE_URL?: string;
  H3_ENABLED?: string;
  GMI_API_KEY?: string;
  ALLOWED_ORIGIN?: string;
  NEXTAUTH_SECRET?: string;
  DISCORD_WEBHOOK_URL?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', async (c, next) => {
  const origin = c.env?.ALLOWED_ORIGIN ?? 'https://dreamreel.pages.dev';
  return cors({ origin, credentials: true })(c, next);
});

app.get('/health', (c) => c.json({
  ok: true,
  env: c.env?.ENVIRONMENT ?? 'production',
  ai: 'gmi',
  h3: c.env?.H3_ENABLED === 'true',
  // Static demo deployment: generation is disabled. To enable, deploy
  // an API that runs the pipeline (e.g. on a VM with ffmpeg, or as a
  // Cloudflare Container that hosts the composite step).
  canGenerate: false,
  needsAuth: true,
  note: 'Static demo deployment. POST /api/dreams/generate returns 503. Run the API locally for full E2E.',
}));

// Static dream list — pre-baked for the demo deployment.
const STATIC_DREAMS: any[] = [
  {
    id: 'd_demo_1',
    transcript: 'I was in an upside-down library, the staircase was made of water, and a woman in white knew my name but would not say it.',
    emotionTag: 'surreal',
    dreamType: 'recurring-place',
    analysisText: 'A library is never just a library. It is the mind pretending it has shelves for what it cannot file.',
    videoUrl: 'https://pub-9fe55e39e2054ec7b9e6e40211a881e5.r2.dev/demos/demo-1.mp4',
    durationMs: 30000,
    status: 'done',
    isPublic: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
  },
  {
    id: 'd_demo_2',
    transcript: 'My grandmother was in the kitchen making tea. She was young again.',
    emotionTag: 'melancholic',
    dreamType: 'death',
    analysisText: 'There is a room in you that still has the lights on. You walked into it tonight.',
    videoUrl: 'https://pub-9fe55e39e2054ec7b9e6e40211a881e5.r2.dev/demos/demo-2.mp4',
    durationMs: 30000,
    status: 'done',
    isPublic: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 48,
  },
];

app.get('/api/dreams', (c) => {
  // Static demo: ignore cursor and return the same fixed list.
  return c.json({ dreams: STATIC_DREAMS, nextCursor: null });
});

app.get('/api/dreams/:id', (c) => {
  const dream = STATIC_DREAMS.find((d) => d.id === c.req.param('id'));
  if (!dream) return c.json({ error: 'Not found' }, 404);
  return c.json(dream);
});

app.get('/api/dreams/:id/status', (c) => {
  const dream = STATIC_DREAMS.find((d) => d.id === c.req.param('id'));
  if (!dream) return c.json({ error: 'Not found' }, 404);
  return c.json({
    id: dream.id,
    status: dream.status,
    stage: null,
    progress: 1,
    video_url: dream.videoUrl,
    analysis_text: dream.analysisText,
    emotion_tag: dream.emotionTag,
    dream_type: dream.dreamType,
    error: null,
  });
});

// /api/dreams/generate is disabled in static demo deployment. To use the
// full pipeline, run `pnpm dev:api` locally.
app.post('/api/dreams/generate', (c) => c.json({
  error: 'This is a static demo deployment. To generate new dreams, run the API locally. See the project README.',
}, 503));

app.post('/api/dreams/:id/share', (c) => c.json({
  error: 'Sharing is disabled in static demo deployment.',
}, 503));

// Auth — in the demo we return a static user.
app.get('/api/auth/me', (c) => c.json({ user: null }));
app.post('/api/auth/dev-login', (c) => c.json({ error: 'Not available in demo deployment.' }, 503));
app.post('/api/auth/logout', (c) => c.json({ ok: true }));

// Share — in the demo we return a stub.
app.get('/api/share/:token', (c) => c.json({ error: 'Sharing is disabled in static demo deployment.' }, 503));

// /api/settings is also disabled in the demo deployment: without
// ffmpeg on the host, the pipeline can't run regardless of any
// configured key. The Settings UI is hidden client-side too (see
// Capability detection in the web app).
app.get('/api/settings', (c) => c.json({ error: 'Static demo deployment. Settings are managed at deploy-time, not per-user.', hasKey: false }, 503));
app.put('/api/settings', (c) => c.json({ error: 'Static demo deployment.' }, 503));
app.delete('/api/settings', (c) => c.json({ error: 'Static demo deployment.' }, 503));

app.notFound((c) => c.json({ error: 'Not found' }, 404));

export default {
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request, { env });
  },
} satisfies ExportedHandler<Bindings>;

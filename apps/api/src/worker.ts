// Cloudflare Worker entry point.
//
// This file is the wrangler `main` (see wrangler.toml). It builds a Hono
// app that exposes every real route — auth, dreams, settings, share —
// but the *generation pipeline* still cannot run on Cloudflare Workers
// because the video composition step needs ffmpeg. So the dream
// generation endpoint accepts the request, validates the user, and
// returns 503 with a friendly message: in production, generation is
// only possible when the API is deployed somewhere that can run
// ffmpeg (e.g. a Cloudflare Container, a VM, or your laptop via
// `pnpm dev:api`).
//
// In production:
//   - D1 is used for all metadata (users, sessions, dreams, settings)
//   - R2 is used for video / audio storage
//   - KV is used for share tokens and rate limits
//   - GMI Cloud is called for AI generation (M3, H3, Music, Speech)
//     with each user's own stored key
//
// The same `index.ts` Node-only code (better-sqlite3, ffmpeg, tsx)
// is what the local dev server uses; the route handlers are shared
// via the `routes/` modules.

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authRoutes } from './routes/auth.js';
import { dreamsRoutes } from './routes/dreams.js';
import { settingsRoutes } from './routes/settings.js';
import { ai, configureAi } from './services/ai/index.js';
import type { Bindings } from './types.js';

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', async (c, next) => {
  const origin = c.env?.ALLOWED_ORIGIN ?? 'https://dreamreel.pages.dev';
  return cors({ origin, credentials: true })(c, next);
});

app.get('/health', (c) => {
  // Reflect the configured AI provider without failing the health
  // check if env is missing — that's a config issue, not an outage.
  // /api/dreams/generate will refuse to generate without a per-user
  // key and surface the real error to the user.
  let aiName: 'mock' | 'gmi' | 'unconfigured' = 'unconfigured';
  let h3 = false;
  try {
    aiName = ai.name;
    h3 = ai.h3Enabled;
  } catch {
    aiName = 'unconfigured';
  }
  // canGenerate tracks whether the pipeline *can* run on this host.
  // Cloudflare Workers cannot run ffmpeg, so generation is always
  // disabled here regardless of how the rest of the API is wired.
  return c.json({
    ok: true,
    env: c.env?.ENVIRONMENT ?? 'production',
    ai: aiName,
    h3,
    canGenerate: false, // Workers have no ffmpeg; pipeline always off here
    needsAuth: true,
    note: 'Cloudflare Worker deployment. Auth, user data, and per-user API keys are live. New-dream generation is disabled here because video composition needs ffmpeg; deploy a Cloudflare Container or use pnpm dev:api to enable end-to-end generation.',
  });
});

// Stubs first — they take precedence over the real handlers mounted
// below. Cloudflare Workers cannot run ffmpeg, so the generation
// pipeline can never complete here. We surface a clear 503 instead
// of letting dreams.ts start work that can never finish.
app.post('/api/dreams/generate', (c) => c.json({
  error: 'This deployment cannot run the generation pipeline (no ffmpeg). Auth, dream archival, and per-user API keys are live — but new-dream generation requires a host with ffmpeg. Deploy a Cloudflare Container or run pnpm dev:api to enable end-to-end generation.',
  code: 'pipeline_unavailable',
}, 503));

app.post('/api/dreams/:id/share', (c) => c.json({
  error: 'Sharing is disabled in this deployment.',
}, 503));

app.get('/api/share/:token', (c) => c.json({ error: 'Share tokens are not enabled in this deployment.' }, 503));

// Real routes. All the auth, dream, and settings logic is here.
// The generation endpoint above intercepts before any of these
// handlers ever see a generate request.
app.route('/', authRoutes);
app.route('/', dreamsRoutes);
app.route('/', settingsRoutes);

app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.onError((err, c) => {
  console.error('[api error]', err);
  return c.json({ error: err.message || 'Internal error' }, 500);
});

export default {
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext): Promise<Response> {
    // Re-configure the AI provider from c.env. The hosting service
    // does not set GMI_API_KEY in production (each user brings
    // their own), so the getAi() helper degrades to the mock
    // provider here. POST /api/dreams/generate will still 422
    // when the user has no stored key.
    configureAi({
      apiKey: env.GMI_API_KEY ?? '',
      baseUrl: env.GMI_BASE_URL ?? 'https://api.gmicloud.ai',
      h3Enabled: env.H3_ENABLED === 'true',
    });
    return app.fetch(request, { env });
  },
} satisfies ExportedHandler<Bindings>;

// DreamReel API — entry point.
// In dev: tsx src/index.ts (Node HTTP server on :8787).
// In production: wrangler deploy (Cloudflare Worker; bindings come from wrangler.toml).

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { env } from './env.js';
import { ai } from './services/ai/index.js';
import { dreamsRoutes } from './routes/dreams.js';
import { mediaRoutes } from './routes/media.js';
import { authRoutes } from './routes/auth.js';

const app = new Hono();

app.use('*', cors({
  origin: env.ALLOWED_ORIGIN,
  credentials: true,
}));

app.get('/health', (c) => c.json({
  ok: true,
  env: env.ENVIRONMENT,
  ai: ai.name,
  h3: ai.h3Enabled,
}));

app.route('/', authRoutes);
app.route('/', dreamsRoutes);
app.route('/', mediaRoutes);

app.notFound((c) => c.json({ error: 'Not found' }, 404));
app.onError((err, c) => {
  console.error('[api error]', err);
  return c.json({ error: err.message || 'Internal error' }, 500);
});

const port = Number(process.env.PORT) || 8787;

if (env.ENVIRONMENT === 'production') {
  // Worker export (Cloudflare)
  // Note: when run via `wrangler dev`, the Worker runtime is used and this
  // block is bypassed. When built as a Node process for local dev, we use
  // @hono/node-server below.
}

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`\n  DreamReel API listening on http://localhost:${info.port}`);
  console.log(`  ENV: ${env.ENVIRONMENT}  AI: ${env.AI_PROVIDER}  CORS: ${env.ALLOWED_ORIGIN}\n`);
});

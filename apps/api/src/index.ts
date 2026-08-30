// DreamReel API — entry point.
//
// In dev (Node + tsx): starts an HTTP server on :8787 backed by local
//   SQLite + filesystem + in-memory KV.
//
// In production (Cloudflare Workers, via `wrangler deploy`): exports a
//   default Worker handler backed by D1 + R2 + KV bindings from wrangler.toml.
//
// The dispatch happens by detecting `export default { fetch }` at the bottom.
// We always build the same Hono app and serve it via either runtime.

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authRoutes } from './routes/auth.js';
import { dreamsRoutes } from './routes/dreams.js';
import { mediaRoutes } from './routes/media.js';
import { settingsRoutes } from './routes/settings.js';
import { ai } from './services/ai/index.js';

export type Bindings = {
  DB?: D1Database;
  MEDIA?: R2Bucket;
  KV?: KVNamespace;
  // Secrets (set via `wrangler secret put`)
  GMI_API_KEY?: string;
  GMI_ENC_KEY?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  // Vars (set in wrangler.toml)
  ENVIRONMENT?: string;
  AI_PROVIDER?: 'mock' | 'gmi';
  GMI_BASE_URL?: string;
  H3_ENABLED?: string;
  ALLOWED_ORIGIN?: string;
  NEXTAUTH_SECRET?: string;
  DISCORD_WEBHOOK_URL?: string;
};

export type AppEnv = {
  Bindings: Bindings;
};

// Build a Hono app. The same Hono instance is used for both runtimes.
function buildApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use('*', async (c, next) => {
    const origin = c.env?.ALLOWED_ORIGIN ?? 'http://localhost:3000';
    return cors({
      origin,
      credentials: true,
    })(c, next);
  });

  app.get('/health', (c) => {
    // Reflect the configured AI provider, but don't fail the health
    // check if env is missing — that's a configuration issue for
    // the operator, not a server outage. The dreams route will
    // refuse to generate without a per-user key and surface the
    // real error to the user.
    let aiName: 'mock' | 'gmi' | 'unconfigured' = 'unconfigured';
    let h3 = false;
    try {
      aiName = ai.name;
      h3 = ai.h3Enabled;
    } catch {
      aiName = 'unconfigured';
    }
    return c.json({
      ok: true,
      env: c.env?.ENVIRONMENT ?? 'development',
      ai: aiName,
      h3,
      canGenerate: true,
      needsAuth: true,
      note: 'Local dev server. Full pipeline (M3 + H3/Music/Speech + composite) is active when a per-user GMI key is configured.',
    });
  });

  app.route('/', authRoutes);
  app.route('/', dreamsRoutes);
  app.route('/', mediaRoutes);
  app.route('/', settingsRoutes);

  app.notFound((c) => c.json({ error: 'Not found' }, 404));
  app.onError((err, c) => {
    console.error('[api error]', err);
    return c.json({ error: err.message || 'Internal error' }, 500);
  });

  return app;
}

const app = buildApp();

// ---- Cloudflare Worker export ----
// When this file is bundled by wrangler, it becomes a Worker. We default-
// export the fetch handler. In Node dev mode (tsx), this export is ignored
// and the Node server below takes over.
export default {
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request, { env });
  },
} satisfies ExportedHandler<Bindings>;

// ---- Node dev server ----
// Only runs when this file is executed directly via `node --import tsx`.
// Guarded by checking that `import.meta.url === process.argv[1]`.
const isMain = (() => {
  try {
    return import.meta.url === `file://${process.argv[1]}`;
  } catch {
    return false;
  }
})();

if (isMain) {
  // Lazy-import the Node-only deps so the Worker bundle stays small.
  // This branch never executes in the Worker runtime.
  (async () => {
    // Load .dev.vars into process.env so route handlers that read
    // from process.env (GMI_ENC_KEY, etc.) see the same values that
    // wrangler would inject in production. .dev.vars is in
    // .gitignore. Format: KEY=VALUE per line, # for comments.
    try {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const url = await import('node:url');
      const here = path.dirname(url.fileURLToPath(import.meta.url));
      const varsPath = path.resolve(here, '..', '.dev.vars');
      if (fs.existsSync(varsPath)) {
        for (const line of fs.readFileSync(varsPath, 'utf8').split('\n')) {
          const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
          if (m && process.env[m[1]!] === undefined) {
            process.env[m[1]!] = m[2]!;
          }
        }
      }
    } catch (err) {
      console.warn('[startup] could not load .dev.vars:', err);
    }

    const { serve } = await import('@hono/node-server');
    const port = Number(process.env.PORT) || 8787;
    serve({ fetch: app.fetch, port }, (info: { port: number }) => {
      console.log(`\n  DreamReel API listening on http://localhost:${info.port}`);
      console.log(`  ENV: development  AI: ${process.env.AI_PROVIDER ?? 'mock'}  CORS: ${process.env.ALLOWED_ORIGIN ?? 'http://localhost:3000'}\n`);
    });
  })().catch((err) => {
    console.error('[startup]', err);
    process.exit(1);
  });
}

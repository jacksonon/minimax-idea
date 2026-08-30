// Shared Cloudflare Worker bindings type. Imported by both the
// Worker entry (worker.ts) and the route handlers (so the route
// handlers' `c.env.X` lookups are type-checked against the same
// shape that the Worker runtime provides).
//
// Keep this in sync with wrangler.toml and the secrets documented
// in scripts/setup-secrets.sh.

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

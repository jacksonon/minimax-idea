// Local development environment for apps/api.
// In production (Cloudflare Workers), this becomes a `Env` interface bound to
// wrangler.toml bindings. See AGENTS.md §4.2.
//
// IMPORTANT: this file is imported from the Cloudflare Worker entry
// (worker.ts) only for its TYPE exports (AppEnv, Bindings). The
// runtime exports (`env`) are Node-only — they read process.env and
// resolve paths via process.cwd() (no node:url / node:path imports).
// That way the Worker bundle stays clean of Node-only code.

export type StorageDriver = 'local';
export type DatabaseDriver = 'sqlite-local';
export type KVDriver = 'memory';

export type AppEnv = {
  ENVIRONMENT: 'development' | 'production';
  STORAGE: StorageDriver;
  DATABASE: DatabaseDriver;
  KV: KVDriver;

  // AI provider: 'mock' (default, no key needed) or 'gmi' (real GMI Cloud).
  AI_PROVIDER: 'mock' | 'gmi';

  // GMI Cloud config (only used when AI_PROVIDER='gmi')
  GMI_API_KEY: string;
  GMI_BASE_URL: string;

  // H3 is paid even during the contest. Set H3_API_KEY (or reuse GMI_API_KEY
  // by setting H3_ENABLED=true) to enable real video generation. When false,
  // the pipeline falls back to a static-image slideshow.
  H3_ENABLED: boolean;

  ALLOWED_ORIGIN: string;

  // Local filesystem paths (only used in development)
  STORAGE_DIR: string;
  DB_PATH: string;

  // Auth (NextAuth shared secret; in prod each provider also has client secret)
  NEXTAUTH_SECRET: string;

  // Optional
  DISCORD_WEBHOOK_URL: string;
};

// Runtime export: a single `env` object used by the Node dev server.
// In the Worker, code reads from c.env instead. We compute the
// STORAGE_DIR/DB_PATH relative to process.cwd() so we don't have
// to resolve import.meta.url (which is undefined inside workerd).
export const env: AppEnv = {
  ENVIRONMENT: (process.env.ENVIRONMENT as 'development' | 'production') ?? 'development',
  STORAGE: 'local',
  DATABASE: 'sqlite-local',
  KV: 'memory',

  AI_PROVIDER: (process.env.AI_PROVIDER as 'mock' | 'gmi') ?? 'mock',
  GMI_API_KEY: process.env.GMI_API_KEY ?? '',
  GMI_BASE_URL: process.env.GMI_BASE_URL ?? 'https://api.gmicloud.ai',
  H3_ENABLED:
    process.env.H3_ENABLED === 'true' || !!process.env.H3_API_KEY,

  ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN ?? 'http://localhost:3000',

  STORAGE_DIR: process.env.STORAGE_DIR ?? `${process.cwd()}/storage`,
  DB_PATH: process.env.DB_PATH ?? `${process.cwd()}/dev.db`,

  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? 'dev-secret-change-me-please-32bytes!!',

  DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL ?? '',
};

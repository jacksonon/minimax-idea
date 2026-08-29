// Local development environment for apps/api.
// In production (Cloudflare Workers), this becomes a `Env` interface bound to
// wrangler.toml bindings. See AGENTS.md §4.2.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

  ALLOWED_ORIGIN: string;

  // Local filesystem paths (only used in development)
  STORAGE_DIR: string;
  DB_PATH: string;

  // Auth (NextAuth shared secret; in prod each provider also has client secret)
  NEXTAUTH_SECRET: string;

  // Optional
  DISCORD_WEBHOOK_URL: string;
};

export const env: AppEnv = {
  ENVIRONMENT: (process.env.ENVIRONMENT as 'development' | 'production') ?? 'development',
  STORAGE: 'local',
  DATABASE: 'sqlite-local',
  KV: 'memory',

  AI_PROVIDER: (process.env.AI_PROVIDER as 'mock' | 'gmi') ?? 'mock',
  GMI_API_KEY: process.env.GMI_API_KEY ?? '',
  GMI_BASE_URL: process.env.GMI_BASE_URL ?? 'https://api.gmicloud.ai',

  ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN ?? 'http://localhost:3000',

  STORAGE_DIR: process.env.STORAGE_DIR ?? path.resolve(__dirname, '../storage'),
  DB_PATH: process.env.DB_PATH ?? path.resolve(__dirname, '../dev.db'),

  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? 'dev-secret-change-me-please-32bytes!!',

  DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL ?? '',
};

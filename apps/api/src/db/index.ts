// Database layer. Two backends:
//   - local (default in dev): better-sqlite3 — synchronous, returns values directly
//   - D1 (Cloudflare Workers): async, all calls return Promises
//
// We expose a uniform `Db` interface that always returns Promises so callers
// can `await` consistently regardless of the backend.

import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../env.js';

export type SqlParam = string | number | null;

export type QueryResult = {
  changes: number;
};

export interface Db {
  kind: 'sqlite' | 'd1';
  // SQL primitives. `first` returns the first row or null; `all` returns rows[].
  first<T = any>(sql: string, params?: SqlParam[]): Promise<T | null>;
  all<T = any>(sql: string, params?: SqlParam[]): Promise<T[]>;
  run(sql: string, params?: SqlParam[]): Promise<QueryResult>;
  /** Apply pending migrations. Idempotent. */
  migrate(): Promise<void>;
}

let _db: Db | null = null;
let _activeBinding: 'sqlite' | 'd1' = 'sqlite';
let _activeD1: D1Database | null = null;

export function getDb(): Db {
  if (_db) return _db;
  if (_activeD1) {
    _db = makeD1Db(_activeD1);
    _activeBinding = 'd1';
  } else {
    _db = makeSqliteDb();
    _activeBinding = 'sqlite';
  }
  return _db;
}

/**
 * Switch the active backend to D1. Called once at Worker startup from
 * index.ts when bindings are available. No-op if already D1.
 */
export function setD1Database(d1: D1Database): void {
  _activeD1 = d1;
  _db = null; // force re-init on next getDb()
}

/** Currently active backend. */
export function dbKind(): 'sqlite' | 'd1' {
  return _activeBinding;
}

/** For tests: reset the singleton and clear the local DB file. */
export function resetDb(): void {
  if (_db && _activeBinding === 'sqlite') {
    (_db as any)._raw.close();
  }
  _db = null;
  _activeD1 = null;
  _activeBinding = 'sqlite';
  if (fs.existsSync(env.DB_PATH)) fs.unlinkSync(env.DB_PATH);
}

// ===== SQLite backend =====

function makeSqliteDb(): Db {
  const dir = path.dirname(env.DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const raw = new Database(env.DB_PATH);
  raw.pragma('journal_mode = WAL');
  raw.pragma('foreign_keys = ON');

  const wrapper: Db & { _raw: Database.Database } = {
    kind: 'sqlite',
    _raw: raw,
    async first(sql, params = []) {
      const stmt = raw.prepare(sql);
      return (stmt.get(...(params as any)) as any) ?? null;
    },
    async all(sql, params = []) {
      const stmt = raw.prepare(sql);
      return stmt.all(...(params as any)) as any[];
    },
    async run(sql, params = []) {
      const stmt = raw.prepare(sql);
      const r = stmt.run(...(params as any));
      return { changes: r.changes };
    },
    async migrate() {
      raw.exec(SCHEMA_SQL);
      // share_tokens table is added in queries.ts on first use; keep for safety:
      raw.exec(`
        CREATE TABLE IF NOT EXISTS share_tokens (
          token      TEXT PRIMARY KEY,
          dream_id   TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          FOREIGN KEY (dream_id) REFERENCES dreams(id)
        );
      `);
    },
  };

  // Apply schema synchronously on construction; the migrate() wrapper is also
  // exposed for symmetry with the D1 backend.
  void wrapper.migrate();
  return wrapper;
}

// ===== D1 backend =====

function makeD1Db(d1: D1Database): Db {
  return {
    kind: 'd1',
    async first<T = any>(sql: string, params: SqlParam[] = []): Promise<T | null> {
      const stmt = d1.prepare(sql).bind(...(params as any));
      return (await stmt.first<T>()) ?? null;
    },
    async all<T = any>(sql: string, params: SqlParam[] = []): Promise<T[]> {
      const stmt = d1.prepare(sql).bind(...(params as any));
      const res = await stmt.all<T>();
      return (res.results ?? []) as T[];
    },
    async run(sql: string, params: SqlParam[] = []): Promise<QueryResult> {
      const stmt = d1.prepare(sql).bind(...(params as any));
      const res = await stmt.run();
      return { changes: res.meta?.changes ?? 0 };
    },
    async migrate() {
      // Split on `;` at end-of-line to get individual statements. D1's
      // batch API doesn't allow `exec` so we run each statement individually.
      const stmts = SCHEMA_SQL.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean);
      for (const stmtSql of stmts) {
        await d1.prepare(stmtSql + ';').run();
      }
    },
  };
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  oauth_provider TEXT NOT NULL,
  oauth_id       TEXT NOT NULL,
  email          TEXT,
  display_name   TEXT NOT NULL,
  avatar_url     TEXT,
  created_at     INTEGER NOT NULL,
  last_seen_at   INTEGER NOT NULL,
  UNIQUE(oauth_provider, oauth_id)
);

CREATE TABLE IF NOT EXISTS dreams (
  id               TEXT PRIMARY KEY,
  user_id          TEXT,
  transcript       TEXT NOT NULL,
  screenplay_json  TEXT,
  analysis_text    TEXT,
  emotion_tag      TEXT,
  dream_type       TEXT,
  video_url        TEXT,
  music_url        TEXT,
  voiceover_url    TEXT,
  duration_ms      INTEGER,
  status           TEXT NOT NULL DEFAULT 'pending',
  stage            TEXT,
  progress         REAL NOT NULL DEFAULT 0,
  error_message    TEXT,
  is_public        INTEGER NOT NULL DEFAULT 0,
  created_at       INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_dreams_user_created ON dreams(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dreams_status ON dreams(status);
CREATE INDEX IF NOT EXISTS idx_dreams_emotion ON dreams(emotion_tag);

CREATE TABLE IF NOT EXISTS rate_limits (
  ip         TEXT NOT NULL,
  hour_key   TEXT NOT NULL,
  count      INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (ip, hour_key)
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS share_tokens (
  token      TEXT PRIMARY KEY,
  dream_id   TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (dream_id) REFERENCES dreams(id)
);

-- Per-user settings. Used to store the GMI API key that the logged-in
-- user provides for their own dream-generation requests. The key
-- belongs to the user; the server reads it at request time and never
-- logs it. The application MUST NEVER ship with a key in the repo.
CREATE TABLE IF NOT EXISTS user_settings (
  user_id     TEXT PRIMARY KEY,
  gmi_api_key  TEXT NOT NULL,
  gmi_base_url TEXT,
  updated_at   INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
`;

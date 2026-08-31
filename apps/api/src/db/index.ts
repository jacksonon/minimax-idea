// Database layer. Two backends:
//   - local (default in dev): better-sqlite3 — synchronous, returns values directly
//   - D1 (Cloudflare Workers): async, all calls return Promises
//
// We expose a uniform `Db` interface that always returns Promises so callers
// can `await` consistently regardless of the backend.
//
// IMPORTANT: this module is bundled into the Cloudflare Worker. We
// therefore keep the better-sqlite3 / node:fs / node:path imports
// behind dynamic imports so they are not resolved at module-load
// time. Otherwise the Worker bundle would try to mkdirSync at boot
// and crash with "[unenv] fs.mkdirSync is not implemented yet!".

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
    // DYNAMIC import: better-sqlite3 is a Node-only module. The Worker
    // bundle must not load it. We only resolve this import when the
    // Node dev server actually needs the sqlite backend.
    throw new Error(
      'SQLite backend was not initialized. In Cloudflare Workers the DB is ' +
      'set up via setD1Database() at request time; in local Node dev, ' +
      'call ensureSqliteDb() from src/index.ts before the first query.'
    );
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

/**
 * Initialize the SQLite backend for local dev. Dynamic-imports
 * better-sqlite3, node:fs, node:path so the Worker bundle stays
 * clean. Call from src/index.ts before serving the first request.
 */
export async function ensureSqliteDb(): Promise<void> {
  if (_db) return;
  if (_activeD1) {
    _db = makeD1Db(_activeD1);
    _activeBinding = 'd1';
    return;
  }
  const [{ default: Database }, fsMod, pathMod, envMod] = await Promise.all([
    import('better-sqlite3'),
    import('node:fs'),
    import('node:path'),
    import('../env.js'),
  ]);
  const env = envMod.env;
  const dir = pathMod.dirname(env.DB_PATH);
  if (!fsMod.existsSync(dir)) fsMod.mkdirSync(dir, { recursive: true });
  const raw = new Database(env.DB_PATH);
  raw.pragma('journal_mode = WAL');
  raw.pragma('foreign_keys = ON');

  const wrapper: Db = {
    kind: 'sqlite',
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
      // Idempotent column add for existing local dev databases created
      // before media_json existed. SQLite has no IF NOT EXISTS on
      // ALTER TABLE ADD COLUMN, so we probe pragma_table_info first.
      const cols = raw.prepare(`PRAGMA table_info(dreams)`).all() as Array<{ name: string }>;
      if (!cols.some((c) => c.name === 'media_json')) {
        raw.exec(`ALTER TABLE dreams ADD COLUMN media_json TEXT`);
      }
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

  await wrapper.migrate();
  _db = wrapper;
  _activeBinding = 'sqlite';
}

/** Currently active backend. */
export function dbKind(): 'sqlite' | 'd1' {
  return _activeBinding;
}

/** For tests: reset the singleton and clear the local DB file. */
export async function resetDb(): Promise<void> {
  if (_db && _activeBinding === 'sqlite') {
    (_db as any)._raw.close();
  }
  _db = null;
  _activeD1 = null;
  _activeBinding = 'sqlite';
  try {
    const fsMod = await import('node:fs');
    const envMod = await import('../env.js');
    if (fsMod.existsSync(envMod.env.DB_PATH)) fsMod.unlinkSync(envMod.env.DB_PATH);
  } catch {
    // fs/env not available (e.g. on Workers); nothing to do.
  }
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
      // Idempotent ALTER for existing D1 databases. D1 doesn't have
      // IF NOT EXISTS for ADD COLUMN, but the SQL itself will fail with
      // a "duplicate column" error which we swallow.
      try {
        await d1.prepare(`ALTER TABLE dreams ADD COLUMN media_json TEXT`).run();
      } catch (err: any) {
        if (!/duplicate column/i.test(String(err?.message ?? err))) {
          throw err;
        }
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
  -- New in v2: a JSON blob describing all the artifacts the frontend
  -- needs to play a dream without any local composition. Replaces the
  -- old "composite one MP4 with ffmpeg" step. See DreamMedia in
  -- packages/shared/src/index.ts.
  media_json       TEXT,
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

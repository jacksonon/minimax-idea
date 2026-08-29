// SQLite-backed persistence (local dev). Schema matches PRD §6.2 (D1).
// In production this is replaced by D1; the query layer below keeps the
// interface stable so the swap is mechanical.

import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../env.js';

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  const dir = path.dirname(env.DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = new Database(env.DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  applySchema(db);
  _db = db;
  return db;
}

function applySchema(db: Database.Database) {
  db.exec(`
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
  `);
}

export function resetDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
  if (fs.existsSync(env.DB_PATH)) fs.unlinkSync(env.DB_PATH);
}

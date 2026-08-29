-- D1 initial schema (PRD §6.2)
-- Apply: `pnpm wrangler d1 migrations apply dreamreel-db`

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

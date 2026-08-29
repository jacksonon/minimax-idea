// Query helpers — all access to dreams/users goes through here.

import { nanoid } from 'nanoid';
import { getDb } from './index.js';
import type { Dream, DreamStatus, DreamStage, User } from '@dreamreel/shared';

const now = () => Date.now();

export function createDream(input: {
  userId: string | null;
  transcript: string;
}): Dream {
  const db = getDb();
  const id = `d_${nanoid(16)}`;
  const createdAt = now();
  db.prepare(
    `INSERT INTO dreams
      (id, user_id, transcript, status, progress, is_public, created_at)
     VALUES (?, ?, ?, 'pending', 0, 0, ?)`,
  ).run(id, input.userId, input.transcript, createdAt);
  return getDreamById(id)!;
}

export function getDreamById(id: string): Dream | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM dreams WHERE id = ?`).get(id) as any;
  if (!row) return null;
  return rowToDream(row);
}

export function listDreamsForUser(userId: string, limit = 50): Dream[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM dreams WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    )
    .all(userId, limit) as any[];
  return rows.map(rowToDream);
}

export function updateDreamStatus(
  id: string,
  status: DreamStatus,
  stage: DreamStage | null = null,
  progress: number | null = null,
) {
  const db = getDb();
  db.prepare(
    `UPDATE dreams SET status = ?, stage = ?, progress = ? WHERE id = ?`,
  ).run(status, stage, progress ?? 0, id);
}

export function updateDreamStage(id: string, stage: DreamStage, progress: number) {
  const db = getDb();
  db.prepare(`UPDATE dreams SET stage = ?, progress = ? WHERE id = ?`).run(
    stage,
    progress,
    id,
  );
}

export function saveScreenplay(
  id: string,
  payload: {
    screenplayJson: string;
    analysisText: string;
    emotionTag: string;
    dreamType: string;
  },
) {
  const db = getDb();
  db.prepare(
    `UPDATE dreams
       SET screenplay_json = ?, analysis_text = ?, emotion_tag = ?, dream_type = ?
     WHERE id = ?`,
  ).run(
    payload.screenplayJson,
    payload.analysisText,
    payload.emotionTag,
    payload.dreamType,
    id,
  );
}

export function saveMediaUrls(
  id: string,
  payload: { videoUrl: string; musicUrl?: string; voiceoverUrl?: string; durationMs: number },
) {
  const db = getDb();
  db.prepare(
    `UPDATE dreams
       SET video_url = ?, music_url = COALESCE(?, music_url),
           voiceover_url = COALESCE(?, voiceover_url), duration_ms = ?
     WHERE id = ?`,
  ).run(payload.videoUrl, payload.musicUrl ?? null, payload.voiceoverUrl ?? null, payload.durationMs, id);
}

export function failDream(id: string, message: string) {
  const db = getDb();
  db.prepare(
    `UPDATE dreams SET status = 'failed', error_message = ? WHERE id = ?`,
  ).run(message, id);
}

export function deleteDream(id: string, userId: string | null): boolean {
  const db = getDb();
  const res = db
    .prepare(`DELETE FROM dreams WHERE id = ? AND (user_id = ? OR user_id IS NULL)`)
    .run(id, userId);
  return res.changes > 0;
}

export function setDreamPublic(id: string, userId: string | null, isPublic: boolean) {
  const db = getDb();
  db.prepare(`UPDATE dreams SET is_public = ? WHERE id = ? AND (user_id = ? OR user_id IS NULL)`).run(
    isPublic ? 1 : 0,
    id,
    userId,
  );
}

// ----- users -----

export function upsertUser(input: {
  provider: 'github' | 'google';
  oauthId: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
}): User {
  const db = getDb();
  const existing = db
    .prepare(`SELECT * FROM users WHERE oauth_provider = ? AND oauth_id = ?`)
    .get(input.provider, input.oauthId) as any;
  if (existing) {
    db.prepare(
      `UPDATE users SET last_seen_at = ?, display_name = ?, avatar_url = ?, email = ? WHERE id = ?`,
    ).run(now(), input.displayName, input.avatarUrl, input.email, existing.id);
    return getUserById(existing.id)!;
  }
  const id = `u_${nanoid(16)}`;
  const ts = now();
  db.prepare(
    `INSERT INTO users (id, oauth_provider, oauth_id, email, display_name, avatar_url, created_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, input.provider, input.oauthId, input.email, input.displayName, input.avatarUrl, ts, ts);
  return getUserById(id)!;
}

export function getUserById(id: string): User | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as any;
  if (!row) return null;
  return {
    id: row.id,
    oauthProvider: row.oauth_provider,
    oauthId: row.oauth_id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  };
}

export function getUserBySession(token: string): User | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT u.* FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token = ? AND s.expires_at > ?`,
    )
    .get(token, now()) as any;
  if (!row) return null;
  return getUserById(row.id);
}

export function createSession(userId: string, ttlMs: number): string {
  const db = getDb();
  const token = nanoid(32);
  const expires = now() + ttlMs;
  db.prepare(`INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`).run(
    token,
    userId,
    now(),
    expires,
  );
  return token;
}

export function deleteSession(token: string) {
  const db = getDb();
  db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
}

// ----- rate limits -----

export function hitRateLimit(ip: string, max: number): boolean {
  const db = getDb();
  const hour = new Date().toISOString().slice(0, 13); // YYYY-MM-DD-HH
  const existing = db
    .prepare(`SELECT count FROM rate_limits WHERE ip = ? AND hour_key = ?`)
    .get(ip, hour) as { count: number } | undefined;
  const newCount = (existing?.count ?? 0) + 1;
  db.prepare(
    `INSERT INTO rate_limits (ip, hour_key, count, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(ip, hour_key) DO UPDATE SET count = excluded.count, updated_at = excluded.updated_at`,
  ).run(ip, hour, newCount, now());
  return newCount > max;
}

// ----- share tokens (in DB for durability in dev) -----

export function createShareLink(dreamId: string, ttlMs: number): string {
  const db = getDb();
  const token = nanoid(24);
  const expires = now() + ttlMs;
  db.prepare(
    `INSERT INTO share_tokens (token, dream_id, expires_at) VALUES (?, ?, ?)`,
  ).run(token, dreamId, expires);
  return token;
}

export function getShareToken(token: string): { dreamId: string; expiresAt: number } | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT dream_id, expires_at FROM share_tokens WHERE token = ?`)
    .get(token) as { dream_id: string; expires_at: number } | undefined;
  if (!row) return null;
  if (row.expires_at < now()) return null;
  return { dreamId: row.dream_id, expiresAt: row.expires_at };
}

// ensure share_tokens table exists
getDb().exec(`
  CREATE TABLE IF NOT EXISTS share_tokens (
    token      TEXT PRIMARY KEY,
    dream_id   TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY (dream_id) REFERENCES dreams(id)
  );
`);

// ----- row mapping -----

function rowToDream(row: any): Dream {
  return {
    id: row.id,
    userId: row.user_id,
    transcript: row.transcript,
    screenplay: row.screenplay_json ? JSON.parse(row.screenplay_json) : null,
    analysisText: row.analysis_text,
    emotionTag: row.emotion_tag,
    dreamType: row.dream_type,
    videoUrl: row.video_url,
    musicUrl: row.music_url,
    voiceoverUrl: row.voiceover_url,
    durationMs: row.duration_ms,
    status: row.status,
    stage: row.stage,
    progress: row.progress,
    errorMessage: row.error_message,
    isPublic: !!row.is_public,
    createdAt: row.created_at,
  };
}

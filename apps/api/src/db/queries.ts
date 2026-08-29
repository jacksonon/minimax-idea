// Database access. Async API for compatibility with both:
//   - better-sqlite3 (Node dev) — synchronous calls wrapped in Promise.resolve
//   - Cloudflare D1 (Worker prod) — already async
//
// Callers always `await`. This lets the same route work in both runtimes.

import { nanoid } from 'nanoid';
import { getDb } from './index.js';
import type { Dream, DreamStatus, DreamStage, User } from '@dreamreel/shared';

const now = () => Date.now();

export async function createDream(input: {
  userId: string | null;
  transcript: string;
}): Promise<Dream> {
  const db = getDb();
  const id = `d_${nanoid(16)}`;
  const createdAt = now();
  await db.run(
    `INSERT INTO dreams
      (id, user_id, transcript, status, progress, is_public, created_at)
     VALUES (?, ?, ?, 'pending', 0, 0, ?)`,
    [id, input.userId, input.transcript, createdAt],
  );
  return (await getDreamById(id))!;
}

export async function getDreamById(id: string): Promise<Dream | null> {
  const db = getDb();
  const row = await db.first(`SELECT * FROM dreams WHERE id = ?`, [id]);
  if (!row) return null;
  return rowToDream(row as any);
}

export async function listDreamsForUser(userId: string, limit = 50): Promise<Dream[]> {
  const db = getDb();
  const rows = await db.all(
    `SELECT * FROM dreams WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    [userId, limit],
  );
  return (rows as any[]).map(rowToDream);
}

export async function updateDreamStatus(
  id: string,
  status: DreamStatus,
  stage: DreamStage | null = null,
  progress: number | null = null,
): Promise<void> {
  const db = getDb();
  await db.run(
    `UPDATE dreams SET status = ?, stage = ?, progress = ? WHERE id = ?`,
    [status, stage, progress ?? 0, id],
  );
}

export async function updateDreamStage(id: string, stage: DreamStage, progress: number): Promise<void> {
  const db = getDb();
  await db.run(`UPDATE dreams SET stage = ?, progress = ? WHERE id = ?`, [stage, progress, id]);
}

export async function saveScreenplay(
  id: string,
  payload: { screenplayJson: string; analysisText: string; emotionTag: string; dreamType: string },
): Promise<void> {
  const db = getDb();
  await db.run(
    `UPDATE dreams
       SET screenplay_json = ?, analysis_text = ?, emotion_tag = ?, dream_type = ?
     WHERE id = ?`,
    [payload.screenplayJson, payload.analysisText, payload.emotionTag, payload.dreamType, id],
  );
}

export async function saveMediaUrls(
  id: string,
  payload: { videoUrl: string; musicUrl?: string; voiceoverUrl?: string; durationMs: number },
): Promise<void> {
  const db = getDb();
  await db.run(
    `UPDATE dreams
       SET video_url = ?, music_url = COALESCE(?, music_url),
           voiceover_url = COALESCE(?, voiceover_url), duration_ms = ?
     WHERE id = ?`,
    [payload.videoUrl, payload.musicUrl ?? null, payload.voiceoverUrl ?? null, payload.durationMs, id],
  );
}

export async function failDream(id: string, message: string): Promise<void> {
  const db = getDb();
  await db.run(
    `UPDATE dreams SET status = 'failed', error_message = ? WHERE id = ?`,
    [message, id],
  );
}

export async function deleteDream(id: string, userId: string | null): Promise<boolean> {
  const db = getDb();
  const res = await db.run(
    `DELETE FROM dreams WHERE id = ? AND (user_id = ? OR user_id IS NULL)`,
    [id, userId],
  );
  return (res.changes ?? 0) > 0;
}

export async function setDreamPublic(id: string, userId: string | null, isPublic: boolean): Promise<void> {
  const db = getDb();
  await db.run(
    `UPDATE dreams SET is_public = ? WHERE id = ? AND (user_id = ? OR user_id IS NULL)`,
    [isPublic ? 1 : 0, id, userId],
  );
}

// ----- users -----

export async function upsertUser(input: {
  provider: 'github' | 'google';
  oauthId: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
}): Promise<User> {
  const db = getDb();
  const existing = await db.first(
    `SELECT * FROM users WHERE oauth_provider = ? AND oauth_id = ?`,
    [input.provider, input.oauthId],
  );
  if (existing) {
    await db.run(
      `UPDATE users SET last_seen_at = ?, display_name = ?, avatar_url = ?, email = ? WHERE id = ?`,
      [now(), input.displayName, input.avatarUrl, input.email, (existing as any).id],
    );
    return (await getUserById((existing as any).id))!;
  }
  const id = `u_${nanoid(16)}`;
  const ts = now();
  await db.run(
    `INSERT INTO users (id, oauth_provider, oauth_id, email, display_name, avatar_url, created_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.provider, input.oauthId, input.email, input.displayName, input.avatarUrl, ts, ts],
  );
  return (await getUserById(id))!;
}

export async function getUserById(id: string): Promise<User | null> {
  const db = getDb();
  const row = await db.first(`SELECT * FROM users WHERE id = ?`, [id]);
  if (!row) return null;
  return {
    id: (row as any).id,
    oauthProvider: (row as any).oauth_provider,
    oauthId: (row as any).oauth_id,
    email: (row as any).email,
    displayName: (row as any).display_name,
    avatarUrl: (row as any).avatar_url,
    createdAt: (row as any).created_at,
    lastSeenAt: (row as any).last_seen_at,
  };
}

export async function getUserBySession(token: string): Promise<User | null> {
  const db = getDb();
  const row = await db.first(
    `SELECT u.* FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at > ?`,
    [token, now()],
  );
  if (!row) return null;
  return getUserById((row as any).id);
}

export async function createSession(userId: string, ttlMs: number): Promise<string> {
  const db = getDb();
  const token = nanoid(32);
  const expires = now() + ttlMs;
  await db.run(
    `INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`,
    [token, userId, now(), expires],
  );
  return token;
}

export async function deleteSession(token: string): Promise<void> {
  const db = getDb();
  await db.run(`DELETE FROM sessions WHERE token = ?`, [token]);
}

// ----- rate limits -----

export async function hitRateLimit(ip: string, max: number): Promise<boolean> {
  const db = getDb();
  const hour = new Date().toISOString().slice(0, 13);
  const existing = await db.first(
    `SELECT count FROM rate_limits WHERE ip = ? AND hour_key = ?`,
    [ip, hour],
  );
  const newCount = ((existing as any)?.count ?? 0) + 1;
  await db.run(
    `INSERT INTO rate_limits (ip, hour_key, count, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(ip, hour_key) DO UPDATE SET count = excluded.count, updated_at = excluded.updated_at`,
    [ip, hour, newCount, now()],
  );
  return newCount > max;
}

// ----- share tokens -----

export async function createShareLink(dreamId: string, ttlMs: number): Promise<string> {
  const db = getDb();
  const token = nanoid(24);
  const expires = now() + ttlMs;
  await db.run(
    `INSERT INTO share_tokens (token, dream_id, expires_at) VALUES (?, ?, ?)`,
    [token, dreamId, expires],
  );
  return token;
}

export async function getShareToken(token: string): Promise<{ dreamId: string; expiresAt: number } | null> {
  const db = getDb();
  const row = await db.first(
    `SELECT dream_id, expires_at FROM share_tokens WHERE token = ?`,
    [token],
  );
  if (!row) return null;
  if ((row as any).expires_at < now()) return null;
  return { dreamId: (row as any).dream_id, expiresAt: (row as any).expires_at };
}

// ----- per-user settings (GMI key, etc.) -----

export type UserSettings = {
  gmiApiKey: string;
  gmiBaseUrl: string | null;
  updatedAt: number;
};

export async function getUserSettings(userId: string): Promise<UserSettings | null> {
  const db = getDb();
  const row = await db.first(
    `SELECT gmi_api_key, gmi_base_url, updated_at FROM user_settings WHERE user_id = ?`,
    [userId],
  );
  if (!row) return null;
  return {
    gmiApiKey: (row as any).gmi_api_key,
    gmiBaseUrl: (row as any).gmi_base_url,
    updatedAt: (row as any).updated_at,
  };
}

export async function upsertUserSettings(
  userId: string,
  payload: { gmiApiKey: string; gmiBaseUrl?: string | null },
): Promise<UserSettings> {
  const db = getDb();
  const ts = now();
  const baseUrl = payload.gmiBaseUrl ?? 'https://api.gmicloud.ai';
  await db.run(
    `INSERT INTO user_settings (user_id, gmi_api_key, gmi_base_url, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       gmi_api_key = excluded.gmi_api_key,
       gmi_base_url = excluded.gmi_base_url,
       updated_at = excluded.updated_at`,
    [userId, payload.gmiApiKey, baseUrl, ts],
  );
  return { gmiApiKey: payload.gmiApiKey, gmiBaseUrl: baseUrl, updatedAt: ts };
}

export async function deleteUserSettings(userId: string): Promise<boolean> {
  const db = getDb();
  const res = await db.run(`DELETE FROM user_settings WHERE user_id = ?`, [userId]);
  return (res.changes ?? 0) > 0;
}

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

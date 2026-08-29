// Database abstraction. Two implementations:
//   - SqliteDb   (local dev; uses better-sqlite3, synchronous)
//   - D1Db       (Cloudflare Workers; uses D1Database, async)
//
// The D1 prepared-statement API is similar to better-sqlite3 but always
// returns a Promise. We hide the difference behind this interface so the
// rest of the codebase stays simple.

import type {
  Dream,
  DreamStage,
  DreamStatus,
  User,
} from '@dreamreel/shared';

export interface Db {
  // Dreams
  createDream(input: { userId: string | null; transcript: string }): Promise<Dream>;
  getDreamById(id: string): Promise<Dream | null>;
  listDreamsForUser(userId: string, limit?: number): Promise<Dream[]>;
  updateDreamStatus(id: string, status: DreamStatus, stage: DreamStage | null, progress: number | null): Promise<void>;
  updateDreamStage(id: string, stage: DreamStage, progress: number): Promise<void>;
  saveScreenplay(id: string, payload: { screenplayJson: string; analysisText: string; emotionTag: string; dreamType: string }): Promise<void>;
  saveMediaUrls(id: string, payload: { videoUrl: string; musicUrl?: string; voiceoverUrl?: string; durationMs: number }): Promise<void>;
  failDream(id: string, message: string): Promise<void>;
  deleteDream(id: string, userId: string | null): Promise<boolean>;
  setDreamPublic(id: string, userId: string | null, isPublic: boolean): Promise<void>;

  // Users
  upsertUser(input: { provider: 'github' | 'google'; oauthId: string; email: string | null; displayName: string; avatarUrl: string | null }): Promise<User>;
  getUserById(id: string): Promise<User | null>;
  getUserBySession(token: string): Promise<User | null>;
  createSession(userId: string, ttlMs: number): Promise<string>;
  deleteSession(token: string): Promise<void>;

  // Rate limits
  hitRateLimit(ip: string, max: number): Promise<boolean>;

  // Share tokens
  createShareLink(dreamId: string, ttlMs: number): Promise<string>;
  getShareToken(token: string): Promise<{ dreamId: string; expiresAt: number } | null>;
}

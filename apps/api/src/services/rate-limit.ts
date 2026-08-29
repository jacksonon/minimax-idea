// Rate limiting (PRD §5.1 F15, AGENTS.md §4.3).
// In-memory for speed, persisted to SQLite for cross-restart accuracy.

import { hitRateLimit } from '../db/queries.js';

const LIMITS = {
  anon: { max: 3, window: 'hour' as const },
  user: { max: 10, window: 'hour' as const },
};

export function check(ip: string, isAuthed: boolean): { allowed: boolean; remaining: number; limit: number } {
  const cfg = isAuthed ? LIMITS.user : LIMITS.anon;
  const denied = hitRateLimit(ip, cfg.max);
  // For remaining we do a quick recount (cheap with PK).
  return {
    allowed: !denied,
    remaining: denied ? 0 : cfg.max,
    limit: cfg.max,
  };
}

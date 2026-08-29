// Rate limiting (PRD §5.1 F15, AGENTS.md §4.3).
// Persisted to D1 / SQLite via db/queries.ts.

import { hitRateLimit } from '../db/queries.js';

const LIMITS = {
  anon: { max: 3, window: 'hour' as const },
  user: { max: 10, window: 'hour' as const },
};

export async function check(ip: string, isAuthed: boolean): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  const cfg = isAuthed ? LIMITS.user : LIMITS.anon;
  const denied = await hitRateLimit(ip, cfg.max);
  return {
    allowed: !denied,
    remaining: denied ? 0 : cfg.max,
    limit: cfg.max,
  };
}

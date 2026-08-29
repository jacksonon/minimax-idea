// Per-user settings routes. Used to store the GMI API key (and any other
// user-level configuration). The key belongs to the user; the server
// reads it at request time and never logs it.
//
// Per AGENTS.md §15.2 the key MUST NEVER be embedded in the repo,
// in wrangler.toml, or in any committed file. This route is the only
// way it enters the system.

import { Hono } from 'hono';
import { z } from 'zod';
import { readSessionUser } from '../services/auth.js';
import {
  deleteUserSettings,
  getUserSettings,
  upsertUserSettings,
} from '../db/queries.js';
import type { Bindings } from '../index.js';

export const settingsRoutes = new Hono<{ Bindings: Bindings }>();

const updateSchema = z.object({
  gmiApiKey: z.string().min(10).max(500),
  gmiBaseUrl: z.string().url().optional(),
});

/**
 * GET /api/settings — returns whether the user has a key, plus the
 * base URL and last-updated timestamp. NEVER returns the key itself.
 */
settingsRoutes.get('/api/settings', async (c) => {
  const user = await readSessionUser(c.req.header('cookie'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const s = await getUserSettings(user.id);
  if (!s) {
    return c.json({ hasKey: false, baseUrl: 'https://api.gmicloud.ai', updatedAt: null });
  }
  return c.json({
    hasKey: true,
    baseUrl: s.gmiBaseUrl ?? 'https://api.gmicloud.ai',
    updatedAt: s.updatedAt,
  });
});

/**
 * PUT /api/settings — save or update the user's GMI key.
 */
settingsRoutes.put('/api/settings', async (c) => {
  const user = await readSessionUser(c.req.header('cookie'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const body = await c.req.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', issues: parsed.error.issues }, 400);
  }
  const s = await upsertUserSettings(user.id, {
    gmiApiKey: parsed.data.gmiApiKey,
    gmiBaseUrl: parsed.data.gmiBaseUrl,
  });
  return c.json({
    hasKey: true,
    baseUrl: s.gmiBaseUrl ?? 'https://api.gmicloud.ai',
    updatedAt: s.updatedAt,
  });
});

/**
 * DELETE /api/settings — remove the user's GMI key.
 */
settingsRoutes.delete('/api/settings', async (c) => {
  const user = await readSessionUser(c.req.header('cookie'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const ok = await deleteUserSettings(user.id);
  return c.json({ ok });
});

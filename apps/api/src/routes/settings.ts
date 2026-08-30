// Per-user settings routes. Used to store the GMI API key (and any other
// user-level configuration). The key belongs to the user; the server
// reads it at request time and never logs it.
//
// Per AGENTS.md §15.2 the key MUST NEVER be embedded in the repo,
// in wrangler.toml, or in any committed file. This route is the only
// way it enters the system.
//
// The stored value is AES-256-GCM encrypted with a deployment secret
// (GMI_ENC_KEY), so even a raw D1 dump does not leak the key.

import { Hono } from 'hono';
import { z } from 'zod';
import { readSessionUser } from '../services/auth.js';
import {
  deleteUserSettings,
  getUserSettings,
  upsertUserSettings,
} from '../db/queries.js';
// crypto.ts uses node:crypto, which is fine in local Node dev but
// would crash a Cloudflare Worker bundle if statically imported.
// We dynamic-import it inside the request handler so the import
// is only resolved when an actual save happens.
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
  // Pass the encryption key in so we can decrypt at-rest values.
  // In production it comes from c.env (Worker secret); in local Node
  // dev it comes from process.env via .dev.vars.
  const encKey = c.env?.GMI_ENC_KEY ?? process.env.GMI_ENC_KEY;
  const s = await getUserSettings(user.id, encKey);
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
 * PUT /api/settings — save or update the user's GMI key. The key is
 * encrypted with the deployment's GMI_ENC_KEY before it ever touches
 * D1.
 */
settingsRoutes.put('/api/settings', async (c) => {
  const user = await readSessionUser(c.req.header('cookie'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const body = await c.req.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', issues: parsed.error.issues }, 400);
  }
  // In production, GMI_ENC_KEY comes from Worker secrets (c.env). In
  // local Node dev it comes from process.env via .dev.vars.
  const encKey = c.env?.GMI_ENC_KEY ?? process.env.GMI_ENC_KEY;
  const { encrypt } = await import('../services/crypto.js');
  const stored = encrypt(parsed.data.gmiApiKey, encKey);
  const s = await upsertUserSettings(user.id, {
    gmiApiKey: stored,
    gmiBaseUrl: parsed.data.gmiBaseUrl,
    encrypted: true,
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

// Media serving. In production, R2 signed URLs replace this; in dev, the
// Worker streams the file from local storage.

import { Hono } from 'hono';
import path from 'node:path';
import fs from 'node:fs';
import { env } from '../env.js';
import { getContentType, objectExists, readObject } from '../services/storage.js';
import { getDreamById } from '../db/queries.js';
import { readSessionUser } from '../services/auth.js';

export const mediaRoutes = new Hono();

mediaRoutes.get('/api/media/:key{.+}', async (c) => {
  const key = decodeURIComponent(c.req.param('key'));
  if (key.includes('..') || path.isAbsolute(key)) {
    return c.json({ error: 'Invalid key' }, 400);
  }
  if (!objectExists(key)) {
    return c.json({ error: 'Not found' }, 404);
  }

  // Per-key access control: dream videos are public (URL is unguessable
  // nanoid, and the user can always share it). In a stricter production
  // build we'd verify the dream is_public or owned by the requester.
  if (key.startsWith('dreams/')) {
    // No-op: dreams/* paths are public-by-URL.
  }

  const buf = readObject(key);
  const type = getContentType(key);
  c.header('Content-Type', type);
  c.header('Cache-Control', 'public, max-age=3600');
  c.header('Content-Length', String(buf.length));
  return c.body(buf as any);
});

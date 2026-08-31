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

/**
 * Synthetic palette image — a 1280x720 SVG with a 3-color gradient.
 * Used as a placeholder when the AI provider has no real image
 * generation. Renders in the browser without ffmpeg or any binary
 * tool, so this works on every host (Cloudflare Workers included).
 *
 * URL: /api/media/_palette/<comma-separated-#hex>?w=1280&h=720
 */
mediaRoutes.get('/api/media/_palette/:colors', (c) => {
  const colors = decodeURIComponent(c.req.param('colors'))
    .split(',')
    .map((s) => (s.startsWith('#') ? s : `#${s.replace(/^0x/i, '')}`))
    .filter((s) => /^#[0-9a-fA-F]{6}$/.test(s))
    .slice(0, 3);
  const w = Math.min(1920, Math.max(64, Number(c.req.query('w') ?? 1280)));
  const h = Math.min(1080, Math.max(64, Number(c.req.query('h') ?? 720)));
  const [c1, c2, c3] = colors.length === 3 ? colors : ['#1a1a2e', '#533483', '#e94560'];
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="50%" stop-color="${c2}"/>
      <stop offset="100%" stop-color="${c3}"/>
    </linearGradient>
    <radialGradient id="v" cx="50%" cy="50%" r="70%">
      <stop offset="60%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.55)"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <rect width="100%" height="100%" fill="url(#v)"/>
</svg>`;
  c.header('Content-Type', 'image/svg+xml');
  c.header('Cache-Control', 'public, max-age=86400');
  return c.body(svg as any);
});

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

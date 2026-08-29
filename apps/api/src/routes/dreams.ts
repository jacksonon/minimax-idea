// Hono routes for the dreams API. See PRD §7.1.

import { Hono } from 'hono';
import { z } from 'zod';
import {
  createDream,
  createShareLink,
  deleteDream,
  getDreamById,
  getShareToken,
  listDreamsForUser,
  setDreamPublic,
} from '../db/queries.js';
import { runPipeline } from '../services/pipeline.js';
import { check } from '../services/rate-limit.js';
import { moderate } from '../services/moderation.js';
import { readSessionUser } from '../services/auth.js';
import type { Bindings } from '../index.js';

export const dreamsRoutes = new Hono<{ Bindings: Bindings }>();

const generateSchema = z.object({
  transcript: z.string().min(5).max(2000),
  anonymous: z.boolean().optional().default(false),
});

dreamsRoutes.post('/api/dreams/generate', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid input', issues: parsed.error.issues }, 400);
  }

  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
  const user = await readSessionUser(c.req.header('cookie'));
  const rl = await check(ip, !!user);
  if (!rl.allowed) {
    return c.json({ error: 'Rate limit exceeded', limit: rl.limit }, 429);
  }

  const mod = moderate(parsed.data.transcript);
  if (!mod.allowed) {
    return c.json({ error: mod.reason }, 422);
  }

  const dream = await createDream({
    userId: user?.id ?? null,
    transcript: parsed.data.transcript,
  });

  // Fire and forget. In Workers, use ctx.executionCtx.waitUntil; in Node,
  // setImmediate. We sniff for the Worker context at runtime. Hono throws
  // when c.executionCtx is accessed in a Node dev server, so we wrap in try.
  let execCtx: any;
  try {
    execCtx = (c as any).executionCtx;
  } catch {
    execCtx = undefined;
  }
  if (execCtx && typeof execCtx.waitUntil === 'function') {
    execCtx.waitUntil(runPipeline(dream));
  } else {
    setImmediate(() => { runPipeline(dream); });
  }

  return c.json(
    {
      dream_id: dream.id,
      status: dream.status,
      poll_url: `/api/dreams/${dream.id}/status`,
    },
    202,
  );
});

dreamsRoutes.get('/api/dreams/:id/status', async (c) => {
  const id = c.req.param('id');
  const dream = await getDreamById(id);
  if (!dream) return c.json({ error: 'Not found' }, 404);
  return c.json({
    id: dream.id,
    status: dream.status,
    stage: dream.stage,
    progress: dream.progress,
    video_url: dream.videoUrl,
    analysis_text: dream.analysisText,
    emotion_tag: dream.emotionTag,
    dream_type: dream.dreamType,
    error: dream.errorMessage,
  });
});

dreamsRoutes.get('/api/dreams/:id', async (c) => {
  const id = c.req.param('id');
  const dream = await getDreamById(id);
  if (!dream) return c.json({ error: 'Not found' }, 404);
  const user = await readSessionUser(c.req.header('cookie'));
  if (!dream.isPublic && dream.userId !== user?.id) {
    return c.json({ error: 'Not found' }, 404);
  }
  return c.json(dream);
});

dreamsRoutes.get('/api/dreams', async (c) => {
  const user = await readSessionUser(c.req.header('cookie'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const list = await listDreamsForUser(user.id);
  return c.json({ dreams: list });
});

dreamsRoutes.delete('/api/dreams/:id', async (c) => {
  const id = c.req.param('id');
  const user = await readSessionUser(c.req.header('cookie'));
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const ok = await deleteDream(id, user.id);
  if (!ok) return c.json({ error: 'Not found' }, 404);
  return c.json({ ok: true });
});

dreamsRoutes.post('/api/dreams/:id/share', async (c) => {
  const id = c.req.param('id');
  const user = await readSessionUser(c.req.header('cookie'));
  const dream = await getDreamById(id);
  if (!dream) return c.json({ error: 'Not found' }, 404);
  if (dream.userId !== user?.id && !dream.isPublic) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  const ttlMs = 24 * 60 * 60 * 1000;
  const token = await createShareLink(id, ttlMs);
  await setDreamPublic(id, dream.userId, true);
  return c.json({
    share_url: `/share/${token}`,
    expires_at: Date.now() + ttlMs,
  });
});

dreamsRoutes.get('/api/share/:token', async (c) => {
  const token = c.req.param('token');
  const t = await getShareToken(token);
  if (!t) return c.json({ error: 'Not found or expired' }, 404);
  const dream = await getDreamById(t.dreamId);
  if (!dream) return c.json({ error: 'Not found' }, 404);
  return c.json({ dream, expires_at: t.expiresAt });
});

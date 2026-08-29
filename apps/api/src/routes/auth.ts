// Auth routes. In production, GitHub/Google OAuth handshakes live here.
// In dev, /api/auth/dev-login creates a mock user instantly (so the app is
// usable without setting up OAuth credentials).

import { Hono } from 'hono';
import { z } from 'zod';
import { loginAsMock, logout, readSessionUser, SESSION_COOKIE, SESSION_TTL_MS } from '../services/auth.js';
import type { Bindings } from '../index.js';

export const authRoutes = new Hono<{ Bindings: Bindings }>();

const devLoginSchema = z.object({
  provider: z.enum(['github', 'google']).optional().default('github'),
  handle: z.string().min(1).max(32).optional().default('dreamer'),
});

authRoutes.post('/api/auth/dev-login', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = devLoginSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid input' }, 400);

  const { user, token } = await loginAsMock(parsed.data.provider, parsed.data.handle);
  setSessionCookie(c, token);
  return c.json({ user });
});

authRoutes.post('/api/auth/logout', async (c) => {
  const cookieHeader = c.req.header('cookie');
  if (cookieHeader) {
    for (const part of cookieHeader.split(';')) {
      const [k, v] = part.trim().split('=');
      if (k === SESSION_COOKIE) await logout(decodeURIComponent(v ?? ''));
    }
  }
  deleteCookie(c);
  return c.json({ ok: true });
});

authRoutes.get('/api/auth/me', async (c) => {
  const user = await readSessionUser(c.req.header('cookie'));
  if (!user) return c.json({ user: null });
  return c.json({ user });
});

// ----- shared cookie helpers -----

export function setSessionCookie(c: any, token: string) {
  c.header(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  );
}

export function deleteCookie(c: any) {
  c.header('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; Max-Age=0`);
}

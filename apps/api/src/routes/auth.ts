// Auth routes.
//
// In production:
//   - GitHub OAuth handshake lives at /api/auth/github (GET →
//     redirect to GitHub) and /api/auth/github/callback (GET →
//     exchange code for token, fetch profile, upsert user, set cookie).
//   - dev-login is DISABLED in production.
//
// In development (ENVIRONMENT=development or unset):
//   - dev-login is enabled as a quick escape hatch (no GitHub config
//     needed to test the rest of the app).
//   - GitHub OAuth still works if GITHUB_CLIENT_ID/SECRET are set.

import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { getCookie, setCookie } from 'hono/cookie';
import {
  loginAsMock,
  loginWithGitHub,
  logout,
  readSessionUser,
  SESSION_COOKIE,
  SESSION_TTL_MS,
} from '../services/auth.js';
import type { Bindings } from '../index.js';

export const authRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * Look up a secret / env var on c.env. Hono in Cloudflare Workers
 * mode (v4.x) nests bindings under c.env.env, while top-level
 * c.env is reserved for actual Cloudflare bindings (D1, R2, KV).
 * We try both so this works on every wrangler/hono combination.
 */
function getEnv(c: any, key: string): string | undefined {
  return c.env?.[key] ?? c.env?.env?.[key];
}

function isDev(env: Bindings | undefined): boolean {
  return (env?.ENVIRONMENT ?? 'development') !== 'production';
}

const devLoginSchema = z.object({
  provider: z.enum(['github', 'google']).optional().default('github'),
  handle: z.string().min(1).max(32).optional().default('dreamer'),
});

authRoutes.post('/api/auth/dev-login', async (c) => {
  if (!isDev(c.env)) {
    return c.json({ error: 'Dev login is disabled in production. Use GitHub OAuth.' }, 403);
  }
  const body = await c.req.json().catch(() => ({}));
  const parsed = devLoginSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid input' }, 400);

  const { user, token } = await loginAsMock(parsed.data.provider, parsed.data.handle);
  setSessionCookie(c, token);
  return c.json({ user });
});

/**
 * GET /api/auth/github — begin the GitHub OAuth dance.
 *
 * Generates a random `state` nonce, stores it in a short-lived cookie,
 * and redirects the user agent to GitHub's authorize endpoint.
 */
authRoutes.get('/api/auth/github', (c) => {
  const clientId = getEnv(c, "GITHUB_CLIENT_ID");
  if (!clientId) {
    return c.json(
      {
        error:
          'GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET as Worker secrets (or in .dev.vars for local dev).',
      },
      503,
    );
  }
  const state = nanoid(24);
  // Bind the state to a short-lived cookie. The callback will compare
  // and refuse mismatches.
  setCookie(c, 'dreamreel_oauth_state', state, {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    maxAge: 600, // 10 minutes
  });
  // Remember where to return the user after callback.
  const next = c.req.query('next') || '/';
  setCookie(c, 'dreamreel_oauth_next', next, {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    maxAge: 600,
  });

  const origin = c.env?.ALLOWED_ORIGIN ?? new URL(c.req.url).origin;
  const redirectUri = `${origin}/api/auth/github/callback`;
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', 'read:user user:email');
  url.searchParams.set('state', state);
  return c.redirect(url.toString(), 302);
});

/**
 * GET /api/auth/github/callback — GitHub calls this back with ?code=&state=.
 *
 * Verifies the state cookie, exchanges the code for an access token,
 * fetches the user's GitHub profile, upserts the user row, and issues
 * a session cookie.
 */
authRoutes.get('/api/auth/github/callback', async (c) => {
  const code = c.req.query('code');
  const incomingState = c.req.query('state');
  const expectedState = getCookie(c, 'dreamreel_oauth_state');
  const next = getCookie(c, 'dreamreel_oauth_next') || '/';

  // Always clear the state cookie regardless of outcome.
  setCookie(c, 'dreamreel_oauth_state', '', { path: '/', maxAge: 0 });
  setCookie(c, 'dreamreel_oauth_next', '', { path: '/', maxAge: 0 });

  if (!code || !incomingState || !expectedState || incomingState !== expectedState) {
    return c.text('OAuth state mismatch. Please try signing in again.', 400);
  }

  const clientId = getEnv(c, "GITHUB_CLIENT_ID");
  const clientSecret = getEnv(c, "GITHUB_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    return c.json({ error: 'GitHub OAuth is not configured on the server.' }, 503);
  }

  // Exchange code → access token
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });
  if (!tokenRes.ok) {
    return c.text(`GitHub token exchange failed: HTTP ${tokenRes.status}`, 502);
  }
  const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokenJson.access_token) {
    return c.text(`GitHub token exchange failed: ${tokenJson.error ?? 'no access_token'}`, 502);
  }
  const accessToken = tokenJson.access_token;

  // Fetch user profile
  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'dreamreel',
    },
  });
  if (!userRes.ok) {
    return c.text(`GitHub /user fetch failed: HTTP ${userRes.status}`, 502);
  }
  const profile = (await userRes.json()) as {
    id: number;
    login: string;
    name: string | null;
    email: string | null;
    avatar_url: string | null;
  };

  // Best-effort primary email (profile.email is often null)
  let email = profile.email;
  if (!email) {
    const emailsRes = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'dreamreel',
      },
    });
    if (emailsRes.ok) {
      const emails = (await emailsRes.json()) as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;
      const primary = emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified);
      if (primary) email = primary.email;
    }
  }

  const { user, token } = await loginWithGitHub({
    oauthId: String(profile.id),
    login: profile.login,
    displayName: profile.name || profile.login,
    email: email ?? null,
    avatarUrl: profile.avatar_url ?? null,
  });
  setSessionCookie(c, token);
  return c.redirect(safeRedirect(next), 302);
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
  // SameSite=None so the cookie is sent on cross-origin XHR from
  // the web frontend (Pages) to the API Worker. Secure is implicit
  // on https (the only context in which we serve a SameSite=None
  // cookie anyway). Lax would block the read-back of /api/auth/me
  // from the web app, which lives on a different origin.
  c.header(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  );
}

export function deleteCookie(c: any) {
  c.header('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; Max-Age=0`);
}

/**
 * Resolve a post-login redirect. Two valid shapes:
 *   - relative path starting with a single `/` (e.g. "/me") — sent
 *     to the API Worker itself; renders a page or redirects further
 *   - absolute URL whose origin is in WEB_ALLOWED_ORIGINS — used
 *     to bounce the user back to the web frontend (which lives on
 *     a different origin than the API Worker)
 *
 * Anything else falls back to '/' to avoid open-redirect bugs.
 */
const WEB_ALLOWED_ORIGINS = new Set([
  'https://dreamreel-web.pages.dev',
  'http://localhost:3000',
]);

function safeRedirect(target: string): string {
  if (!target) return '/';
  if (target.startsWith('/') && !target.startsWith('//')) return target;
  try {
    const u = new URL(target);
    if (WEB_ALLOWED_ORIGINS.has(u.origin)) return u.toString();
  } catch {
    /* fall through */
  }
  return '/';
}

// Lightweight session helpers. In production, NextAuth issues a JWT cookie;
// in dev we issue a long random token stored in the sessions table. The web
// side reads it via the standard Cookie header.

import { createSession, deleteSession, getUserBySession, upsertUser } from '../db/queries.js';

export const SESSION_COOKIE = 'dreamreel_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function readSessionUser(cookieHeader: string | null | undefined) {
  if (!cookieHeader) return null;
  const token = parseCookie(cookieHeader, SESSION_COOKIE);
  if (!token) return null;
  return getUserBySession(token);
}

export function loginAsMock(provider: 'github' | 'google', sub: string) {
  // For local dev: auto-create a "demo" user. In real OAuth we'd parse the
  // provider's user info here. See PRD §7.1.
  const user = upsertUser({
    provider,
    oauthId: sub,
    email: `${sub}@${provider}.dev`,
    displayName: sub,
    avatarUrl: null,
  });
  const token = createSession(user.id, SESSION_TTL_MS);
  return { user, token };
}

export function logout(token: string) {
  deleteSession(token);
}

function parseCookie(header: string, name: string): string | null {
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

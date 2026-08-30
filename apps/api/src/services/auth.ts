// Lightweight session helpers. In production, NextAuth issues a JWT cookie;
// in dev we issue a long random token stored in the sessions table. The web
// side reads it via the standard Cookie header.

import { createSession, deleteSession, getUserBySession, upsertUser } from '../db/queries.js';

export const SESSION_COOKIE = 'dreamreel_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function readSessionUser(cookieHeader: string | null | undefined) {
  if (!cookieHeader) return null;
  const token = parseCookie(cookieHeader, SESSION_COOKIE);
  if (!token) return null;
  return getUserBySession(token);
}

export async function loginAsMock(provider: 'github' | 'google', sub: string) {
  // For local dev: auto-create a "demo" user. In real OAuth we'd parse the
  // provider's user info here. See PRD §7.1.
  const user = await upsertUser({
    provider,
    oauthId: sub,
    email: `${sub}@${provider}.dev`,
    displayName: sub,
    avatarUrl: null,
  });
  const token = await createSession(user.id, SESSION_TTL_MS);
  return { user, token };
}

/**
 * Authenticate a real GitHub user: upsert the user row (creating it on
 * first login) and issue a session cookie. Called from the GitHub
 * OAuth callback after the code has been exchanged for an access
 * token.
 */
export async function loginWithGitHub(input: {
  oauthId: string;
  login: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
}) {
  const user = await upsertUser({
    provider: 'github',
    oauthId: input.oauthId,
    email: input.email,
    displayName: input.displayName,
    avatarUrl: input.avatarUrl,
  });
  const token = await createSession(user.id, SESSION_TTL_MS);
  return { user, token };
}

export function logout(token: string) {
  return deleteSession(token);
}

function parseCookie(header: string, name: string): string | null {
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

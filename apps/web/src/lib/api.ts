// API client. All requests go to NEXT_PUBLIC_API_URL (the Worker).

const base = () => (typeof window === 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'));

/**
 * Rewrite a relative path into a URL the browser can load. Used for
 * media URLs returned by the API (palette placeholders, video clips,
 * music, voiceover) that the GMI provider may hand back as paths on
 * the API host itself.
 */
function absUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) {
    return `${base().replace(/\/+$/, '')}${url}`;
  }
  return `${base().replace(/\/+$/, '')}/${url}`;
}

/** Same, for the `media` payload returned by /api/dreams/:id/status. */
function absMedia(m: DreamMediaPayload | null): DreamMediaPayload | null {
  if (!m) return m;
  return {
    mode: m.mode,
    durationMs: m.durationMs,
    videos: m.videos.map((u) => absUrl(u) ?? u),
    musicUrl: absUrl(m.musicUrl),
    voiceoverUrl: absUrl(m.voiceoverUrl),
  };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body?.error || `HTTP ${res.status}`);
    (err as any).status = res.status;
    (err as any).code = body?.code;
    throw err;
  }
  return res.json() as Promise<T>;
}

export type GenerateResponse = {
  dream_id: string;
  status: 'pending';
  poll_url: string;
};

export type DreamMediaPayload = {
  mode: 'video' | 'slideshow' | 'text';
  videos: string[];
  musicUrl: string | null;
  voiceoverUrl: string | null;
  durationMs: number;
};

export type StatusResponse = {
  id: string;
  status: 'pending' | 'rendering' | 'done' | 'failed';
  stage: string | null;
  progress: number;
  video_url: string | null;
  analysis_text: string | null;
  emotion_tag: string | null;
  dream_type: string | null;
  error: string | null;
  media: DreamMediaPayload | null;
};

export type DreamListItem = {
  id: string;
  transcript: string;
  emotionTag: string | null;
  videoUrl: string | null;
  createdAt: number;
  status: 'pending' | 'rendering' | 'done' | 'failed';
  media: DreamMediaPayload | null;
};

export type MeResponse = {
  user: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    oauthProvider: 'github' | 'google';
    email: string | null;
    createdAt: number;
    lastSeenAt: number;
  } | null;
};

export type HealthResponse = {
  ok: boolean;
  env: string;
  ai: 'mock' | 'gmi';
  h3: boolean;
  /** True when the server is configured to accept new dream generation
   *  requests. False in static demo / slideshow-only deployments. */
  canGenerate?: boolean;
  /** True when the server requires a logged-in user (default: true). */
  needsAuth?: boolean;
  /** True when the logged-in user has stored a GMI API key in their account. */
  hasKey?: boolean;
  note?: string;
};

export type SettingsResponse = {
  hasKey: boolean;
  baseUrl: string;     // never returns the key
  updatedAt: number | null;
};

export type UpdateSettingsRequest = {
  gmiApiKey: string;
  gmiBaseUrl?: string;
};

export const api = {
  generate: (transcript: string) =>
    request<GenerateResponse>('/api/dreams/generate', {
      method: 'POST',
      body: JSON.stringify({ transcript }),
    }),

  status: (id: string) => request<StatusResponse>(`/api/dreams/${id}/status`),

  listMine: async (cursor?: string) => {
    const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    const r = await request<{ dreams: DreamListItem[]; nextCursor: string | null }>(`/api/dreams${q}`);
    return {
      dreams: r.dreams.map((d) => ({
        ...d,
        videoUrl: absUrl(d.videoUrl),
        media: absMedia(d.media),
      })),
      nextCursor: r.nextCursor,
    };
  },

  dream: async (id: string) => {
    const r = await request<{ id: string; transcript: string; videoUrl: string | null; analysisText: string | null; emotionTag: string | null; dreamType: string | null; createdAt: number; media: DreamMediaPayload | null }>(`/api/dreams/${id}`);
    return {
      ...r,
      videoUrl: absUrl(r.videoUrl),
      media: absMedia(r.media),
    };
  },

  share: (id: string) =>
    request<{ share_url: string; expires_at: number }>(`/api/dreams/${id}/share`, { method: 'POST' }),

  remove: (id: string) => request<{ ok: boolean }>(`/api/dreams/${id}`, { method: 'DELETE' }),

  me: () => request<MeResponse>('/api/auth/me'),

  health: () => request<HealthResponse>('/health'),

  devLogin: (handle: string) =>
    request<{ user: {
      id: string;
      displayName: string;
      avatarUrl: string | null;
      oauthProvider: 'github' | 'google';
      email: string | null;
      createdAt: number;
      lastSeenAt: number;
    } }>('/api/auth/dev-login', {
      method: 'POST',
      body: JSON.stringify({ handle }),
    }),

  /**
   * Begin the GitHub OAuth flow. We don't fetch — we navigate, because
   * the API will return a 302 redirect that we want the browser to
   * follow. `next` is the path to return to after the callback
   * (defaults to the home page).
   */
  githubLogin: (next: string = '/') => {
    if (typeof window !== 'undefined') {
      // Use the absolute API base so we hit the Worker, not the
      // Pages origin (where this /api/auth/github route does not
      // exist). The Worker returns a 302 to github.com.
      const target = next ? `${next}` : '/';
      window.location.href = `${base()}/api/auth/github?next=${encodeURIComponent(target)}`;
    }
  },

  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  // Per-user settings (e.g. their GMI API key)
  getSettings: () => request<SettingsResponse>('/api/settings'),
  updateSettings: (body: UpdateSettingsRequest) =>
    request<SettingsResponse>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteSettings: () => request<{ ok: boolean }>('/api/settings', { method: 'DELETE' }),
};

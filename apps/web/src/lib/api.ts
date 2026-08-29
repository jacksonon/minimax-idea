// API client. All requests go to NEXT_PUBLIC_API_URL (the Worker).

const base = () => (typeof window === 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'));

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
    throw err;
  }
  return res.json() as Promise<T>;
}

export type GenerateResponse = {
  dream_id: string;
  status: 'pending';
  poll_url: string;
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
};

export type DreamListItem = {
  id: string;
  transcript: string;
  emotionTag: string | null;
  videoUrl: string | null;
  createdAt: number;
  status: 'pending' | 'rendering' | 'done' | 'failed';
};

export type MeResponse = { user: { id: string; displayName: string; avatarUrl: string | null } | null };

export type HealthResponse = {
  ok: boolean;
  env: string;
  ai: 'mock' | 'gmi';
  h3: boolean;
};

export const api = {
  generate: (transcript: string) =>
    request<GenerateResponse>('/api/dreams/generate', {
      method: 'POST',
      body: JSON.stringify({ transcript }),
    }),

  status: (id: string) => request<StatusResponse>(`/api/dreams/${id}/status`),

  listMine: () => request<{ dreams: DreamListItem[] }>('/api/dreams'),

  dream: (id: string) => request<{ id: string; transcript: string; videoUrl: string | null; analysisText: string | null; emotionTag: string | null; dreamType: string | null; createdAt: number }>(`/api/dreams/${id}`),

  share: (id: string) =>
    request<{ share_url: string; expires_at: number }>(`/api/dreams/${id}/share`, { method: 'POST' }),

  remove: (id: string) => request<{ ok: boolean }>(`/api/dreams/${id}`, { method: 'DELETE' }),

  me: () => request<MeResponse>('/api/auth/me'),

  health: () => request<HealthResponse>('/health'),

  devLogin: (handle: string) =>
    request<{ user: { id: string; displayName: string; avatarUrl: string | null } }>('/api/auth/dev-login', {
      method: 'POST',
      body: JSON.stringify({ handle }),
    }),

  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
};

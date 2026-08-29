'use client';

import { create } from 'zustand';

export type Stage =
  | 'idle'
  | 'recording'
  | 'generating'
  | 'watching'
  | 'error';

export type CurrentDream = {
  id: string;
  status: 'pending' | 'rendering' | 'done' | 'failed';
  stage: string | null;
  progress: number;
  videoUrl: string | null;
  analysisText: string | null;
  emotionTag: string | null;
  dreamType: string | null;
  error: string | null;
  transcript: string;
};

/**
 * What the current deployment can do. Computed from /health (env, ai, h3)
 * and the presence of a session cookie.
 *
 *   canGenerate  — server will accept POST /api/dreams/generate
 *   needsAuth    — server requires a logged-in user; anon would 401
 *   needsKey     — server is missing GMI_API_KEY (demo mode)
 *   mode         — 'demo' (read-only) | 'slideshow' (H3 off) | 'video' (full)
 */
export type Capability = {
  canGenerate: boolean;
  needsAuth: boolean;
  needsKey: boolean;
  mode: 'demo' | 'slideshow' | 'video' | 'unknown';
};

type State = {
  stage: Stage;
  current: CurrentDream | null;
  user: { id: string; displayName: string; avatarUrl: string | null } | null;
  h3Enabled: boolean;
  capability: Capability;
  setStage: (s: Stage) => void;
  setCurrent: (d: CurrentDream | null) => void;
  setUser: (u: State['user']) => void;
  setH3Enabled: (b: boolean) => void;
  setCapability: (c: Capability) => void;
  reset: () => void;
};

export const useStore = create<State>((set) => ({
  stage: 'idle',
  current: null,
  user: null,
  // Default true so we don't flash "Video disabled" before health check returns.
  h3Enabled: true,
  capability: {
    canGenerate: false,
    needsAuth: true,
    needsKey: true,
    mode: 'unknown',
  },
  setStage: (s) => set({ stage: s }),
  setCurrent: (d) => set({ current: d }),
  setUser: (u) => set({ user: u }),
  setH3Enabled: (b) => set({ h3Enabled: b }),
  setCapability: (c) => set({ capability: c }),
  reset: () => set({ stage: 'idle', current: null }),
}));

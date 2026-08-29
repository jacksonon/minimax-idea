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

type State = {
  stage: Stage;
  current: CurrentDream | null;
  user: { id: string; displayName: string; avatarUrl: string | null } | null;
  h3Enabled: boolean;
  setStage: (s: Stage) => void;
  setCurrent: (d: CurrentDream | null) => void;
  setUser: (u: State['user']) => void;
  setH3Enabled: (b: boolean) => void;
  reset: () => void;
};

export const useStore = create<State>((set) => ({
  stage: 'idle',
  current: null,
  user: null,
  // Default true so we don't flash "Video disabled" before health check returns.
  h3Enabled: true,
  setStage: (s) => set({ stage: s }),
  setCurrent: (d) => set({ current: d }),
  setUser: (u) => set({ user: u }),
  setH3Enabled: (b) => set({ h3Enabled: b }),
  reset: () => set({ stage: 'idle', current: null }),
}));

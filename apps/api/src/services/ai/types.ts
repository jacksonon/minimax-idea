// AI adapter contract — implemented by both Mock and Gmi.
// Any service that does generation goes through one of these interfaces.

import type { Screenplay } from '@dreamreel/shared';

export type M3Request = {
  transcript: string;
};

export type M3Result = {
  screenplay: Screenplay;
};

export type VideoRequest = {
  prompt: string;
  durationSeconds: number;
  seed?: number;
};

export type VideoResult = {
  url: string;
  durationMs: number;
};

export type MusicRequest = {
  emotionTag: string;
  durationSeconds: number;
};

export type MusicResult = {
  url: string;
  durationMs: number;
};

export type SpeechRequest = {
  text: string;
  voice: string;
};

export type SpeechResult = {
  url: string;
  durationMs: number;
};

export interface AIProvider {
  name: 'mock' | 'gmi';
  generateScreenplay(req: M3Request): Promise<M3Result>;
  generateSceneVideo(req: VideoRequest): Promise<VideoResult>;
  generateMusic(req: MusicRequest): Promise<MusicResult>;
  generateSpeech(req: SpeechRequest): Promise<SpeechResult>;
}

// DreamReel — Shared types & constants
// Used by both apps/web and apps/api. Source of truth for cross-package contracts.

export const APP_NAME = 'DreamReel';
export const APP_TAGLINE = 'Tell me your dream. We’ll shoot it for you.';

export const MAX_RECORDING_SECONDS = 60;
export const MIN_RECORDING_SECONDS = 5;
export const TARGET_VIDEO_SECONDS = 30;
export const NUM_SCENES = 4;
export const SCENE_DURATION_SECONDS = 7.5;

export const POLL_INTERVAL_MS = 2000;

export const EMOTION_TAGS = [
  'terror',
  'love',
  'surreal',
  'nightmare',
  'bliss',
  'absurd',
  'melancholic',
  'cosmic',
  'pursuit',
  'falling',
] as const;
export type EmotionTag = (typeof EMOTION_TAGS)[number];

export const DREAM_TYPES = [
  'being-chased',
  'falling',
  'flying',
  'arriving-too-late',
  'teeth-falling-out',
  'death',
  'water',
  'animals',
  'unfamiliar-people',
  'sexual',
  'school-teacher',
  'paralyzed',
  'vivid-color',
  'recurring-place',
] as const;
export type DreamType = (typeof DREAM_TYPES)[number];

export const CAMERA_MOVEMENTS = [
  'push',
  'pull',
  'pan',
  'tilt',
  'static',
  'handheld',
  'dolly',
] as const;
export type CameraMovement = (typeof CAMERA_MOVEMENTS)[number];

export type Scene = {
  index: number;
  durationSeconds: number;
  visualPrompt: string;
  cameraMovement: CameraMovement;
  mood: string;
};

export type Screenplay = {
  scenes: [Scene, Scene, Scene, Scene];
  narrativeArc: string;
  voiceover: {
    text: string;
    voice: 'warm-male-en';
    pace: 'slow';
  };
  emotionTag: EmotionTag;
  dreamType: DreamType;
  analysis: string;
};

export type DreamStatus =
  | 'pending'
  | 'rendering'
  | 'done'
  | 'failed';

export type DreamStage =
  | 'screenplay'
  | 'scene-1'
  | 'scene-2'
  | 'scene-3'
  | 'scene-4'
  | 'music'
  | 'voiceover'
  | 'compositing';

export type Dream = {
  id: string;
  userId: string | null;
  transcript: string;
  screenplay: Screenplay | null;
  analysisText: string | null;
  emotionTag: EmotionTag | null;
  dreamType: DreamType | null;
  videoUrl: string | null;
  musicUrl: string | null;
  voiceoverUrl: string | null;
  durationMs: number | null;
  status: DreamStatus;
  stage: DreamStage | null;
  progress: number;
  errorMessage: string | null;
  isPublic: boolean;
  createdAt: number;
};

export type User = {
  id: string;
  oauthProvider: 'github' | 'google';
  oauthId: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  createdAt: number;
  lastSeenAt: number;
};

export type ShareToken = {
  token: string;
  dreamId: string;
  expiresAt: number;
};

export const STAGE_PROGRESS: Record<DreamStage, number> = {
  screenplay: 0.15,
  'scene-1': 0.35,
  'scene-2': 0.45,
  'scene-3': 0.55,
  'scene-4': 0.65,
  music: 0.75,
  voiceover: 0.85,
  compositing: 0.95,
};

export const STAGE_LABEL: Record<DreamStage, string> = {
  screenplay: 'Writing the screenplay\u2026',
  'scene-1': 'Shooting scene 1 of 4\u2026',
  'scene-2': 'Shooting scene 2 of 4\u2026',
  'scene-3': 'Shooting scene 3 of 4\u2026',
  'scene-4': 'Shooting scene 4 of 4\u2026',
  music: 'Scoring the music\u2026',
  voiceover: 'Recording the voiceover\u2026',
  compositing: 'Assembling the final cut\u2026',
};

export const H3_PROMPT_SUFFIX =
  ', cinematic, 24fps, anamorphic, shallow depth of field, dreamlike, surreal, soft grain, muted color palette, A24 film aesthetic, 16:9';

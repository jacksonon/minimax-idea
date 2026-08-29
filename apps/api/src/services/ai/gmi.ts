// GMI Cloud adapter — production. Activated when AI_PROVIDER=gmi.
//
// All four MiniMax models go through this file. The contract is identical to
// mock.ts so the swap is transparent to the rest of the codebase.
//
// H3 video is OPT-IN: H3 is paid even during the contest. If H3_ENABLED is
// false, generateSceneVideo() throws, and the pipeline falls back to a
// 30-second image slideshow driven by generateSceneImage().

import { env } from '../../env.js';
import type {
  AIProvider,
  ImageRequest,
  ImageResult,
  M3Request,
  M3Result,
  MusicRequest,
  MusicResult,
  SpeechRequest,
  SpeechResult,
  VideoRequest,
  VideoResult,
} from './types.js';
import type { Screenplay } from '@dreamreel/shared';

const SYSTEM_PROMPT = `You are a director of oneiric cinema. Output ONLY valid JSON.`;

function userPrompt(transcript: string): string {
  return `The dreamer described: "${transcript}"\n\n` +
    `Return JSON with shape { scenes: [4 items], narrativeArc, voiceover: {text, voice, pace}, emotionTag, dreamType, analysis }. ` +
    `Each scene: { index, durationSeconds: 7.5, visualPrompt, cameraMovement, mood }. ` +
    `emotionTag ∈ [terror, love, surreal, nightmare, bliss, absurd, melancholic, cosmic, pursuit, falling]. ` +
    `dreamType ∈ [being-chased, falling, flying, arriving-too-late, teeth-falling-out, death, water, animals, unfamiliar-people, sexual, school-teacher, paralyzed, vivid-color, recurring-place].`;
}

async function callM3Raw(transcript: string): Promise<string> {
  const res = await fetch(`${env.GMI_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.GMI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'minimax-m3',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt(transcript) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.9,
    }),
  });
  if (!res.ok) throw new Error(`M3 HTTP ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as any;
  return data.choices?.[0]?.message?.content ?? '';
}

export async function generateScreenplay(req: M3Request): Promise<M3Result> {
  const raw = await callM3Raw(req.transcript);
  const json = JSON.parse(raw);
  // The GMI output may have different field names; normalize.
  const screenplay: Screenplay = {
    scenes: (json.scenes ?? []).slice(0, 4).map((s: any, i: number) => ({
      index: i + 1,
      durationSeconds: 7.5,
      visualPrompt: s.visual_prompt ?? s.visualPrompt ?? '',
      cameraMovement: s.camera_movement ?? s.cameraMovement ?? 'static',
      mood: s.mood ?? 'dreamlike',
    })),
    narrativeArc: json.narrative_arc ?? json.narrativeArc ?? '',
    voiceover: {
      text: json.voiceover?.text ?? '',
      voice: 'warm-male-en',
      pace: 'slow',
    },
    emotionTag: json.emotion_tag ?? json.emotionTag ?? 'surreal',
    dreamType: json.dream_type ?? json.dreamType ?? 'recurring-place',
    analysis: json.analysis ?? '',
  };
  return { screenplay };
}

async function pollUntilDone(url: string, headers: Record<string, string>, maxMs = 90_000): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`H3 poll HTTP ${res.status}`);
    const data = (await res.json()) as any;
    if (data.status === 'succeeded' || data.status === 'completed') {
      return data.video_url ?? data.url;
    }
    if (data.status === 'failed') throw new Error(`H3 failed: ${data.error}`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('H3 polling timed out');
}

export async function generateSceneVideo(req: VideoRequest): Promise<VideoResult> {
  if (!env.H3_ENABLED) {
    throw new Error(
      'H3 is not enabled. Set H3_ENABLED=true (and provide GMI_API_KEY) ' +
      'to generate real video, or use the image slideshow fallback.',
    );
  }
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${env.GMI_API_KEY}`,
  };
  const start = await fetch(`${env.GMI_BASE_URL}/v1/video/generations`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: 'MiniMax-H3',
      prompt: req.prompt,
      duration: req.durationSeconds,
      aspect_ratio: '16:9',
      resolution: '720p',
      seed: req.seed,
    }),
  });
  if (!start.ok) throw new Error(`H3 start HTTP ${start.status}: ${await start.text()}`);
  const sj = (await start.json()) as any;
  const pollUrl = sj.status_url ?? sj.poll_url;
  const videoUrl = await pollUntilDone(pollUrl, headers);
  return { url: videoUrl, durationMs: req.durationSeconds * 1000 };
}

export async function generateSceneImage(req: ImageRequest): Promise<ImageResult> {
  // GMI doesn't have a dedicated image model. We use the M2.7 chat completion
  // to generate a structured prompt description, then composite a gradient
  // placeholder locally — or, if the user wants real images, they can later
  // swap in a different provider here.
  //
  // For now, we return a deterministic placeholder that still conveys the
  // dream's mood. This keeps the slideshow mode visually coherent.
  const res = await fetch(`${env.GMI_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.GMI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'minimax-m2.7',
      messages: [
        {
          role: 'system',
          content: 'You generate color palettes (3 hex codes) for dream slideshows. Output JSON only: {"colors":["#aaaaaa","#bbbbbb","#cccccc"]}.',
        },
        { role: 'user', content: `Suggest a 3-color palette for this dream scene: ${req.prompt}` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
    }),
  });
  if (!res.ok) throw new Error(`Palette HTTP ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as any;
  const content = data.choices?.[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(content);
  // We return a data: URL that the composite step will resolve via a small
  // route. For simplicity, return a placeholder URL with the palette in the
  // query string; the composite step handles the actual rendering.
  const colors = (parsed.colors ?? ['#1a1a2e', '#a663cc', '#f4a261']).join(',');
  return {
    url: `/api/media/_palette/${encodeURIComponent(colors)}?w=${req.width ?? 1280}&h=${req.height ?? 720}`,
    width: req.width ?? 1280,
    height: req.height ?? 720,
  };
}

export async function generateMusic(req: MusicRequest): Promise<MusicResult> {
  const res = await fetch(`${env.GMI_BASE_URL}/v1/audio/music/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.GMI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'minimax-music-3.0',
      prompt: `instrumental, mood=${req.emotionTag}, atmospheric, cinematic, no vocals`,
      duration: req.durationSeconds,
    }),
  });
  if (!res.ok) throw new Error(`Music HTTP ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as any;
  return { url: data.audio_url ?? data.url, durationMs: req.durationSeconds * 1000 };
}

export async function generateSpeech(req: SpeechRequest): Promise<SpeechResult> {
  const res = await fetch(`${env.GMI_BASE_URL}/v1/audio/speech/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.GMI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'minimax-tts-speech-2.8-hd',
      input: req.text,
      voice: req.voice,
    }),
  });
  if (!res.ok) throw new Error(`Speech HTTP ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as any;
  return { url: data.audio_url ?? data.url, durationMs: 30_000 };
}

export const gmiProvider: AIProvider = {
  name: 'gmi',
  h3Enabled: env.H3_ENABLED,
  generateScreenplay,
  generateSceneVideo,
  generateSceneImage,
  generateMusic,
  generateSpeech,
};

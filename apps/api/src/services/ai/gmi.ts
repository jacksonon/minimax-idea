// GMI Cloud adapter — production. Activated when AI_PROVIDER=gmi.
//
// All four MiniMax models go through this file. The contract is identical to
// mock.ts so the swap is transparent to the rest of the codebase.
//
// H3 video is OPT-IN: H3 is paid even during the contest. If H3_ENABLED is
// false, generateSceneVideo() throws, and the pipeline falls back to a
// 30-second image slideshow driven by generateSceneImage().
//
// Per-user keys
// -------------
// Each user can store their own GMI API key in `user_settings`. When the
// pipeline runs a dream, the per-user key is decrypted and passed to
// `makeGmiProvider({ apiKey, baseUrl, h3Enabled })`. The resulting
// provider is a fully isolated client bound to that user's credentials.
//
// We fall back to the deployment-wide `env.GMI_API_KEY` if the user has
// not configured their own. This is the path used in static demo
// deployments, where the per-user Settings page is hidden.

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

export type GmiConfig = {
  apiKey: string;
  baseUrl: string;
  h3Enabled: boolean;
};

/**
 * Build an AIProvider bound to a specific GMI Cloud credential set.
 *
 * The returned object holds the credentials in a closure; do not log
 * the provider or pass it across trust boundaries.
 */
export function makeGmiProvider(cfg: GmiConfig): AIProvider {
  if (!cfg.apiKey) {
    throw new Error('makeGmiProvider: apiKey is empty');
  }
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${cfg.apiKey}`,
  };

  async function callM3Raw(transcript: string): Promise<string> {
    const res = await fetch(`${cfg.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers,
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

  async function generateScreenplay(req: M3Request): Promise<M3Result> {
    const raw = await callM3Raw(req.transcript);
    const json = JSON.parse(raw);
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

  async function pollUntilDone(url: string, maxMs = 90_000): Promise<string> {
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

  async function generateSceneVideo(req: VideoRequest): Promise<VideoResult> {
    if (!cfg.h3Enabled) {
      throw new Error(
        'H3 is not enabled. Set H3_ENABLED=true (and provide GMI_API_KEY) ' +
        'to generate real video, or use the image slideshow fallback.',
      );
    }
    const start = await fetch(`${cfg.baseUrl}/v1/video/generations`, {
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
    const videoUrl = await pollUntilDone(pollUrl);
    return { url: videoUrl, durationMs: req.durationSeconds * 1000 };
  }

  async function generateSceneImage(req: ImageRequest): Promise<ImageResult> {
    // GMI doesn't have a dedicated image model. We use the M2.7 chat
    // completion to generate a structured prompt description, then
    // composite a gradient placeholder locally — or, if the user
    // wants real images, they can later swap in a different provider
    // here.
    const res = await fetch(`${cfg.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers,
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
    const colors = (parsed.colors ?? ['#1a1a2e', '#a663cc', '#f4a261']).join(',');
    return {
      url: `/api/media/_palette/${encodeURIComponent(colors)}?w=${req.width ?? 1280}&h=${req.height ?? 720}`,
      width: req.width ?? 1280,
      height: req.height ?? 720,
    };
  }

  async function generateMusic(req: MusicRequest): Promise<MusicResult> {
    const res = await fetch(`${cfg.baseUrl}/v1/audio/music/generations`, {
      method: 'POST',
      headers,
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

  async function generateSpeech(req: SpeechRequest): Promise<SpeechResult> {
    const res = await fetch(`${cfg.baseUrl}/v1/audio/speech/generations`, {
      method: 'POST',
      headers,
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

  return {
    name: 'gmi',
    h3Enabled: cfg.h3Enabled,
    generateScreenplay,
    generateSceneVideo,
    generateSceneImage,
    generateMusic,
    generateSpeech,
  };
}

/**
 * The default provider, bound to the deployment-wide env values.
 * Used when the request has no user (anonymous) or the user has not
 * configured their own GMI key. Built lazily so importing this
 * module never throws when env is missing (e.g. in unit tests).
 */
let _default: AIProvider | null = null;
export function getDefaultGmiProvider(): AIProvider {
  if (_default) return _default;
  if (!env.GMI_API_KEY) {
    throw new Error(
      'GMI_API_KEY is not set. The server cannot run the AI pipeline. ' +
      'Set it in .dev.vars (local) or via `wrangler secret put GMI_API_KEY` (production).',
    );
  }
  _default = makeGmiProvider({
    apiKey: env.GMI_API_KEY,
    baseUrl: env.GMI_BASE_URL,
    h3Enabled: env.H3_ENABLED,
  });
  return _default;
}

// Generation pipeline. See AGENTS.md §4.4 and PRD §7.2.
//
// The pipeline no longer composes a single MP4 on the server. Each
// GMI model returns a URL:
//   - M3     → 4 scene prompts + voiceover text + emotion + analysis
//   - H3     → 4 video clip URLs (when H3_ENABLED=true)
//   - Music  → 1 music URL
//   - Speech → 1 voiceover URL
//
// We persist them in `dreams.media_json` as a `DreamMedia` blob and
// let the browser sequence them: <video> onended swaps to the next
// clip, <audio> plays music and voiceover in parallel, and a
// typewriter overlay shows the transcript when H3 isn't available.
//
// This removes the only step that needed ffmpeg, so the same code
// runs in the local Node dev server and in Cloudflare Workers.
//
// Per-user credentials
// --------------------
// `runPipeline` accepts an optional `aiProvider` argument. The dream
// creation route builds the provider from the user's decrypted GMI
// key (if any), falling back to the deployment-wide key for anonymous
// users and the demo deployment.

import { ai as defaultAi } from './ai/index.js';
import {
  STAGE_PROGRESS,
  type Dream,
  type DreamMedia,
  type Screenplay,
} from '@dreamreel/shared';
import type { AIProvider } from './ai/types.js';
import {
  failDream,
  saveDreamMedia,
  saveScreenplay,
  updateDreamStage,
  updateDreamStatus,
} from '../db/queries.js';

const SLIDESHOW_FRAME_COUNT = 8; // 8 stills × 3.75s = 30s when H3 is off

export async function runPipeline(dream: Dream, aiProvider: AIProvider = defaultAi) {
  const ai = aiProvider;
  try {
    updateDreamStatus(dream.id, 'rendering', 'screenplay', STAGE_PROGRESS.screenplay);

    // 1. M3 screenplay
    const { screenplay } = await ai.generateScreenplay({ transcript: dream.transcript });
    saveScreenplay(dream.id, {
      screenplayJson: JSON.stringify(screenplay),
      analysisText: screenplay.analysis,
      emotionTag: screenplay.emotionTag,
      dreamType: screenplay.dreamType,
    });

    // 2. Parallel generation: visual media + music + speech.
    const useVideo = ai.h3Enabled;
    updateDreamStage(dream.id, 'scene-1', STAGE_PROGRESS['scene-1']);

    const advanceScene = (i: number) => {
      const next = (`scene-${i + 1}` as keyof typeof STAGE_PROGRESS);
      const progress = STAGE_PROGRESS[next];
      updateDreamStage(dream.id, next as any, progress);
    };

    // Decide what each "scene" produces. In video mode, each screenplay
    // scene is one H3 call. In slideshow mode we synthesize 8 image
    // prompts that interpolate between scenes.
    const mediaJobs: Array<{ kind: 'video' | 'image'; prompt: string }> = useVideo
      ? screenplay.scenes.map((s) => ({ kind: 'video' as const, prompt: s.visualPrompt }))
      : expandToSlideshow(screenplay);

    const mediaPromises = mediaJobs.map(async (job, i) => {
      advanceScene(Math.min(i, 3));
      try {
        if (job.kind === 'video') {
          const r = await ai.generateSceneVideo({
            prompt: job.prompt,
            durationSeconds: 7.5,
          });
          return r.url;
        } else {
          const r = await ai.generateSceneImage({
            prompt: job.prompt,
            width: 1280,
            height: 720,
          });
          return r.url;
        }
      } catch (err) {
        console.error(`[dream ${dream.id}] ${job.kind} ${i + 1} failed`, err);
        return null;
      }
    });

    const musicPromise = (async () => {
      try {
        return await ai.generateMusic({
          emotionTag: screenplay.emotionTag,
          durationSeconds: 30,
        });
      } catch (err) {
        console.error(`[dream ${dream.id}] music failed`, err);
        return null;
      }
    })();

    const speechPromise = (async () => {
      try {
        return await ai.generateSpeech({
          text: screenplay.voiceover.text,
          voice: screenplay.voiceover.voice,
        });
      } catch (err) {
        console.error(`[dream ${dream.id}] speech failed`, err);
        return null;
      }
    })();

    const [videosRaw, music, speech] = await Promise.all([
      Promise.all(mediaPromises),
      musicPromise,
      speechPromise,
    ]);

    const videos = videosRaw.filter((u): u is string => !!u);
    updateDreamStage(dream.id, 'compositing', STAGE_PROGRESS.compositing);

    // 3. Decide the final media mode. The frontend renders differently
    // for each one:
    //   - 'video'      → 4 H3 clips, <video> with onended swap
    //   - 'slideshow'  → 8 stills, <img> rotation
    //   - 'text'       → no visual; transcript typewriter
    const mode: DreamMedia['mode'] = useVideo
      ? videos.length > 0
        ? 'video'
        : 'text'
      : videos.length > 0
        ? 'slideshow'
        : 'text';

    const media: DreamMedia = {
      mode,
      videos: mode === 'video' ? videos.slice(0, 4) : mode === 'slideshow' ? videos : [],
      musicUrl: music?.url ?? null,
      voiceoverUrl: speech?.url ?? null,
      durationMs: (music?.durationMs ?? 30_000),
    };

    saveDreamMedia(dream.id, media);

    updateDreamStatus(dream.id, 'done', null, 1.0);
    console.log(`[dream ${dream.id}] done (mode: ${mode})`);
  } catch (err: any) {
    console.error(`[dream ${dream.id}] failed`, err);
    failDream(dream.id, err?.message ?? 'Unknown error');
  }
}

/**
 * Expand 4 screenplay scenes into 8 image prompts that interpolate
 * between them so the slideshow still feels like one story rather than
 * 4 unrelated stills.
 */
function expandToSlideshow(s: Screenplay): Array<{ kind: 'image'; prompt: string }> {
  const out: Array<{ kind: 'image'; prompt: string }> = [];
  for (let i = 0; i < SLIDESHOW_FRAME_COUNT; i++) {
    const sceneIdx = Math.min(Math.floor((i * s.scenes.length) / SLIDESHOW_FRAME_COUNT), s.scenes.length - 1);
    const nextIdx = Math.min(sceneIdx + 1, s.scenes.length - 1);
    const scene = s.scenes[sceneIdx]!;
    const next = s.scenes[nextIdx]!;
    const t = (i * s.scenes.length) / SLIDESHOW_FRAME_COUNT - sceneIdx; // 0..1
    const prompt = t < 0.5 ? scene.visualPrompt : next.visualPrompt;
    out.push({ kind: 'image', prompt });
  }
  return out;
}

// Generation pipeline. See AGENTS.md §4.4 and PRD §7.2.
//
// Modes:
//   - h3Enabled  → 4 video clips (H3) + 1 music + 1 voiceover, composited to 30s
//   - h3Disabled → 8 still images (slideshow) + 1 music + 1 voiceover, composited to 30s
// Each mode is a graceful degradation; the rest of the pipeline is identical.

import { ai } from './ai/index.js';
import { composeDream } from './composite.js';
import {
  STAGE_PROGRESS,
  type Dream,
  type Screenplay,
} from '@dreamreel/shared';
import {
  failDream,
  saveMediaUrls,
  saveScreenplay,
  updateDreamStage,
  updateDreamStatus,
} from '../db/queries.js';

const SLIDESHOW_FRAME_COUNT = 8; // 8 stills × 3.75s = 30s when H3 is off

export async function runPipeline(dream: Dream) {
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

    // 2. Parallel generation: visual media + music + speech
    const useVideo = ai.h3Enabled;
    updateDreamStage(dream.id, 'scene-1', STAGE_PROGRESS['scene-1']);

    const advanceScene = (i: number) => {
      const next = (`scene-${i + 1}` as keyof typeof STAGE_PROGRESS);
      const progress = STAGE_PROGRESS[next];
      updateDreamStage(dream.id, next as any, progress);
    };

    // Build a list of (kind, prompt, targetDuration) tuples. In video mode it's
    // the 4 screenplay scenes; in slideshow mode we synthesize 8 prompts that
    // interpolate the 4 scenes so the story still flows.
    const mediaJobs: Array<{ kind: 'video' | 'image'; prompt: string; duration: number }> = useVideo
      ? screenplay.scenes.map((s) => ({
          kind: 'video' as const,
          prompt: s.visualPrompt,
          duration: s.durationSeconds,
        }))
      : expandToSlideshow(screenplay);

    const mediaPromises = mediaJobs.map(async (job, i) => {
      advanceScene(Math.min(i, 3)); // stage labels only go up to scene-4
      try {
        if (job.kind === 'video') {
          const r = await ai.generateSceneVideo({
            prompt: job.prompt,
            durationSeconds: job.duration,
          });
          return { kind: 'video' as const, url: r.url, durationMs: r.durationMs };
        } else {
          const r = await ai.generateSceneImage({
            prompt: job.prompt,
            width: 1280,
            height: 720,
          });
          // Image is held for 3.75s in the slideshow
          return { kind: 'image' as const, url: r.url, durationMs: 3750 };
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

    const [media, music, speech] = await Promise.all([
      Promise.all(mediaPromises),
      musicPromise,
      speechPromise,
    ]);

    if (media.every((m) => !m)) {
      throw new Error('All scene generations failed.');
    }

    updateDreamStage(dream.id, 'compositing', STAGE_PROGRESS.compositing);

    // 3. Compose (compositeDream handles both video and image inputs).
    const { url, durationMs } = await composeDream({
      media: media.filter((m): m is NonNullable<typeof m> => m !== null),
      musicUrl: music?.url ?? null,
      voiceoverUrl: speech?.url ?? null,
      durationSeconds: 30,
    });

    saveMediaUrls(dream.id, {
      videoUrl: url,
      musicUrl: music?.url,
      voiceoverUrl: speech?.url,
      durationMs,
    });

    updateDreamStatus(dream.id, 'done', null, 1.0);

    console.log(`[dream ${dream.id}] done (mode: ${useVideo ? 'h3-video' : 'slideshow'})`);
  } catch (err: any) {
    console.error(`[dream ${dream.id}] failed`, err);
    failDream(dream.id, err?.message ?? 'Unknown error');
  }
}

/**
 * Expand 4 screenplay scenes into 8 image prompts that interpolate between them,
 * so the slideshow still feels like a single story rather than 4 unrelated stills.
 */
function expandToSlideshow(s: Screenplay): Array<{ kind: 'image'; prompt: string; duration: number }> {
  const out: Array<{ kind: 'image'; prompt: string; duration: number }> = [];
  for (let i = 0; i < SLIDESHOW_FRAME_COUNT; i++) {
    const sceneIdx = Math.min(Math.floor(i * s.scenes.length / SLIDESHOW_FRAME_COUNT), s.scenes.length - 1);
    const nextIdx = Math.min(sceneIdx + 1, s.scenes.length - 1);
    const scene = s.scenes[sceneIdx]!;
    const next = s.scenes[nextIdx]!;
    const t = (i * s.scenes.length / SLIDESHOW_FRAME_COUNT) - sceneIdx; // 0..1 within segment
    const prompt = t < 0.5 ? scene.visualPrompt : next.visualPrompt;
    out.push({ kind: 'image', prompt, duration: 3.75 });
  }
  return out;
}

// Generation pipeline. See AGENTS.md §4.4 and PRD §7.2.
// 1. M3 screenplay
// 2. H3 x 4 (parallel) + Music + Speech (parallel)
// 3. Composite → R2 (or local storage)

import { ai } from './ai/index.js';
import { composeDream } from './composite.js';
import {
  STAGE_PROGRESS,
  type Dream,
  type Screenplay,
} from '@dreamreel/shared';
import {
  failDream,
  getDreamById,
  saveMediaUrls,
  saveScreenplay,
  updateDreamStage,
  updateDreamStatus,
} from '../db/queries.js';

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

    // 2. Parallel generation: 4 H3 + 1 Music + 1 Speech
    updateDreamStage(dream.id, 'scene-1', STAGE_PROGRESS['scene-1']);

    const stageUpdates: Array<Promise<void>> = [];
    let sceneProgress = STAGE_PROGRESS['scene-1'];
    const advanceScene = (i: number) => {
      const next = (`scene-${i + 1}` as keyof typeof STAGE_PROGRESS);
      const progress = STAGE_PROGRESS[next];
      updateDreamStage(dream.id, next as any, progress);
      sceneProgress = progress;
    };

    const videoPromises = screenplay.scenes.map(async (scene, i) => {
      // Move to scene-(i+1) when this one starts (not in finally — finally runs
      // after the await Promise.all resolves, which is too late for the UI).
      advanceScene(i);
      try {
        return await ai.generateSceneVideo({
          prompt: scene.visualPrompt,
          durationSeconds: scene.durationSeconds,
        });
      } catch (err) {
        console.error(`[dream ${dream.id}] scene ${i + 1} failed`, err);
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

    const [videos, music, speech] = await Promise.all([
      Promise.all(videoPromises),
      musicPromise,
      speechPromise,
    ]);

    // If all 4 videos failed, fail the dream.
    if (videos.every((v) => !v)) {
      throw new Error('All scene generations failed.');
    }

    updateDreamStage(dream.id, 'compositing', STAGE_PROGRESS.compositing);

    // 3. Compose
    const clipUrls = videos.map((v) => v?.url ?? '').filter(Boolean);
    const { url, durationMs } = await composeDream({
      clipUrls,
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

    console.log(`[dream ${dream.id}] done`);
  } catch (err: any) {
    console.error(`[dream ${dream.id}] failed`, err);
    failDream(dream.id, err?.message ?? 'Unknown error');
  }
}

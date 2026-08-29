// End-to-end integration test of the dream pipeline.
// Skipped by default (it's slow: ~30s); run with `RUN_INTEGRATION=1 pnpm test`.

import { describe, it, expect } from 'vitest';
import { resetDb } from '../db/index.js';
import { getDreamById, createDream } from '../db/queries.js';
import { runPipeline } from './pipeline.js';

const ENABLED = process.env.RUN_INTEGRATION === '1';

describe.skipIf(!ENABLED)('dream pipeline (integration)', () => {
  it('runs from a transcript to a final 30s video', async () => {
    resetDb();
    const dream = createDream({
      userId: null,
      transcript: 'I was flying through a library made of water',
    });
    await runPipeline(dream);
    const after = getDreamById(dream.id);
    expect(after).toBeTruthy();
    expect(after!.status).toBe('done');
    expect(after!.videoUrl).toBeTruthy();
    expect(after!.screenplay).toBeTruthy();
    expect(after!.screenplay!.scenes).toHaveLength(4);
  }, 120_000);
});

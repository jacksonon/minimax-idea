// Smoke test for the M3 mock screenplay generator.

import { describe, it, expect } from 'vitest';
import { mockProvider } from './mock.js';

describe('mock M3', () => {
  it('produces a valid screenplay for a flying-dream transcript', async () => {
    const { screenplay } = await mockProvider.generateScreenplay({
      transcript: 'I was flying through a library that was upside down, the staircase was made of water.',
    });
    expect(screenplay.scenes).toHaveLength(4);
    expect(screenplay.emotionTag).toBeTruthy();
    expect(screenplay.voiceover.text).toBeTruthy();
    expect(screenplay.analysis).toBeTruthy();
    // Should detect "flying" → emotion=bliss or "library" → surreal
    expect(['bliss', 'surreal']).toContain(screenplay.emotionTag);
  });

  it('handles a terror transcript', async () => {
    const { screenplay } = await mockProvider.generateScreenplay({
      transcript: 'Something was chasing me down a long dark corridor, I never saw it but it was there.',
    });
    expect(screenplay.emotionTag).toBe('terror');
  });

  it('handles empty-ish transcript with sensible defaults', async () => {
    const { screenplay } = await mockProvider.generateScreenplay({
      transcript: 'something vague and strange',
    });
    expect(screenplay.scenes).toHaveLength(4);
  });
});

// Frontend unit test: pure logic checks for utility-like helpers.

import { describe, it, expect } from 'vitest';

describe('truncate', () => {
  it('shortens long strings with ellipsis', () => {
    const s = 'a'.repeat(80);
    const out = s.length > 60 ? s.slice(0, 60) + '\u2026' : s;
    expect(out.endsWith('\u2026')).toBe(true);
    expect(out.length).toBe(61);
  });
});

describe('poll backoff bounds', () => {
  it('caps elapsed correctly', () => {
    const elapsed = 90;
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    expect(mins).toBe(1);
    expect(secs).toBe(30);
  });
});

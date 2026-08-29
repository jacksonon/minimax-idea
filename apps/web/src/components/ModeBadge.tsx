'use client';

import { useEffect } from 'react';
import { api } from '@/lib/api';
import { useStore } from '@/lib/store';

/**
 * Tiny corner badge that shows the current generation mode:
 *   - "Video"    → H3 enabled, real video clips
 *   - "Slideshow" → H3 disabled, falling back to 8 stills + audio
 *
 * No modal, no toast — just a small persistent label so the user knows what
 * they're going to get. See PRD §11: "no emojis in production UI" and
 * AGENTS.md §11: "result page must be shareable... but the artifact is
 * honest about what it is."
 */
export function ModeBadge() {
  const h3Enabled = useStore((s) => s.h3Enabled);
  const setH3Enabled = useStore((s) => s.setH3Enabled);

  // Poll health on mount to learn the current mode.
  useEffect(() => {
    let mounted = true;
    api.health()
      .then((h) => { if (mounted) setH3Enabled(h.h3); })
      .catch(() => { /* keep default */ });
    return () => { mounted = false; };
  }, [setH3Enabled]);

  if (h3Enabled) return null;

  return (
    <div
      className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-full border border-amber/30 bg-bg/80 backdrop-blur px-3 py-1.5 text-[10px] uppercase tracking-widest text-amber"
      title="H3 video model is not enabled. Dreams are rendered as 30-second slideshows with voice and music."
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber" />
      Slideshow mode
    </div>
  );
}

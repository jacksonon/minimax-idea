'use client';

import { useEffect, useRef, useState } from 'react';
import type { DreamMediaPayload } from '@/lib/api';
import { useStore } from '@/lib/store';

/**
 * Mode-aware dream renderer. Renders one of three layouts depending
 * on what the pipeline produced. No ffmpeg, no local composition —
 * the browser sequences the assets directly.
 *
 *   'video'     → <video> onended advances to the next H3 clip;
 *                 music + voiceover play in parallel.
 *   'slideshow' → <img> rotated at SCENE_INTERVAL_MS; audio plays
 *                 alongside; each image gets a slow Ken Burns zoom.
 *   'text'      → no visual content from the AI; we show the
 *                 transcript as a typewriter overlay and play the
 *                 voiceover + music. (H3 wasn't available and the
 *                 placeholder pipeline didn't fire either.)
 *
 * `aspectVideo` controls the wrapper's aspect ratio. The player
 * falls back to a 16:9 box when `media` is null (defensive — should
 * not normally happen).
 */
type Props = {
  media: DreamMediaPayload | null;
  fallbackUrl?: string | null;
  transcript: string;
  /** Force a known aspect ratio; defaults to 16/9. */
  aspect?: '16/9' | '4/3' | '1/1';
  /** When true, autoplays as soon as mounted. */
  autoPlay?: boolean;
  className?: string;
};

const SCENE_INTERVAL_MS = 3_750; // 30s / 8 stills

export function DreamMediaView({
  media,
  fallbackUrl,
  transcript,
  aspect = '16/9',
  autoPlay = true,
  className,
}: Props) {
  // If we have a media blob use it; otherwise fall back to the legacy
  // single <video src=...> path. The legacy path always plays as
  // 'video' mode with one clip.
  const effective: DreamMediaPayload = media ?? (fallbackUrl
    ? { mode: 'video', videos: [fallbackUrl], musicUrl: null, voiceoverUrl: null, durationMs: 30_000 }
    : { mode: 'text', videos: [], musicUrl: null, voiceoverUrl: null, durationMs: 30_000 });

  return (
    <div
      className={['w-full bg-black overflow-hidden relative', className].filter(Boolean).join(' ')}
      style={{ aspectRatio: aspect.replace('/', ' / ') }}
    >
      {effective.mode === 'video' && (
        <VideoSequence media={effective} autoPlay={autoPlay} />
      )}
      {effective.mode === 'slideshow' && (
        <SlideshowSequence media={effective} autoPlay={autoPlay} />
      )}
      {effective.mode === 'text' && (
        <TextSequence transcript={transcript} media={effective} autoPlay={autoPlay} />
      )}
    </div>
  );
}

function VideoSequence({ media, autoPlay }: { media: DreamMediaPayload; autoPlay: boolean }) {
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLVideoElement | null>(null);
  const total = media.videos.length;

  // When the active clip ends, advance. If we're past the last clip,
  // loop back to the first so the user can re-watch the whole thing.
  function onEnded() {
    if (total <= 1) {
      ref.current?.play().catch(() => {});
      return;
    }
    setIdx((i) => (i + 1) % total);
  }

  // Force a fresh play whenever the active clip changes.
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.currentTime = 0;
    if (autoPlay) v.play().catch(() => {});
  }, [idx, autoPlay]);

  const current = media.videos[idx];
  if (!current) {
    return <div className="h-full w-full flex items-center justify-center text-muted">No clip</div>;
  }
  return (
    <>
      <video
        key={current}
        ref={ref}
        src={current}
        controls
        autoPlay={autoPlay}
        playsInline
        onEnded={onEnded}
        className="h-full w-full object-cover"
      />
      <ParallelAudio media={media} />
    </>
  );
}

function SlideshowSequence({ media, autoPlay }: { media: DreamMediaPayload; autoPlay: boolean }) {
  const [idx, setIdx] = useState(0);
  const total = media.videos.length;
  const startedAtRef = useRef<number>(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!autoPlay) return;
    const id = window.setInterval(() => {
      setIdx((i) => (i + 1) % Math.max(total, 1));
    }, SCENE_INTERVAL_MS);
    startedAtRef.current = Date.now();
    const tick = window.setInterval(() => {
      const elapsed = (Date.now() - startedAtRef.current) % SCENE_INTERVAL_MS;
      setProgress(elapsed / SCENE_INTERVAL_MS);
    }, 100);
    return () => {
      window.clearInterval(id);
      window.clearInterval(tick);
    };
  }, [autoPlay, total]);

  if (total === 0) {
    return <TextSequence transcript="" media={media} autoPlay={autoPlay} />;
  }
  return (
    <>
      <div className="absolute inset-0">
        {media.videos.map((src, i) => (
          <img
            key={src + i}
            src={src}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
            style={{
              opacity: i === idx ? 1 : 0,
              transform: i === idx ? `scale(${1 + progress * 0.06})` : 'scale(1)',
            }}
          />
        ))}
      </div>
      <ParallelAudio media={media} />
    </>
  );
}

function TextSequence({
  transcript,
  media,
  autoPlay,
}: {
  transcript: string;
  media: DreamMediaPayload;
  autoPlay: boolean;
}) {
  const chars = (transcript || '').split('');
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!autoPlay) return;
    if (chars.length === 0) return;
    // Reveal the transcript at a calm reading pace.
    const totalMs = Math.min(30_000, Math.max(8_000, chars.length * 60));
    const stepMs = totalMs / chars.length;
    const id = window.setInterval(() => {
      setShown((n) => (n >= chars.length ? n : n + 1));
    }, stepMs);
    return () => window.clearInterval(id);
  }, [autoPlay, chars.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e] via-[#533483] to-[#0f3460]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,0,0,0)_55%,rgba(0,0,0,0.55))]" />
      <div className="relative h-full w-full flex items-center justify-center px-8 py-12">
        <p className="font-serif text-2xl md:text-3xl leading-relaxed text-amber-50/95 text-center max-w-3xl">
          {chars.slice(0, shown).join('')}
          {shown < chars.length && <span className="animate-pulse">|</span>}
        </p>
      </div>
      <ParallelAudio media={media} />
    </>
  );
}

function ParallelAudio({ media }: { media: DreamMediaPayload }) {
  // We deliberately use a stable id-less <audio> here: we want the
  // same element across re-renders so playback doesn't restart on
  // scene changes. H3 crossfades rely on the browser to keep the
  // underlying MediaElement alive.
  return (
    <>
      {media.musicUrl && (
        <audio src={media.musicUrl} autoPlay loop playsInline preload="auto" />
      )}
      {media.voiceoverUrl && (
        <audio src={media.voiceoverUrl} autoPlay playsInline preload="auto" />
      )}
    </>
  );
}

// Suppress the unused-store warning in strict mode. The store is
// exported here so the player can be wrapped in a context later
// (e.g. for sharing) without breaking the public API.
void useStore;

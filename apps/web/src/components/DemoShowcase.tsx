'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from '@/i18n/shim';
import { Play } from 'lucide-react';

type DemoVideo = {
  id: string;
  emotion: string;
  dreamType: string;
  videoUrl: string;
  durationSec: number;
};

const R2_BASE = 'https://pub-9fe55e39e2054ec7b9e6e40211a881e5.r2.dev';

// Transcript + analysis live in messages/<locale>.json so each locale
// gets its own copy. The video file is shared; only the surrounding
// text is localized. (See AGENTS.md §3.4 / "UI only" decision for the
// non-localizable video frames.)
const DEMO_VIDEOS: DemoVideo[] = [
  {
    id: 'd_demo_1',
    emotion: 'surreal',
    dreamType: 'recurring-place',
    videoUrl: `${R2_BASE}/demos/demo-1.mp4`,
    durationSec: 30,
  },
  {
    id: 'd_demo_2',
    emotion: 'melancholic',
    dreamType: 'death',
    videoUrl: `${R2_BASE}/demos/demo-2.mp4`,
    durationSec: 30,
  },
];

export function DemoShowcase() {
  const t = useTranslations('demo');
  const tTags = useTranslations('tags');
  const tDreams = useTranslations('dreams');
  const [active, setActive] = useState<DemoVideo>(DEMO_VIDEOS[0]!);

  // Re-pick when locale changes (component remounts via key on parent)
  useEffect(() => {
    setActive(DEMO_VIDEOS[0]!);
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-10">
      {/* Banner explaining this is a demo deployment */}
      <div className="text-center space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-amber">{t('banner')}</p>
        <p className="font-serif text-2xl text-ink">{t('headline')}</p>
        <p className="text-sm text-muted max-w-xl mx-auto">{t('explanation')}</p>
      </div>

      {/* Video player */}
      <div className="space-y-4">
        <div className="aspect-video w-full bg-black rounded-lg overflow-hidden border border-ink/10 shadow-[0_30px_120px_-30px_rgba(0,0,0,0.8)]">
          <video
            key={active.id}
            src={active.videoUrl}
            controls
            autoPlay
            playsInline
            preload="metadata"
            className="h-full w-full"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="tag">{tTags(`emotion.${active.emotion}` as any)}</span>
          <span className="tag">{tTags(`dreamType.${active.dreamType}` as any)}</span>
          <span className="font-mono text-xs text-muted/60">
            {tDreams('duration', { n: active.durationSec })}
          </span>
        </div>

        <blockquote className="font-serif text-xl leading-relaxed text-ink/90 border-l-2 border-amber/40 pl-6 italic">
          &ldquo;{t(`items.${active.id.replace('d_demo_', 'd')}.analysis` as any)}&rdquo;
        </blockquote>

        <details className="text-sm text-muted">
          <summary className="cursor-pointer hover:text-ink">{t('transcriptLabel')}</summary>
          <p className="pt-3 font-serif whitespace-pre-wrap text-muted/80">
            {t(`items.${active.id.replace('d_demo_', 'd')}.transcript` as any)}
          </p>
        </details>
      </div>

      {/* Switcher */}
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-widest text-muted/60">{t('moreDreams')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {DEMO_VIDEOS.map((d) => (
            <button
              key={d.id}
              onClick={() => setActive(d)}
              className={[
                'text-left p-4 rounded-lg border transition',
                d.id === active.id
                  ? 'border-amber bg-amber/5'
                  : 'border-ink/10 hover:border-amber/40 hover:bg-ink/5',
              ].join(' ')}
            >
              <div className="flex items-center gap-2 mb-2">
                <Play className="h-3 w-3 text-amber" strokeWidth={1.5} />
                <span className="text-xs font-mono uppercase tracking-widest text-amber">
                  {tTags(`emotion.${d.emotion}` as any)}
                </span>
                <span className="text-xs text-muted/60 ml-auto">
                  {tDreams('duration', { n: d.durationSec })}
                </span>
              </div>
              <p className="font-serif text-sm text-ink line-clamp-2">
                {t(`items.${d.id.replace('d_demo_', 'd')}.transcript` as any)}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom CTA: explain how to enable full mode */}
      <div className="border-t border-ink/10 pt-6 text-center space-y-2">
        <p className="text-sm text-muted">{t('enableTitle')}</p>
        <p className="text-xs text-muted/60 max-w-2xl mx-auto">{t('enableBody')}</p>
        <a
          href="https://github.com/jacksonon/minimax-idea"
          target="_blank"
          rel="noreferrer"
          className="btn-ghost inline-flex mt-3"
        >
          {t('enableCta')}
        </a>
      </div>
    </div>
  );
}

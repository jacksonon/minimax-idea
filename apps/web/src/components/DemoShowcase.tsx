'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from '@/i18n/shim';
import { Play } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

type DemoVideo = {
  id: string;
  transcript: string;
  analysis: string;
  emotion: string;
  dreamType: string;
  videoUrl: string;
  durationSec: number;
};

const R2_BASE = 'https://pub-9fe55e39e2054ec7b9e6e40211a881e5.r2.dev';

const DEMOS_BY_LOCALE: Record<string, DemoVideo[]> = {
  // English — these are also the canonical demo videos
  en: [
    {
      id: 'd_demo_1',
      transcript: 'I was in an upside-down library, the staircase was made of water, and a woman in white knew my name but would not say it.',
      analysis: 'A library is never just a library. It is the mind pretending it has shelves for what it cannot file.',
      emotion: 'surreal',
      dreamType: 'recurring-place',
      videoUrl: `${R2_BASE}/demos/demo-1.mp4`,
      durationSec: 30,
    },
    {
      id: 'd_demo_2',
      transcript: 'My grandmother was in the kitchen making tea. She was young again, the way I remember her.',
      analysis: 'There is a room in you that still has the lights on. You walked into it tonight.',
      emotion: 'melancholic',
      dreamType: 'death',
      videoUrl: `${R2_BASE}/demos/demo-2.mp4`,
      durationSec: 30,
    },
  ],
};

// Fallback: any locale that doesn't have its own demo set gets the English ones.
function getDemosFor(locale: string): DemoVideo[] {
  return DEMOS_BY_LOCALE[locale] ?? DEMOS_BY_LOCALE.en ?? [];
}

const EMOTION_NAMES: Record<string, Record<string, string>> = {
  en: { surreal: 'surreal', melancholic: 'melancholic', terror: 'terror', love: 'love', bliss: 'bliss' },
  'zh-CN': { surreal: '超现实', melancholic: '忧郁', terror: '恐惧', love: '爱', bliss: '极乐' },
  'zh-TW': { surreal: '超現實', melancholic: '憂鬱', terror: '恐懼', love: '愛', bliss: '極樂' },
  ja: { surreal: 'シュール', melancholic: 'メランコリック', terror: '恐怖', love: '愛', bliss: '至福' },
  ko: { surreal: '초현실', melancholic: '멜랑콜리', terror: '공포', love: '사랑', bliss: '환희' },
  es: { surreal: 'surreal', melancholic: 'melancólico', terror: 'terror', love: 'amor', bliss: 'felicidad' },
  fr: { surreal: 'surréaliste', melancholic: 'mélancolique', terror: 'terreur', love: 'amour', bliss: 'félicité' },
  de: { surreal: 'surreal', melancholic: 'melancholisch', terror: 'Schrecken', love: 'Liebe', bliss: 'Glück' },
};

function emotionLabel(locale: string, key: string): string {
  const map = EMOTION_NAMES[locale] ?? EMOTION_NAMES.en ?? {};
  return map[key] ?? key;
}

export function DemoShowcase() {
  const t = useTranslations('demo');
  const { locale } = useI18n();
  const demos: DemoVideo[] = getDemosFor(locale);
  const [active, setActive] = useState<DemoVideo>(demos[0] ?? {
    id: 'd_demo_1',
    transcript: 'I was in an upside-down library, the staircase was made of water.',
    analysis: 'A library is never just a library.',
    emotion: 'surreal',
    dreamType: 'recurring-place',
    videoUrl: '',
    durationSec: 30,
  });

  // Re-pick when locale changes
  useEffect(() => {
    setActive(demos[0]!);
  }, [locale]);  // eslint-disable-line react-hooks/exhaustive-deps

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
          <span className="tag">{emotionLabel(locale, active.emotion)}</span>
          <span className="tag">{active.dreamType.replace(/-/g, ' ')}</span>
          <span className="font-mono text-xs text-muted/60">{active.durationSec}s</span>
        </div>

        <blockquote className="font-serif text-xl leading-relaxed text-ink/90 border-l-2 border-amber/40 pl-6 italic">
          &ldquo;{active.analysis}&rdquo;
        </blockquote>

        <details className="text-sm text-muted">
          <summary className="cursor-pointer hover:text-ink">{t('transcriptLabel')}</summary>
          <p className="pt-3 font-serif whitespace-pre-wrap text-muted/80">{active.transcript}</p>
        </details>
      </div>

      {/* Switcher */}
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-widest text-muted/60">{t('moreDreams')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {demos.map((d) => (
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
                  {emotionLabel(locale, d.emotion)}
                </span>
                <span className="text-xs text-muted/60 ml-auto">{d.durationSec}s</span>
              </div>
              <p className="font-serif text-sm text-ink line-clamp-2">{d.transcript}</p>
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

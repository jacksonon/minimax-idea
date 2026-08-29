'use client';

import { useTranslations } from '@/i18n/shim';
import { type DreamStage } from '@dreamreel/shared';

const STAGE_ORDER: DreamStage[] = [
  'screenplay',
  'scene-1',
  'scene-2',
  'scene-3',
  'scene-4',
  'music',
  'voiceover',
  'compositing',
];

type Props = {
  stage: DreamStage | null;
  progress: number;
  elapsed: number;
};

export function Generator({ stage, progress, elapsed }: Props) {
  const tStages = useTranslations('generator.stages');
  const t = useTranslations('generator');
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const currentIdx = stage ? STAGE_ORDER.indexOf(stage) : 0;

  return (
    <div className="flex flex-col items-center gap-12">
      <FilmReel progress={progress} />

      <div className="text-center space-y-1">
        <p className="font-serif text-2xl text-ink">
          {stage ? tStages(stage as any) : 'Starting up…'}
        </p>
        <p className="font-mono text-xs text-muted/70 tabular-nums">
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </p>
      </div>

      <div className="w-full max-w-md space-y-2">
        {STAGE_ORDER.map((s, i) => {
          const done = i < currentIdx || (progress >= 1 && i === STAGE_ORDER.length - 1);
          const active = i === currentIdx;
          return (
            <div key={s} className="flex items-center gap-3">
              <span
                className={[
                  'font-mono text-xs tabular-nums w-6 text-right',
                  done ? 'text-amber' : active ? 'text-ink' : 'text-muted/40',
                ].join(' ')}
              >
                {i + 1}
              </span>
              <div className="flex-1 h-[2px] bg-ink/10 rounded-full overflow-hidden">
                <div
                  className={[
                    'h-full transition-all duration-500',
                    done ? 'bg-amber' : active ? 'bg-ink/70' : 'bg-transparent',
                  ].join(' ')}
                  style={{ width: done ? '100%' : active ? `${(progress - (i / STAGE_ORDER.length)) * STAGE_ORDER.length * 100}%` : '0%' }}
                />
              </div>
              <span
                className={[
                  'font-sans text-xs',
                  done ? 'text-ink/70' : active ? 'text-ink' : 'text-muted/40',
                ].join(' ')}
              >
                {tStages(s as any).replace('…', '')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * A real film reel — two outer circles with sprocket holes around the
 * edge, and a small center hub. The whole assembly rotates slowly.
 * Sprocket holes are subtly highlighted in sequence to give the
 * impression of frames advancing, like a real projector.
 *
 * This replaces a generic spinner (AGENTS.md §11).
 */
function FilmReel({ progress }: { progress: number }) {
  // 12 sprocket holes evenly spaced
  const holes = Array.from({ length: 12 }, (_, i) => {
    const angle = (i * 360) / 12;
    return { angle, key: i };
  });

  return (
    <div className="relative h-40 w-40 flex items-center justify-center">
      {/* Soft halo */}
      <div className="absolute inset-0 rounded-full bg-amber/5 animate-pulse" />

      {/* Outer ring (the reel itself) */}
      <svg
        viewBox="-100 -100 200 200"
        className="absolute inset-0 w-full h-full"
        style={{ animation: 'filmroll 4s linear infinite' }}
      >
        {/* Outer disc */}
        <circle r="92" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber/40" />
        {/* Inner cutout (where film sits) */}
        <circle r="62" fill="none" stroke="currentColor" strokeWidth="1" className="text-amber/20" />
        {/* Sprocket holes — 12 around the inner edge */}
        {holes.map(({ angle, key }) => {
          const rad = (angle * Math.PI) / 180;
          const x = Math.cos(rad) * 77;
          const y = Math.sin(rad) * 77;
          return (
            <rect
              key={key}
              x={x - 4}
              y={y - 4}
              width="8"
              height="8"
              rx="1.5"
              className="fill-amber/20"
            />
          );
        })}
      </svg>

      {/* Center hub with progress ring */}
      <svg viewBox="-50 -50 100 100" className="relative h-20 w-20">
        <circle r="44" fill="none" stroke="currentColor" strokeWidth="1" className="text-amber/10" />
        <circle
          r="44"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${2 * Math.PI * 44}`}
          strokeDashoffset={`${2 * Math.PI * 44 * (1 - Math.max(0, Math.min(1, progress)))}`}
          transform="rotate(-90)"
          className="text-amber"
          style={{ transition: 'stroke-dashoffset 600ms ease' }}
        />
        <text
          x="0"
          y="2"
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-amber font-mono"
          fontSize="14"
        >
          {Math.round(progress * 100)}%
        </text>
      </svg>

      {/* Tiny shutter sound indicator (purely visual) */}
      <div
        className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-amber"
        style={{
          animation: 'pulse 0.6s ease-in-out infinite',
        }}
      />
    </div>
  );
}

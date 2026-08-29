'use client';

import { useEffect, useState } from 'react';
import { Film } from 'lucide-react';
import { STAGE_LABEL, type DreamStage } from '@dreamreel/shared';

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
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const currentIdx = stage ? STAGE_ORDER.indexOf(stage) : 0;

  return (
    <div className="flex flex-col items-center gap-12">
      <div className="relative h-32 w-32 flex items-center justify-center">
        <Film className="h-24 w-24 text-amber animate-filmroll" strokeWidth={1.2} />
        <span className="absolute inset-0 rounded-full border border-amber/20 animate-pulse" />
      </div>

      <div className="text-center space-y-1">
        <p className="font-serif text-2xl text-ink">
          {stage ? STAGE_LABEL[stage] : 'Starting up…'}
        </p>
        <p className="font-mono text-xs text-muted/70 tabular-nums">
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')} elapsed
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
                {STAGE_LABEL[s].replace('…', '')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

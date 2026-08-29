'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from '@/i18n/shim';
import { Recorder } from '@/components/recorder/Recorder';
import { Generator } from '@/components/generator/Generator';
import { DreamPlayer } from '@/components/player/DreamPlayer';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { useStore } from '@/lib/store';
import { api, type StatusResponse } from '@/lib/api';
import { POLL_INTERVAL_MS } from '@dreamreel/shared';

export default function HomePage() {
  const { stage, current, setStage, setCurrent, user, setUser, reset } = useStore();
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number>(0);
  const pollRef = useRef<number | null>(null);

  // Boot: who am I?
  useEffect(() => {
    api.me().then((r) => setUser(r.user)).catch(() => {});
  }, [setUser]);

  // Elapsed counter during generation
  useEffect(() => {
    if (stage !== 'generating') {
      setElapsed(0);
      return;
    }
    startTimeRef.current = Date.now();
    const t = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => window.clearInterval(t);
  }, [stage]);

  // Polling
  useEffect(() => {
    if (stage !== 'generating' || !current) return;
    pollRef.current = window.setInterval(async () => {
      try {
        const s: StatusResponse = await api.status(current.id);
        if (s.status === 'done') {
          setCurrent({
            ...current,
            status: 'done',
            stage: s.stage,
            progress: 1,
            videoUrl: s.video_url ? absolutize(s.video_url) : null,
            analysisText: s.analysis_text,
            emotionTag: s.emotion_tag,
            dreamType: s.dream_type,
            error: null,
          });
          if (pollRef.current) window.clearInterval(pollRef.current);
          setStage('watching');
        } else if (s.status === 'failed') {
          setCurrent({ ...current, status: 'failed', error: s.error });
          if (pollRef.current) window.clearInterval(pollRef.current);
          setStage('error');
        } else {
          setCurrent({
            ...current,
            status: s.status,
            stage: s.stage,
            progress: s.progress,
            videoUrl: s.video_url ? absolutize(s.video_url) : null,
            analysisText: s.analysis_text,
            emotionTag: s.emotion_tag,
            dreamType: s.dream_type,
            error: s.error,
          });
        }
      } catch (err) {
        // keep polling
      }
    }, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, current?.id]);

  async function handleSubmit(transcript: string) {
    try {
      const r = await api.generate(transcript);
      setCurrent({
        id: r.dream_id,
        status: r.status,
        stage: null,
        progress: 0,
        videoUrl: null,
        analysisText: null,
        emotionTag: null,
        dreamType: null,
        error: null,
        transcript,
      });
      setStage('generating');
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <main className="min-h-screen flex flex-col">
      <Header />
      <section className="flex-1 flex items-center justify-center px-6 py-16">
        {stage === 'idle' && (
          <div className="w-full max-w-2xl">
            <Recorder onSubmit={handleSubmit} />
          </div>
        )}
        {stage === 'generating' && current && (
          <Generator
            stage={(current.stage as any) || 'screenplay'}
            progress={current.progress}
            elapsed={elapsed}
          />
        )}
        {stage === 'watching' && current && current.status === 'done' && (
          <DreamPlayer />
        )}
        {stage === 'error' && current && (
          <ErrorPanel message={current.error || 'The dream refused to be filmed.'} onRetry={() => { reset(); setStage('idle'); }} />
        )}
      </section>
      <Footer />
    </main>
  );
}

function Header() {
  const { user, setUser } = useStore();
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  return (
    <header className="flex items-center justify-between px-8 py-6 border-b border-ink/5">
      <a href="/" className="font-serif text-2xl tracking-wide">
        {tCommon('appName').split('Reel')[0]}<span className="text-amber">Reel</span>
      </a>
      <nav className="flex items-center gap-3 text-sm text-ink/80">
        <ThemeToggle />
        <LocaleSwitcher />
        <a href="/dreams" className="hover:text-amber">{t('myDreams')}</a>
        {user ? (
          <button
            onClick={async () => { await api.logout(); setUser(null); }}
            className="text-muted hover:text-ink"
          >
            {t('signOut', { name: user.displayName })}
          </button>
        ) : (
          <button
            onClick={async () => {
              const r = await api.devLogin('dreamer');
              setUser(r.user);
            }}
            className="btn-ghost text-xs"
          >
            {t('signIn')}
          </button>
        )}
      </nav>
    </header>
  );
}

function Footer() {
  const t = useTranslations('home');
  return (
    <footer className="px-8 py-6 text-xs text-muted/50 border-t border-ink/5 flex items-center justify-between">
      <span>{t('footerTagline')}</span>
      <span>{t('footerCredit')}</span>
    </footer>
  );
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  const t = useTranslations('errors');
  return (
    <div className="text-center space-y-6 max-w-md">
      <p className="font-serif text-3xl text-ink">{t('loadFailed')}</p>
      <p className="text-sm text-muted">{message}</p>
      <button onClick={onRetry} className="btn-primary">{t('tryAgain')}</button>
    </div>
  );
}

function absolutize(url: string): string {
  if (url.startsWith('http')) return url;
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';
  return `${base}${url}`;
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from '@/i18n/shim';
import { Recorder } from '@/components/recorder/Recorder';
import { Generator } from '@/components/generator/Generator';
import { DreamPlayer } from '@/components/player/DreamPlayer';
import { DemoShowcase } from '@/components/DemoShowcase';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { SignInModal } from '@/components/SignInModal';
import { useStore, type Capability } from '@/lib/store';
import { api, type StatusResponse } from '@/lib/api';
import { Info } from 'lucide-react';
import { POLL_INTERVAL_MS } from '@dreamreel/shared';

export default function HomePage() {
  const t = useTranslations();
  const {
    stage, current, setStage, setCurrent,
    user, setUser, reset,
    capability, setCapability,
  } = useStore();
  const [elapsed, setElapsed] = useState(0);
  const [signInOpen, setSignInOpen] = useState(false);
  const startTimeRef = useRef<number>(0);
  const pollRef = useRef<number | null>(null);

  // Boot: who am I + what can the server do?
  useEffect(() => {
    let mounted = true;
    Promise.all([
      api.me().catch(() => ({ user: null })),
      api.health().catch(() => null),
    ]).then(([me, health]) => {
      if (!mounted) return;
      setUser(me.user);
      if (health) {
        const cap: Capability = {
          canGenerate: health.canGenerate ?? false,
          needsAuth: health.needsAuth ?? true,
          // A static demo deployment is identifiable by `ai: 'gmi'` and
          // canGenerate=false. (We could also surface a separate flag.)
          needsKey: !health.canGenerate,
          mode: !health.canGenerate
            ? 'demo'
            : health.h3
              ? 'video'
              : 'slideshow',
        };
        setCapability(cap);
      }
    });
    return () => { mounted = false; };
  }, [setUser, setCapability]);

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
    // The Recorder is shown to signed-in users even on read-only demo
    // deployments. If the server needs a session first, ask for it
    // before attempting a submission.
    if (capability.needsAuth && !user) {
      setSignInOpen(true);
      return;
    }
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
      // Server returned a structured code we can act on.
      if (err?.code === 'unauthenticated') {
        setSignInOpen(true);
        return;
      }
      if (err?.code === 'gmi_key_required') {
        const go = window.confirm(`${t('errors.needGmiKey')}\n\n${t('errors.needGmiKeyCta')}`);
        if (go) {
          window.location.href = '/me?tab=key';
        }
        return;
      }
      if (err?.code === 'provider_init_failed') {
        alert(t('errors.providerInitFailed') || err.message);
        return;
      }
      if (err?.code === 'pipeline_unavailable') {
        // Read-only demo deployment: no ffmpeg host. Surface a clear
        // error panel instead of a raw 503 alert.
        setCurrent({
          id: 'local-error',
          status: 'failed',
          stage: null,
          progress: 0,
          videoUrl: null,
          analysisText: null,
          emotionTag: null,
          dreamType: null,
          error: err.message,
          transcript,
        });
        setStage('error');
        return;
      }
      alert(err?.message ?? 'Unknown error');
    }
  }

  return (
    <main className="min-h-screen flex flex-col">
      <Header onSignInClick={() => setSignInOpen(true)} />
      <section className="flex-1 flex items-center justify-center px-6 py-16">
        {stage === 'idle' && !capability.canGenerate && !user && (
          <DemoShowcase />
        )}
        {stage === 'idle' && !capability.canGenerate && user && (
          <div className="w-full flex flex-col items-center gap-12">
            <div className="w-full max-w-2xl">
              <ReadOnlyNotice />
              <Recorder onSubmit={handleSubmit} />
            </div>
            <div className="w-full border-t border-ink/10 pt-10">
              <DemoShowcase />
            </div>
          </div>
        )}
        {stage === 'idle' && capability.canGenerate && (
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
      <SignInModal
        open={signInOpen}
        onClose={() => setSignInOpen(false)}
        onSignedIn={(u) => { setUser(u); setSignInOpen(false); }}
      />
    </main>
  );
}

function Header({ onSignInClick }: { onSignInClick: () => void }) {
  const { user, setUser, capability } = useStore();
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  return (
    <header className="flex items-center justify-between px-8 py-6 border-b border-ink/5">
      <a href="/" className="font-serif text-2xl tracking-wide">
        {tCommon('appName').split('Reel')[0]}<span className="text-amber">Reel</span>
      </a>
      <nav className="flex items-center gap-2 text-sm text-ink/80">
        <ThemeToggle />
        <LocaleSwitcher />
        {user && (
          <a
            href="/me?tab=key"
            className="inline-flex items-center justify-center h-8 px-3 rounded-full border border-ink/20 text-xs text-ink/80 hover:border-amber/40 hover:text-amber transition"
          >
            {t('settings')}
          </a>
        )}
        {user && (
          <a
            href="/me?tab=dreams"
            className="inline-flex items-center justify-center h-8 px-3 rounded-full border border-ink/20 text-xs text-ink/80 hover:border-amber/40 hover:text-amber transition"
          >
            {t('myDreams')}
          </a>
        )}
        {user ? (
          <button
            onClick={async () => { try { await api.logout(); } catch {} setUser(null); }}
            className="inline-flex items-center justify-center h-8 px-3 rounded-full border border-ink/20 text-xs text-ink/80 hover:border-amber/40 hover:text-amber transition"
            title={t('signOut', { name: user.displayName })}
          >
            {t('signOut', { name: user.displayName })}
          </button>
        ) : (
          <button
            onClick={onSignInClick}
            className="inline-flex items-center justify-center h-8 px-3 rounded-full border border-ink/20 text-xs text-ink/80 hover:border-amber/40 hover:text-amber transition"
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
  const tDemo = useTranslations('demo');
  const demoMode = message.includes('pipeline') || message.includes('ffmpeg') || message.includes('FFmpeg');
  return (
    <div className="text-center space-y-6 max-w-md">
      <p className="font-serif text-3xl text-ink">
        {demoMode ? tDemo('unavailableTitle') : t('loadFailed')}
      </p>
      <p className="text-sm text-muted">
        {demoMode ? tDemo('unavailableBody') : message}
      </p>
      <div className="flex items-center justify-center gap-3">
        {demoMode ? (
          <a
            href="https://github.com/jacksonon/minimax-idea"
            target="_blank"
            rel="noreferrer"
            className="btn-ghost inline-flex"
          >
            {tDemo('unavailableCta')}
          </a>
        ) : (
          <button onClick={onRetry} className="btn-primary">{t('tryAgain')}</button>
        )}
      </div>
    </div>
  );
}

/**
 * Shown to signed-in users on read-only demo deployments, above the
 * Recorder. The recorder still works (microphone + transcript), but
 * submission will fail with pipeline_unavailable — the notice makes
 * that clear up front instead of surprising them mid-flow.
 */
function ReadOnlyNotice() {
  const t = useTranslations('demo');
  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber/25 bg-amber/5 px-4 py-3 text-sm text-ink/80">
      <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber" strokeWidth={1.5} />
      <p>{t('readonlyNotice')}</p>
    </div>
  );
}

function absolutize(url: string): string {
  if (url.startsWith('http')) return url;
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';
  return `${base}${url}`;
}

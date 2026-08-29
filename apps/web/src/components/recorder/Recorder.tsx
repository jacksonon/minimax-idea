'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from '@/i18n/shim';
import { Mic } from 'lucide-react';
import { MAX_RECORDING_SECONDS, MIN_RECORDING_SECONDS } from '@dreamreel/shared';

type Props = {
  onSubmit: (transcript: string) => void;
};

export function Recorder({ onSubmit }: Props) {
  const t = useTranslations('recorder');
  const tHome = useTranslations('home');
  const [phase, setPhase] = useState<'idle' | 'recording' | 'transcribing'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => () => cleanup(), []);

  function cleanup() {
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
  }

  async function startRecording() {
    setError(null);
    setTranscript('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => handleStop();
      mr.start();
      setPhase('recording');
      startTimeRef.current = Date.now();
      tickRef.current = window.setInterval(() => {
        const e = (Date.now() - startTimeRef.current) / 1000;
        setElapsed(e);
        if (e >= MAX_RECORDING_SECONDS) stopRecording();
      }, 100);
      // Physical feedback per AGENTS.md §11.
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        // Mobile: tactile pulse.
        navigator.vibrate(30);
      } else {
        // Desktop: synthesized audio click so the button feels physical
        // even without a touch device. Web Audio API keeps the click
        // short and inaudible to most users above 30% volume.
        playClick();
      }
    } catch (err: any) {
      setError('Microphone access denied. You can also type your dream below.');
    }
  }

  function stopRecording() {
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    const mr = mediaRecorderRef.current;
    if (mr && mr.state === 'recording') mr.stop();
  }

  async function handleStop() {
    cleanup();
    setPhase('transcribing');
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    // Local dev path: transcribe via the browser's Web Speech API if available,
    // otherwise fall back to the typed text or a default sample.
    let text = '';
    try {
      text = await transcribeWithWebSpeech(blob);
    } catch {
      // ignore
    }
    if (!text || text.trim().length < MIN_RECORDING_SECONDS) {
      // No usable transcript — try the typed fallback
      const typed = (window.prompt('Type your dream in a sentence or two:') || '').trim();
      text = typed;
    }
    if (!text || text.length < MIN_RECORDING_SECONDS) {
      setError(tHome('sendHint'));
      setPhase('idle');
      return;
    }
    onSubmit(text);
  }

  async function transcribeWithWebSpeech(_blob: Blob): Promise<string> {
    // We use the MediaRecorder-recorded audio but Web Speech API works on a
    // live stream, not a recorded blob, so in this build we let the user type.
    return '';
  }

  /**
   * Synthesized "film click" — a short attack-decay envelope on a
   * 1 kHz sine. Makes the recording button feel like an actual
   * mechanical shutter on desktop where haptics aren't available.
   * Reused across presses (singleton AudioContext).
   */
  const audioCtxRef = useRef<AudioContext | null>(null);
  function playClick() {
    if (typeof window === 'undefined') return;
    try {
      if (!audioCtxRef.current) {
        const Ctor: typeof AudioContext | undefined =
          (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!Ctor) return;
        audioCtxRef.current = new Ctor();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1100, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
    } catch {
      // Audio not allowed or unsupported; silently ignore.
    }
  }

  const seconds = Math.floor(elapsed);
  const minutes = Math.floor(seconds / 60);
  const remSec = seconds % 60;
  const countdown = MAX_RECORDING_SECONDS - seconds;

  return (
    <div className="flex flex-col items-center gap-10">
      <button
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onMouseLeave={() => phase === 'recording' && stopRecording()}
        onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
        onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
        disabled={phase === 'transcribing'}
        className={[
          'group relative flex h-[140px] w-[140px] items-center justify-center rounded-full',
          'border-2 transition-all duration-300',
          phase === 'idle' && 'border-ink/60 hover:border-amber hover:shadow-[0_0_60px_-10px_rgba(212,165,116,0.6)] animate-breath',
          phase === 'recording' && 'border-crimson bg-crimson/10 scale-110',
          phase === 'transcribing' && 'border-muted/50 opacity-60',
        ].filter(Boolean).join(' ')}
        aria-label="Hold to record your dream"
      >
        <Mic
          className={[
            'h-12 w-12 transition-colors',
            phase === 'idle' && 'text-ink/80 group-hover:text-amber',
            phase === 'recording' && 'text-crimson',
            phase === 'transcribing' && 'text-muted',
          ].filter(Boolean).join(' ')}
          strokeWidth={1.2}
        />
        {phase === 'recording' && (
          <span className="absolute -inset-4 rounded-full border border-crimson/40 animate-pulse" />
        )}
      </button>

      <div className="text-center space-y-2">
        {phase === 'idle' && (
          <>
            <p className="font-serif text-3xl text-ink">{t('idle.title')}</p>
            <p className="text-sm text-muted">{t('idle.hint')}</p>
            <p className="text-xs text-muted/60 pt-4 max-w-sm">
              {t('idle.pitch')}
            </p>
          </>
        )}
        {phase === 'recording' && (
          <>
            <p className="font-mono text-5xl text-crimson tabular-nums">
              {String(minutes).padStart(2, '0')}:{String(remSec).padStart(2, '0')}
            </p>
            <p className="text-sm text-muted">{t('recording.release')}</p>
          </>
        )}
        {phase === 'transcribing' && (
          <>
            <p className="font-serif text-2xl text-ink">{t('transcribing.title')}</p>
            <p className="text-sm text-muted">{t('transcribing.hint')}</p>
          </>
        )}
      </div>

      {error && <p className="text-sm text-rust">{error}</p>}

      <div className="w-full max-w-md pt-4">
        <div className="text-xs uppercase tracking-widest text-muted/60 mb-2">{tHome('typeLabel')}</div>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          rows={3}
          placeholder={tHome('typePlaceholder')}
          className="w-full bg-transparent border border-ink/15 rounded-lg p-3 text-sm text-ink placeholder:text-muted/40 focus:border-amber/60 focus:outline-none"
        />
        <button
          onClick={() => transcript.trim().length >= MIN_RECORDING_SECONDS && onSubmit(transcript.trim())}
          disabled={transcript.trim().length < MIN_RECORDING_SECONDS}
          className="btn-ghost mt-3 w-full disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {tHome('send')}
        </button>
      </div>
    </div>
  );
}

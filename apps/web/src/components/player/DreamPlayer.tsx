'use client';

import { useState } from 'react';
import { useTranslations, useTag } from '@/i18n/shim';
import { useStore } from '@/lib/store';
import { api } from '@/lib/api';
import { EMOTION_TAGS } from '@dreamreel/shared';

export function DreamPlayer() {
  const t = useTranslations('player');
  const tag = useTag();
  const { current, setStage, reset } = useStore();
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  if (!current) return null;

  async function handleSave() {
    try {
      // Saving is implicit: dreams created while logged in are already saved.
      // For anonymous dreams we trigger a soft "claim" via dev login.
      const me = await api.me();
      if (!me.user) {
        await api.devLogin('dreamer');
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch {
      // ignore
    }
  }

  async function handleShare() {
    setSharing(true);
    try {
      const r = await api.share(current!.id);
      setShareUrl(`${window.location.origin}${r.share_url}`);
    } catch {
      // ignore
    } finally {
      setSharing(false);
    }
  }

  async function handleCopy() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-8">
      <div className="aspect-video w-full bg-black rounded-lg overflow-hidden border border-ink/10 shadow-[0_30px_120px_-30px_rgba(0,0,0,0.8)]">
        {current.videoUrl ? (
          <video
            src={current.videoUrl}
            controls
            autoPlay
            playsInline
            className="h-full w-full"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted">
            <p>{t('videoUnavailable')}</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {current.emotionTag && (
          <span className="tag">{tag('emotion', current.emotionTag)}</span>
        )}
        {current.dreamType && (
          <span className="tag">{tag('dreamType', current.dreamType)}</span>
        )}
      </div>

      <blockquote className="font-serif text-2xl leading-relaxed text-ink/90 border-l-2 border-amber/40 pl-6 italic">
        &ldquo;{current.analysisText || t('analysisPlaceholder')}&rdquo;
      </blockquote>

      <div className="flex flex-wrap gap-3 pt-4">
        <button onClick={handleSave} className="btn-primary">
          {saved ? `${t('saved')} ✓` : t('saveToMine')}
        </button>
        <button onClick={() => { reset(); setStage('idle'); }} className="btn-ghost">
          {t('makeAnother')}
        </button>
        {shareUrl ? (
          <button onClick={handleCopy} className="btn-ghost">
            {copied ? `${t('copied')} ✓` : t('copyLink')}
          </button>
        ) : (
          <button onClick={handleShare} disabled={sharing} className="btn-ghost">
            {sharing ? t('creating') : t('share')}
          </button>
        )}
      </div>

      {shareUrl && (
        <p className="text-xs text-muted/60 font-mono break-all">{shareUrl}</p>
      )}

      <details className="pt-4 text-xs text-muted/60">
        <summary className="cursor-pointer hover:text-ink">{t('transcriptLabel')}</summary>
        <p className="pt-2 font-serif text-sm text-muted whitespace-pre-wrap">{current.transcript}</p>
      </details>
    </div>
  );
}

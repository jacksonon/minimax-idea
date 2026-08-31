'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations, useTag } from '@/i18n/shim';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { DreamMediaView } from '@/components/player/DreamMediaView';
import type { DreamMediaPayload } from '@/lib/api';

type ShareData = {
  dream: {
    id: string;
    transcript: string;
    videoUrl: string | null;
    analysisText: string | null;
    emotionTag: string | null;
    dreamType: string | null;
    media: DreamMediaPayload | null;
  };
  expires_at: number;
};

export default function SharePage() {
  const t = useTranslations('share');
  const tag = useTag();
  const params = useParams<{ token: string }>();
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';
    fetch(`${base}/api/share/${params.token}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error('Not found')))
      .then((raw: ShareData) => {
        // Absolutize relative URLs the API may return in `media`.
        const absUrl = (u: string | null): string | null => {
          if (!u) return u;
          if (/^https?:\/\//i.test(u)) return u;
          if (u.startsWith('/')) return `${base.replace(/\/+$/, '')}${u}`;
          return `${base.replace(/\/+$/, '')}/${u}`;
        };
        const m = raw.dream.media;
        const absMedia = m
          ? {
              ...m,
              videos: m.videos.map((u) => absUrl(u) ?? u),
              musicUrl: absUrl(m.musicUrl),
              voiceoverUrl: absUrl(m.voiceoverUrl),
            }
          : null;
        setData({
          ...raw,
          dream: {
            ...raw.dream,
            videoUrl: absUrl(raw.dream.videoUrl),
            media: absMedia,
          },
        });
      })
      .catch((e) => setError(e.message));
  }, [params.token]);

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center space-y-4">
          <p className="font-serif text-3xl">{t('title')}</p>
          <p className="text-sm text-muted">{t('hint')}</p>
          <Link href="/" className="btn-primary inline-flex">{t('cta')}</Link>
        </div>
      </main>
    );
  }
  if (!data) {
    return <main className="p-12 text-muted text-center">{t('loading')}</main>;
  }

  return (
    <main className="min-h-screen px-6 py-12 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <Link href="/" className="font-serif text-2xl">DreamReel</Link>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </div>

      <DreamMediaView
        media={data.dream.media}
        fallbackUrl={data.dream.videoUrl}
        transcript={data.dream.transcript}
        className="rounded-lg border border-ink/10 mb-6"
      />

      <div className="flex flex-wrap items-center gap-2 mb-6">
        {data.dream.emotionTag && <span className="tag">{tag('emotion', data.dream.emotionTag)}</span>}
        {data.dream.dreamType && <span className="tag">{tag('dreamType', data.dream.dreamType)}</span>}
      </div>

      <blockquote className="font-serif text-2xl leading-relaxed text-ink/90 border-l-2 border-amber/40 pl-6 italic mb-8">
        &ldquo;{data.dream.analysisText}&rdquo;
      </blockquote>

      <div className="text-center pt-8">
        <Link href="/" className="btn-primary inline-flex">{t('cta')}</Link>
      </div>
    </main>
  );
}

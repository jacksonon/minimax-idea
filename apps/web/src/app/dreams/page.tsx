'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from '@/i18n/shim';
import { useI18n, makeT } from '@/i18n/I18nProvider';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { api, type DreamListItem } from '@/lib/api';

export default function DreamsPage() {
  const t = useTranslations('dreams');
  const { messages } = useI18n();
  const tRoot = makeT(messages);
  const [dreams, setDreams] = useState<DreamListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listMine()
      .then((r) => setDreams(r.dreams))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Shell><p className="text-muted">{t('loading')}</p></Shell>;
  if (error) return <Shell><p className="text-rust">{error}</p></Shell>;
  if (dreams.length === 0) {
    return (
      <Shell>
        <div className="text-center space-y-6">
          <p className="font-serif text-3xl">{t('empty.title')}</p>
          <p className="text-muted text-sm">{t('empty.hint')}</p>
          <Link href="/" className="btn-primary inline-flex">{t('empty.cta')}</Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="font-serif text-4xl mb-12">{t('title')}</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {dreams.map((d) => (
          <Link
            key={d.id}
            href={`/dreams/${d.id}`}
            className="group block border border-ink/10 rounded-lg overflow-hidden hover:border-amber/40 transition"
          >
            <div className="aspect-video bg-ink/5 relative overflow-hidden">
              {d.videoUrl ? (
                <video
                  src={d.videoUrl}
                  muted
                  playsInline
                  className="h-full w-full object-cover group-hover:scale-105 transition duration-700"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted/40 text-xs uppercase tracking-widest">
                  {d.status}
                </div>
              )}
            </div>
            <div className="p-4 space-y-2">
              <p className="font-serif text-base text-ink line-clamp-2">{shortTitle(d.transcript)}</p>
              <div className="flex items-center gap-2 text-xs text-muted/60">
                {d.emotionTag && <span className="tag">{d.emotionTag}</span>}
                <span>{formatRelative(d.createdAt, tRoot)}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('dream');
  return (
    <main className="min-h-screen px-8 py-12 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <Link href="/" className="text-sm text-muted hover:text-amber">← {t('back')}</Link>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </div>
      {children}
    </main>
  );
}

function shortTitle(t: string): string {
  const first = t.split(/[.!?]/)[0] ?? t;
  return first.length > 60 ? first.slice(0, 60) + '…' : first;
}

function formatRelative(ts: number, t: (key: string, vars?: any) => string): string {
  const diff = Date.now() - ts;
  const day = 86400000;
  if (diff < day) return t('today');
  if (diff < 2 * day) return t('yesterday');
  if (diff < 7 * day) return t('daysAgo', { n: Math.floor(diff / day) });
  if (diff < 30 * day) return t('weeksAgo', { n: Math.floor(diff / (7 * day)) });
  return new Date(ts).toLocaleDateString();
}

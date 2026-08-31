'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations, useTag } from '@/i18n/shim';
import { api, type DreamListItem } from '@/lib/api';

const PAGE_SIZE = 12;

export function DreamsPane() {
  const t = useTranslations('me.dreams');
  const tRoot = useTranslations();
  const [items, setItems] = useState<DreamListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // First load
  useEffect(() => {
    let alive = true;
    api
      .listMine()
      .then((r) => {
        if (!alive) return;
        setItems(r.dreams);
        setNextCursor(r.nextCursor);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e?.message ?? String(e));
        setItems([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Lazy load: observe the sentinel and fetch the next page when it
  // enters the viewport. The IntersectionObserver is created once;
  // we re-attach to the new sentinel after each render.
  useEffect(() => {
    if (!nextCursor) return;
    if (loadingMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            void loadMore();
            break;
          }
        }
      },
      { rootMargin: '240px' },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextCursor, loadingMore, items]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const r = await api.listMine(nextCursor);
      setItems((prev) => [...(prev ?? []), ...r.dreams]);
      setNextCursor(r.nextCursor);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoadingMore(false);
    }
  }

  if (items === null) {
    return (
      <div className="space-y-6">
        <h2 className="font-serif text-2xl">{t('heading')}</h2>
        <p className="text-muted text-sm">…</p>
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="font-serif text-2xl">{t('heading')}</h2>
        <p className="text-rust text-sm">{t('loadError')}</p>
        <p className="text-xs text-muted/60 font-mono">{error}</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="font-serif text-2xl">{t('heading')}</h2>
        <div className="text-center space-y-4 py-10 border border-ink/10 rounded-2xl">
          <p className="font-serif text-2xl">{t('emptyTitle')}</p>
          <p className="text-muted text-sm">{t('emptyHint')}</p>
          <Link href="/" className="btn-primary inline-flex">{t('openHome')}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="font-serif text-2xl">{t('heading')}</h2>

      <ol className="relative border-l border-ink/10 pl-6 space-y-6">
        {items.map((d) => (
          <li key={d.id} className="relative">
            <span className="absolute -left-[31px] top-2 h-3 w-3 rounded-full bg-amber" aria-hidden="true" />
            <DreamRow dream={d} />
          </li>
        ))}
      </ol>

      {nextCursor && (
        <div ref={sentinelRef} className="pt-2 text-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="btn-ghost text-xs disabled:opacity-50"
          >
            {loadingMore ? tRoot('dreams.loadingMore') : tRoot('dreams.loadMore')}
          </button>
        </div>
      )}
      {!nextCursor && items.length >= PAGE_SIZE && (
        <p className="text-center text-xs text-muted/50 pt-4">{tRoot('dreams.noMore')}</p>
      )}
    </div>
  );
}

function DreamRow({ dream }: { dream: DreamListItem }) {
  const t = useTranslations('me.dreams');
  const tRoot = useTranslations();
  const tDreams = useTranslations('dreams');
  const tag = useTag();
  const isDone = dream.status === 'done';
  const isFailed = dream.status === 'failed';
  const isPending = dream.status === 'pending' || dream.status === 'rendering';
  return (
    <Link
      href={`/dreams/${dream.id}`}
      className="group block border border-ink/10 rounded-xl overflow-hidden bg-bg/40 hover:border-amber/40 transition"
    >
      <div className="flex flex-col sm:flex-row">
        <div className="sm:w-48 sm:shrink-0 aspect-video bg-ink/5">
          {dream.videoUrl ? (
            <video
              src={dream.videoUrl}
              muted
              playsInline
              preload="metadata"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-muted/40 text-xs uppercase tracking-widest">
              {isPending ? t('pending') : t('videoUnavailable')}
            </div>
          )}
        </div>
        <div className="p-4 flex-1 min-w-0">
          <p className="font-serif text-base text-ink line-clamp-2">{dream.transcript}</p>
          <div className="mt-2 flex items-center gap-3 text-xs text-muted/70">
            {dream.emotionTag && <span className="tag">{tag('emotion', dream.emotionTag)}</span>}
            <span>{relative(dream.createdAt, tDreams)}</span>
            {isFailed && <span className="text-rust">{t('failed')}</span>}
            {isPending && <span className="text-amber">{t('pending')}</span>}
            {isDone && <span className="text-moss">{t('ready')}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}

function relative(ts: number, t: (k: string, v?: any) => string): string {
  const diff = Date.now() - ts;
  const day = 86400000;
  if (diff < day) return t('today');
  if (diff < 2 * day) return t('yesterday');
  if (diff < 7 * day) return t('daysAgo', { n: Math.floor(diff / day) });
  if (diff < 30 * day) return t('weeksAgo', { n: Math.floor(diff / (7 * day)) });
  return new Date(ts).toLocaleDateString();
}

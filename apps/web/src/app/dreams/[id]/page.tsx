'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';

type Dream = {
  id: string;
  transcript: string;
  videoUrl: string | null;
  analysisText: string | null;
  emotionTag: string | null;
  dreamType: string | null;
  createdAt: number;
};

export default function DreamDetail() {
  const params = useParams<{ id: string }>();
  const [dream, setDream] = useState<Dream | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.dream(params.id)
      .then(setDream)
      .catch((e) => setError(e.message));
  }, [params.id]);

  async function handleShare() {
    if (!dream) return;
    const r = await api.share(dream.id);
    await navigator.clipboard.writeText(`${window.location.origin}${r.share_url}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (error) return <main className="p-12 text-rust">{error}</main>;
  if (!dream) return <main className="p-12 text-muted">Loading…</main>;

  return (
    <main className="min-h-screen px-6 py-12 max-w-4xl mx-auto">
      <Link href="/dreams" className="text-sm text-muted hover:text-amber">← Back to my dreams</Link>

      <div className="mt-8 space-y-8">
        <div className="aspect-video w-full bg-black rounded-lg overflow-hidden border border-ink/10">
          {dream.videoUrl ? (
            <video src={dream.videoUrl} controls className="h-full w-full" />
          ) : (
            <div className="flex h-full items-center justify-center text-muted">No video</div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted/60">
          {dream.emotionTag && <span className="tag">{dream.emotionTag}</span>}
          {dream.dreamType && <span className="tag">{dream.dreamType.replace(/-/g, ' ')}</span>}
          <span>{new Date(dream.createdAt).toLocaleString()}</span>
        </div>

        <blockquote className="font-serif text-2xl leading-relaxed text-ink/90 border-l-2 border-amber/40 pl-6 italic">
          &ldquo;{dream.analysisText}&rdquo;
        </blockquote>

        <details className="text-sm text-muted">
          <summary className="cursor-pointer hover:text-ink">Transcript</summary>
          <p className="pt-3 font-serif whitespace-pre-wrap">{dream.transcript}</p>
        </details>

        <div className="flex gap-3">
          <button onClick={handleShare} className="btn-ghost">
            {copied ? 'Copied ✓' : 'Copy share link'}
          </button>
          <button
            onClick={async () => {
              if (confirm('Delete this dream?')) {
                await api.remove(dream.id);
                window.location.href = '/dreams';
              }
            }}
            className="btn-danger"
          >
            Delete
          </button>
        </div>
      </div>
    </main>
  );
}

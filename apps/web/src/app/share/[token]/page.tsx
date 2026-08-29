'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

type ShareData = {
  dream: {
    id: string;
    transcript: string;
    videoUrl: string | null;
    analysisText: string | null;
    emotionTag: string | null;
  };
  expires_at: number;
};

export default function SharePage() {
  const params = useParams<{ token: string }>();
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';
    fetch(`${base}/api/share/${params.token}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error('Not found')))
      .then(setData)
      .catch((e) => setError(e.message));
  }, [params.token]);

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center space-y-4">
          <p className="font-serif text-3xl">This dream has faded.</p>
          <p className="text-sm text-muted">The link may have expired or been removed.</p>
          <Link href="/" className="btn-primary inline-flex">Make your own dream →</Link>
        </div>
      </main>
    );
  }
  if (!data) {
    return <main className="p-12 text-muted text-center">Loading…</main>;
  }

  return (
    <main className="min-h-screen px-6 py-12 max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <Link href="/" className="font-serif text-2xl">DreamReel</Link>
      </div>

      <div className="aspect-video w-full bg-black rounded-lg overflow-hidden border border-ink/10 mb-6">
        {data.dream.videoUrl ? (
          <video src={data.dream.videoUrl} controls className="h-full w-full" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted">No video</div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        {data.dream.emotionTag && <span className="tag">{data.dream.emotionTag}</span>}
      </div>

      <blockquote className="font-serif text-2xl leading-relaxed text-ink/90 border-l-2 border-amber/40 pl-6 italic mb-8">
        &ldquo;{data.dream.analysisText}&rdquo;
      </blockquote>

      <div className="text-center pt-8">
        <Link href="/" className="btn-primary inline-flex">Make your own dream →</Link>
      </div>
    </main>
  );
}

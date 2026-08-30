'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from '@/i18n/shim';
import { api } from '@/lib/api';
import { X } from 'lucide-react';

type SignedInUser = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  oauthProvider: 'github' | 'google';
  email: string | null;
  createdAt: number;
  lastSeenAt: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSignedIn: (user: SignedInUser) => void;
  /** Where to send the user after a successful GitHub sign-in. */
  next?: string;
  /**
   * If true, render the dev-mode escape hatch (name input + dev login).
   * The web app reads this from /health in production, hiding the dev
   * controls automatically.
   */
  showDevLogin?: boolean;
};

/**
 * Modal sign-in. Primary path is "Sign in with GitHub" — clicking it
 * navigates the browser to /api/auth/github, which round-trips through
 * GitHub and back, setting a session cookie. The dev-mode name input is
 * a development-only fallback for local testing without GitHub OAuth.
 */
export function SignInModal({ open, onClose, onSignedIn, next, showDevLogin = true }: Props) {
  const t = useTranslations('auth');
  const [showDev, setShowDev] = useState(false);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setError(null);
    setOffline(false);
    setSubmitting(false);
    setShowDev(false);
    const id = window.setTimeout(() => {
      if (showDevLogin) inputRef.current?.focus();
    }, 30);
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, submitting, onClose, showDevLogin]);

  if (!open) return null;

  async function submitDev(e?: React.FormEvent) {
    e?.preventDefault();
    const handle = (name || '').trim();
    if (!handle) {
      inputRef.current?.focus();
      return;
    }
    setSubmitting(true);
    setError(null);
    setOffline(false);
    try {
      const r = await api.devLogin(handle);
      onSignedIn(r.user);
    } catch (err: any) {
      // The server is unreachable or refused. Fall back to a local
      // guest identity so the UI is still navigable.
      const now = Date.now();
      const local: SignedInUser = {
        id: `guest-${handle.toLowerCase().replace(/[^a-z0-9-]/g, '-')}-${now}`,
        displayName: handle,
        avatarUrl: null,
        oauthProvider: 'github',
        email: null,
        createdAt: now,
        lastSeenAt: now,
      };
      onSignedIn(local);
      setOffline(true);
      window.setTimeout(onClose, 1200);
    } finally {
      setSubmitting(false);
    }
  }

  function startGitHub() {
    api.githubLogin(next);
    // The browser will navigate away; nothing to clean up here.
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="signin-title"
    >
      <div className="relative w-full max-w-sm rounded-2xl border border-ink/10 bg-bg p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-ink disabled:opacity-40"
          aria-label={t('loginCancel')}
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>
        <h2 id="signin-title" className="font-serif text-2xl text-ink">
          {t('loginTitle')}
        </h2>
        <p className="mt-2 text-sm text-muted">{t('loginHint')}</p>

        <button
          type="button"
          onClick={startGitHub}
          disabled={submitting}
          className="mt-5 w-full h-10 px-5 rounded-full bg-ink text-bg text-sm font-medium hover:bg-ink/90 disabled:opacity-50 transition inline-flex items-center justify-center gap-2"
        >
          <GitHubMark className="h-4 w-4" />
          {t('githubCta')}
        </button>

        {showDevLogin && (
          <>
            <div className="mt-5 flex items-center gap-3 text-xs text-muted/60">
              <span className="h-px flex-1 bg-ink/10" />
              <span>{t('devOr')}</span>
              <span className="h-px flex-1 bg-ink/10" />
            </div>
            {!showDev ? (
              <button
                type="button"
                onClick={() => setShowDev(true)}
                className="mt-4 w-full h-10 px-4 rounded-full border border-ink/15 text-sm text-muted hover:text-ink hover:border-ink/30 transition"
              >
                {t('devModeTitle')}
              </button>
            ) : (
              <form onSubmit={submitDev} className="mt-4 space-y-3">
                <p className="text-xs text-muted/70">{t('devModeHint')}</p>
                <label className="block">
                  <span className="sr-only">{t('loginPlaceholder')}</span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('loginPlaceholder')}
                    maxLength={32}
                    autoComplete="off"
                    disabled={submitting}
                    className="w-full rounded-full border border-ink/20 bg-bg/60 px-4 h-10 text-sm text-ink placeholder:text-muted/60 focus:border-amber focus:outline-none focus:ring-2 focus:ring-amber/30 disabled:opacity-50"
                  />
                </label>
                {error && <p className="text-xs text-rust">{error}</p>}
                {offline && <p className="text-xs text-amber">{t('loginOffline')}</p>}
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDev(false)}
                    disabled={submitting}
                    className="h-10 px-4 rounded-full text-sm text-muted hover:text-ink disabled:opacity-40"
                  >
                    {t('loginCancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !name.trim()}
                    className="h-10 px-5 rounded-full bg-amber text-bg text-sm font-medium hover:bg-amber-soft disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {submitting ? '…' : t('loginCta')}
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        {!showDevLogin && (
          <p className="mt-4 text-xs text-muted/70">{t('githubNotConfigured')}</p>
        )}
      </div>
    </div>
  );
}

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2.04c-3.2.7-3.88-1.36-3.88-1.36-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.27-5.24-5.66 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.17.91-.25 1.89-.38 2.86-.39.97.01 1.95.13 2.86.39 2.18-1.48 3.14-1.17 3.14-1.17.62 1.58.23 2.75.11 3.04.74.8 1.18 1.82 1.18 3.07 0 4.4-2.7 5.36-5.26 5.65.41.35.78 1.04.78 2.1v3.11c0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

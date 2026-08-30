'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from '@/i18n/shim';
import { api } from '@/lib/api';
import { X } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  onSignedIn: (user: { id: string; displayName: string; avatarUrl: string | null }) => void;
  defaultName?: string;
};

/**
 * Modal sign-in form. Used in the header instead of the old
 * `window.confirm()` flow. Tries the server's dev-login first; if the
 * server is unreachable (typical in static demo deployments), it falls
 * back to a local guest user so the rest of the app is still usable.
 */
export function SignInModal({ open, onClose, onSignedIn, defaultName = '' }: Props) {
  const t = useTranslations('auth');
  const [name, setName] = useState(defaultName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(defaultName);
    setError(null);
    setOffline(false);
    setSubmitting(false);
    // Focus the input on open.
    const id = window.setTimeout(() => inputRef.current?.focus(), 30);
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, defaultName, submitting, onClose]);

  if (!open) return null;

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const handle = (name || '').trim();
    if (!handle) {
      setError(t('loginPlaceholder') + '?');
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
      // The server is unreachable or returned a non-OK status. Fall back
      // to a local guest identity so the UI is still navigable. We mark
      // the guest as ephemeral by prefixing the id with "guest-".
      const local = {
        id: `guest-${handle.toLowerCase().replace(/[^a-z0-9-]/g, '-')}-${Date.now()}`,
        displayName: handle,
        avatarUrl: null,
      };
      onSignedIn(local);
      setOffline(true);
      // Auto-close after a beat so the user sees the confirmation.
      window.setTimeout(onClose, 1200);
    } finally {
      setSubmitting(false);
    }
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
        <form onSubmit={submit} className="mt-5 space-y-4">
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
          {error && (
            <p className="text-xs text-rust">{error}</p>
          )}
          {offline && (
            <p className="text-xs text-amber">{t('loginOffline')}</p>
          )}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
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
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from '@/i18n/shim';
import { useI18n } from '@/i18n/I18nProvider';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { useStore } from '@/lib/store';
import { api } from '@/lib/api';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function SettingsPage() {
  const t = useTranslations('settings');
  const { user, capability } = useStore();

  const [hasKey, setHasKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState('https://api.gmicloud.ai');
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [key, setKey] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);

  // Load current settings
  useEffect(() => {
    if (!user) return;
    api.getSettings()
      .then((s) => {
        setHasKey(s.hasKey);
        setBaseUrl(s.baseUrl);
        setUpdatedAt(s.updatedAt);
      })
      .catch((e) => setError(String(e?.message ?? e)));
  }, [user]);

  if (!user) {
    return (
      <main className="min-h-screen px-8 py-12 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-sm text-muted hover:text-amber">← {t('back')}</Link>
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </div>
        <p className="text-muted">{t('notSignedIn')}</p>
      </main>
    );
  }

  if (!capability.canGenerate) {
    return (
      <main className="min-h-screen px-8 py-12 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-sm text-muted hover:text-amber">← {t('back')}</Link>
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </div>
        <div className="border border-ink/10 rounded-lg p-6 space-y-3 bg-ink/[0.02]">
          <p className="font-mono text-[10px] uppercase tracking-widest text-amber">
            {t('demoBadge')}
          </p>
          <p className="font-serif text-xl text-ink">{t('demoTitle')}</p>
          <p className="text-sm text-muted">{t('demoBody')}</p>
        </div>
      </main>
    );
  }

  async function save() {
    if (!key.trim()) return;
    setSaveState('saving');
    setError(null);
    try {
      const s = await api.updateSettings({ gmiApiKey: key.trim(), gmiBaseUrl: baseUrl });
      setHasKey(s.hasKey);
      setUpdatedAt(s.updatedAt);
      setKey(''); // clear the input after save
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setSaveState('error');
    }
  }

  async function remove() {
    if (!confirm(t('confirmRemove'))) return;
    setSaveState('saving');
    setError(null);
    try {
      await api.deleteSettings();
      setHasKey(false);
      setUpdatedAt(null);
      setSaveState('idle');
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setSaveState('error');
    }
  }

  return (
    <main className="min-h-screen px-8 py-12 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <Link href="/" className="text-sm text-muted hover:text-amber">← {t('back')}</Link>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </div>

      <h1 className="font-serif text-3xl mb-6">{t('title')}</h1>

      {/* Current state */}
      <section className="mb-8 border border-ink/10 rounded-lg p-5 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">{t('gmiKey')}</p>
          {hasKey ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-moss">
              <span className="h-1.5 w-1.5 rounded-full bg-moss" /> {t('configured')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-rust">
              <span className="h-1.5 w-1.5 rounded-full bg-rust" /> {t('notConfigured')}
            </span>
          )}
        </div>
        {updatedAt && (
          <p className="text-xs text-muted/60">
            {t('updatedAt', { when: new Date(updatedAt).toLocaleString() })}
          </p>
        )}
      </section>

      {/* Form */}
      <section className="space-y-5">
        <div>
          <label className="block text-sm text-muted mb-2" htmlFor="apiKey">
            {t('newKey')}
          </label>
          <input
            id="apiKey"
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-..."
            className="w-full bg-transparent border border-ink/15 rounded-lg p-3 text-sm text-ink placeholder:text-muted/40 focus:border-amber/60 focus:outline-none font-mono"
            autoComplete="off"
            spellCheck={false}
          />
          <p className="mt-2 text-xs text-muted/70">{t('newKeyHint')}</p>
        </div>

        <div>
          <label className="block text-sm text-muted mb-2" htmlFor="baseUrl">
            {t('baseUrl')}
          </label>
          <input
            id="baseUrl"
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="w-full bg-transparent border border-ink/15 rounded-lg p-3 text-sm text-ink placeholder:text-muted/40 focus:border-amber/60 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={save}
            disabled={!key.trim() || saveState === 'saving'}
            className="btn-primary disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {saveState === 'saving' ? t('saving') : t('save')}
          </button>
          {hasKey && (
            <button
              onClick={remove}
              disabled={saveState === 'saving'}
              className="btn-danger"
            >
              {t('remove')}
            </button>
          )}
        </div>

        {saveState === 'saved' && (
          <p className="text-sm text-moss">{t('saved')}</p>
        )}
        {error && (
          <p className="text-sm text-rust">{error}</p>
        )}
      </section>

      <p className="mt-8 text-xs text-muted/60 max-w-prose">
        {t('privacyNote')}
      </p>
    </main>
  );
}

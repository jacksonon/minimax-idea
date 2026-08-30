'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from '@/i18n/shim';
import { api, type SettingsResponse } from '@/lib/api';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * GMI Cloud API key management. Lives in the /me dashboard so users
 * have a single place for everything account-related. The key is
 * encrypted server-side (AES-256-GCM) before being written to D1 and
 * is never returned to the browser.
 */
export function KeyPane() {
  const t = useTranslations('settings');
  const [hasKey, setHasKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState('https://api.gmicloud.ai');
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [key, setKey] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getSettings()
      .then((s: SettingsResponse) => {
        setHasKey(s.hasKey);
        setBaseUrl(s.baseUrl || 'https://api.gmicloud.ai');
        setUpdatedAt(s.updatedAt);
      })
      .catch((e) => setError(e?.message ?? String(e)))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!key.trim()) return;
    setSaveState('saving');
    setError(null);
    try {
      const s = await api.updateSettings({ gmiApiKey: key.trim(), gmiBaseUrl: baseUrl });
      setHasKey(s.hasKey);
      setUpdatedAt(s.updatedAt);
      setKey('');
      setSaveState('saved');
      window.setTimeout(() => setSaveState('idle'), 2000);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setSaveState('error');
    }
  }

  async function remove() {
    if (!window.confirm(t('confirmRemove'))) return;
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
    <div className="space-y-6">
      <h2 className="font-serif text-2xl">{t('gmiKey')}</h2>

      {loading ? (
        <p className="text-muted text-sm">…</p>
      ) : (
        <>
          <section className="border border-ink/10 rounded-lg p-5 space-y-2">
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

            {saveState === 'saved' && <p className="text-sm text-moss">{t('saved')}</p>}
            {error && <p className="text-sm text-rust">{error}</p>}
          </section>

          <p className="text-xs text-muted/60 max-w-prose">{t('privacyNote')}</p>
        </>
      )}
    </div>
  );
}

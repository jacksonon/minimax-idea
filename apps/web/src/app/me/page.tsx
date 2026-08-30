'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from '@/i18n/shim';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SignInModal } from '@/components/SignInModal';
import { useStore } from '@/lib/store';
import { ProfilePane } from './ProfilePane';
import { DreamsPane } from './DreamsPane';
import { KeyPane } from './KeyPane';

type Tab = 'profile' | 'dreams' | 'key';

const TABS: Tab[] = ['profile', 'dreams', 'key'];

/**
 * The /me dashboard. Single page, three panes; the active pane is
 * reflected in the `?tab=` query parameter so each pane has a
 * shareable URL.
 *
 * Implementation note: Next.js 14's static prerender requires
 * `useSearchParams()` to be inside a `<Suspense>` boundary, so the
 * page component just renders a fallback and the actual work lives
 * in `MeDashboardInner`.
 */
export default function MePage() {
  return (
    <Suspense fallback={<MeFallback />}>
      <MeDashboardInner />
    </Suspense>
  );
}

function MeFallback() {
  return (
    <main className="min-h-screen px-6 py-12 max-w-2xl mx-auto">
      <p className="text-muted text-sm">…</p>
    </main>
  );
}

function MeDashboardInner() {
  const router = useRouter();
  const params = useSearchParams();
  const t = useTranslations('me');
  const tNav = useTranslations('nav');
  const tAuth = useTranslations('auth');
  const { user, setUser, capability } = useStore();
  const [signInOpen, setSignInOpen] = useState(false);

  const tabParam = (params.get('tab') ?? 'profile') as Tab;
  const tab: Tab = TABS.includes(tabParam) ? tabParam : 'profile';

  function setTab(next: Tab) {
    const q = new URLSearchParams(params.toString());
    q.set('tab', next);
    router.replace(`/me?${q.toString()}`);
  }

  // Refresh the user in case the session cookie changed (e.g. user
  // came back from GitHub OAuth and we need to pick up the new
  // identity). This also handles the not-signed-in case so the UI
  // doesn't get stuck showing a stale user.
  useEffect(() => {
    let alive = true;
    import('@/lib/api').then(({ api }) =>
      api.me().then((r) => {
        if (alive) setUser(r.user);
      }).catch(() => { if (alive) setUser(null); }),
    );
    return () => { alive = false; };
  }, [setUser]);

  if (!user) {
    return (
      <main className="min-h-screen px-6 py-12 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <a href="/" className="text-sm text-muted hover:text-amber">← {t('title')}</a>
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </div>
        <div className="text-center space-y-5">
          <h1 className="font-serif text-3xl">{t('notSignedIn.title')}</h1>
          <p className="text-muted text-sm">{t('notSignedIn.hint')}</p>
          <button
            onClick={() => setSignInOpen(true)}
            className="btn-primary"
          >
            {t('notSignedIn.cta')}
          </button>
        </div>
        <SignInModal
          open={signInOpen}
          onClose={() => setSignInOpen(false)}
          onSignedIn={(u) => { setUser(u); setSignInOpen(false); }}
          next="/me"
          showDevLogin={!capability.mode || capability.mode === 'unknown' ? true : capability.mode !== 'demo'}
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-10 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-10">
        <a href="/" className="text-sm text-muted hover:text-amber">← {tNav('myDreams')}</a>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
          <button
            onClick={async () => {
              const { api } = await import('@/lib/api');
              try { await api.logout(); } catch {}
              setUser(null);
            }}
            className="inline-flex items-center justify-center h-8 px-3 rounded-full border border-ink/20 text-xs text-ink/80 hover:border-amber/40 hover:text-amber transition"
          >
            {tAuth('loginCancel')}
          </button>
        </div>
      </div>

      <h1 className="font-serif text-3xl mb-8">{t('title')}</h1>

      <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-8">
        <nav aria-label="Dashboard sections" className="md:sticky md:top-6 md:self-start">
          <ul className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
            {TABS.map((k) => (
              <li key={k}>
                <button
                  onClick={() => setTab(k)}
                  aria-current={tab === k ? 'page' : undefined}
                  className={[
                    'w-full text-left px-4 py-2 rounded-lg text-sm transition',
                    tab === k
                      ? 'bg-amber/10 text-amber font-medium'
                      : 'text-muted hover:text-ink hover:bg-ink/5',
                  ].join(' ')}
                >
                  {t(`tabs.${k}`)}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <section className="min-w-0">
          {tab === 'profile' && <ProfilePane user={user} />}
          {tab === 'dreams' && <DreamsPane />}
          {tab === 'key' && <KeyPane />}
        </section>
      </div>
    </main>
  );
}

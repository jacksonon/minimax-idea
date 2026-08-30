'use client';

import { useTranslations } from '@/i18n/shim';

type User = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  oauthProvider: 'github' | 'google';
  email: string | null;
  createdAt: number;
  lastSeenAt: number;
};

const PROVIDER_LABEL: Record<User['oauthProvider'], string> = {
  github: 'GitHub',
  google: 'Google',
};

export function ProfilePane({ user }: { user: User }) {
  const t = useTranslations('me.profile');
  return (
    <div className="space-y-6">
      <h2 className="font-serif text-2xl">{t('heading')}</h2>

      <div className="flex items-center gap-4">
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt=""
            className="h-16 w-16 rounded-full object-cover border border-ink/10"
          />
        ) : (
          <div className="h-16 w-16 rounded-full bg-ink/10 flex items-center justify-center text-2xl text-muted">
            {user.displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <p className="text-sm text-muted">{t('signedInAs', { handle: user.displayName })}</p>
          <p className="font-serif text-xl text-ink mt-1">{user.displayName}</p>
        </div>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <Field label={t('name')}>{user.displayName}</Field>
        <Field label={t('provider')}>{PROVIDER_LABEL[user.oauthProvider] ?? user.oauthProvider}</Field>
        <Field label={t('email')}>
          {user.email ?? <span className="text-muted/60">{t('emailUnknown')}</span>}
        </Field>
        <Field label={t('memberSince', { when: '' })}>
          {new Date(user.createdAt).toLocaleDateString()}
        </Field>
        <Field label={t('lastSeen', { when: '' })}>
          {new Date(user.lastSeenAt).toLocaleString()}
        </Field>
        <Field label={t('id')}>
          <code className="font-mono text-xs text-muted/80 break-all">{user.id}</code>
        </Field>
      </dl>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border border-ink/10 rounded-lg px-4 py-3">
      <dt className="text-[10px] uppercase tracking-widest text-muted/70 font-mono">{label}</dt>
      <dd className="mt-1 text-ink">{children}</dd>
    </div>
  );
}

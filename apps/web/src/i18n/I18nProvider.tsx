'use client';

// Lightweight in-house i18n: no routing segment, no plugin, no third-party.
// - One JSON file per locale in /messages
// - Server reads the active locale from a cookie (set by LocaleSetter on
//   first visit, by LocaleSwitcher when the user picks one)
// - Server-side useT() reads the right message file based on the cookie
// - Client-side useT() reads from a context populated from the server
//   (and updates optimistically when the user changes locale, before
//   the reload)

import { createContext, useContext, useMemo, useEffect, useState, type ReactNode } from 'react';
import { defaultLocale as DEFAULT_LOCALE, locales, type Locale } from './config';

import en from '../../messages/en.json';
import zhCN from '../../messages/zh-CN.json';
import zhTW from '../../messages/zh-TW.json';
import ja from '../../messages/ja.json';
import ko from '../../messages/ko.json';
import es from '../../messages/es.json';
import fr from '../../messages/fr.json';
import de from '../../messages/de.json';

export const messagesByLocale: Record<Locale, any> = {
  'en': en,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  'ja': ja,
  'ko': ko,
  'es': es,
  'fr': fr,
  'de': de,
};

export function loadMessages(locale: Locale): any {
  return messagesByLocale[locale] ?? messagesByLocale[DEFAULT_LOCALE];
}

export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const entries = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag = '', ...params] = part.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q.slice(2)) || 0 : 1 };
    })
    .filter((e) => e.tag)
    .sort((a, b) => b.q - a.q);
  for (const e of entries) {
    const exact = locales.find((l) => l.toLowerCase() === e.tag);
    if (exact) return exact;
  }
  for (const e of entries) {
    const primary = e.tag.split('-')[0];
    const match = locales.find((l) => l.toLowerCase().split('-')[0] === primary);
    if (match) return match;
  }
  return DEFAULT_LOCALE;
}

type I18nContextValue = {
  locale: Locale;
  messages: any;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  initialLocale,
  initialMessages,
  children,
}: {
  initialLocale: Locale;
  initialMessages: any;
  children: ReactNode;
}) {
  // Allow client-side override after a locale change (before reload completes)
  const [override, setOverride] = useState<{ locale: Locale; messages: any } | null>(null);

  // Read the cookie value on mount to detect if the user has switched.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const match = document.cookie.match(/(?:^|; )dreamreel-locale=([^;]+)/);
    if (!match) return;
    const cookieLocale = decodeURIComponent(match[1]!) as Locale;
    if (cookieLocale !== initialLocale && locales.includes(cookieLocale)) {
      setOverride({ locale: cookieLocale, messages: loadMessages(cookieLocale) });
    }
  }, [initialLocale]);

  const value = useMemo<I18nContextValue>(() => {
    if (override) return { locale: override.locale, messages: override.messages };
    return { locale: initialLocale, messages: initialMessages };
  }, [override, initialLocale, initialMessages]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Fallback for components rendered outside the provider (e.g. error pages)
    return { locale: DEFAULT_LOCALE, messages: loadMessages(DEFAULT_LOCALE) };
  }
  return ctx;
}

export const LOCALE_COOKIE = 'dreamreel-locale';
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type { Locale } from './config';

/**
 * Tiny translation helper. Resolves a dotted key path against the
 * message object and substitutes {name} placeholders.
 *
 *   t('home.heroTitle')         → "Describe your dream."
 *   t('player.copied')          → "Copied"
 *   t('player.signOut', { name: 'alice' }) → "Sign out (alice)"
 */
export function makeT(messages: any) {
  return function t(key: string, vars?: Record<string, string | number>): string {
    const parts = key.split('.');
    let cur: any = messages;
    for (const p of parts) {
      if (cur == null || typeof cur !== 'object') return key;
      cur = cur[p];
    }
    if (typeof cur !== 'string') return key;
    if (!vars) return cur;
    return cur.replace(/\{(\w+)\}/g, (_, name) => {
      const v = vars[name];
      return v == null ? `{${name}}` : String(v);
    });
  };
}

export function useT() {
  const { messages } = useI18n();
  return makeT(messages);
}

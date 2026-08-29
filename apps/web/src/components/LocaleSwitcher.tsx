'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from '@/i18n/shim';
import { useI18n, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from '@/i18n/I18nProvider';
import { locales, localeNames, localeFlags, type Locale } from '@/i18n/config';

const COOKIE_NAME = LOCALE_COOKIE;
const COOKIE_MAX_AGE = LOCALE_COOKIE_MAX_AGE;

/**
 * Compact dropdown for switching the UI language. Writes a cookie and
 * reloads so the next render uses the new locale.
 */
export function LocaleSwitcher() {
  const { locale: current } = useI18n();
  const t = useTranslations('nav');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function pick(loc: Locale) {
    document.cookie = `${COOKIE_NAME}=${loc}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
    window.location.reload();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-full border border-ink/20 px-2.5 py-1 text-xs text-ink/80 hover:border-amber/40 hover:text-amber transition"
        aria-label="Change language"
        title="Change language"
      >
        <span>{localeFlags[current]}</span>
        <span className="font-mono uppercase tracking-wider">{current}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 rounded-lg border border-ink/15 bg-bg/95 backdrop-blur shadow-lg overflow-hidden z-50">
          {locales.map((loc) => (
            <button
              key={loc}
              onClick={() => pick(loc)}
              className={[
                'w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition',
                loc === current
                  ? 'bg-amber/10 text-amber'
                  : 'text-ink/80 hover:bg-ink/5 hover:text-ink',
              ].join(' ')}
            >
              <span>{localeFlags[loc]}</span>
              <span className="flex-1">{localeNames[loc]}</span>
              {loc === current && <span className="text-amber">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

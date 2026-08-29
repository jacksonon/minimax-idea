'use client';

import { useEffect } from 'react';
import { useI18n, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, negotiateLocale, type Locale } from '@/i18n/I18nProvider';

/**
 * Side-effect component: on first visit, detect the user's preferred
 * language and set a cookie. The next page render will use the matching
 * translation. No redirect, no URL change.
 */
export function LocaleSetter() {
  const { locale: currentLocale } = useI18n();
  useEffect(() => {
    if (typeof document === 'undefined') return;
    // Only set if the user hasn't already chosen (no cookie yet).
    if (document.cookie.includes(`${LOCALE_COOKIE}=`)) return;
    const best = negotiateLocale(
      typeof navigator !== 'undefined'
        ? (navigator.languages && navigator.languages.length > 0
            ? navigator.languages.join(',')
            : navigator.language)
        : null,
    );
    if (best === currentLocale) return;
    // Persist for 1 year. Path=/ so it covers all routes.
    document.cookie = `${LOCALE_COOKIE}=${best}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
    // Reload so the new locale takes effect on this visit.
    window.location.reload();
  }, [currentLocale]);
  return null;
}

// i18n configuration — in-house, no third-party deps.
//
// We deliberately use the "without i18n routing" pattern (locale in a
// cookie, not in the URL) so that dynamic routes like /dreams/[id] and
// /share/[token] keep working on Cloudflare Pages static deploys.

export const locales = ['en', 'zh-CN', 'zh-TW', 'ja', 'ko', 'es', 'fr', 'de'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  'en': 'English',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  'ja': '日本語',
  'ko': '한국어',
  'es': 'Español',
  'fr': 'Français',
  'de': 'Deutsch',
};

export const localeFlags: Record<Locale, string> = {
  'en': '🇺🇸',
  'zh-CN': '🇨🇳',
  'zh-TW': '🇹🇼',
  'ja': '🇯🇵',
  'ko': '🇰🇷',
  'es': '🇪🇸',
  'fr': '🇫🇷',
  'de': '🇩🇪',
};

// Compatibility shim that mimics next-intl's `useTranslations(namespace)`
// signature but resolves keys against our in-house message store. This
// lets us keep the existing call sites (`const t = useTranslations('home')`)
// working without rewriting every component.

import { useI18n, makeT } from './I18nProvider';

function getPath(obj: any, path: string): any {
  return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

function interpolate(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, n) =>
    n in vars ? String(vars[n]) : `{${n}}`,
  );
}

/**
 * Mimics next-intl's useTranslations. Returns a function `t(key, vars?)`
 * that resolves `key` first within the given namespace, then falls back
 * to the full path. Variable substitution uses {name} placeholders.
 */
export function useTranslations(namespace?: string) {
  const { messages } = useI18n();
  return function t(key: string, vars?: Record<string, string | number>): string {
    if (namespace) {
      const nsValue = getPath(messages, `${namespace}.${key}`);
      if (typeof nsValue === 'string') {
        return interpolate(nsValue, vars);
      }
    }
    const fullValue = getPath(messages, key);
    if (typeof fullValue === 'string') {
      return interpolate(fullValue, vars);
    }
    return key;
  };
}

// Re-export makeT for convenience
export { makeT };

/**
 * Resolve a dotted path against the messages object. Returns `undefined`
 * when any segment is missing (so callers can fall back gracefully).
 */
export function resolveMessage(messages: any, path: string): string | undefined {
  const v = getPath(messages, path);
  return typeof v === 'string' ? v : undefined;
}

/**
 * Returns the human label for an enum value (emotion / dreamType) at the
 * given i18n path. Falls back to the raw key when no translation exists,
 * so unknown values still render something readable.
 *
 *   useTag('tags.emotion', 'surreal')          → "超现实" (zh-CN) / "surreal" (en)
 *   useTag('tags.dreamType', 'recurring-place')→ "recurring place" (en) / "反复出现的地点" (zh-CN)
 */
export function useTag() {
  const { messages, locale } = useI18n();
  return function tag(kind: 'emotion' | 'dreamType', key: string): string {
    const ns = kind === 'emotion' ? 'tags.emotion' : 'tags.dreamType';
    const translated = resolveMessage(messages, `${ns}.${key}`);
    if (translated) return translated;
    // English fallback: humanize the kebab-case (recurring-place → recurring place)
    if (locale === 'en') return key.replace(/-/g, ' ');
    // Other locale fallback: try the English copy of the same key before
    // giving up, so an untranslated enum value still renders in English
    // rather than as `surreal`.
    return key.replace(/-/g, ' ');
  };
}

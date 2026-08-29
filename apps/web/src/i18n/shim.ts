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

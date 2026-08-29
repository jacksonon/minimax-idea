// Server-side locale helpers. We deliberately do NOT call cookies() or
// headers() here, because that would force every page into dynamic
// rendering mode, which conflicts with Cloudflare Pages static export.
//
// Instead the server renders the default locale at build time. The
// client-side I18nProvider then reads the cookie in useEffect and
// switches to the right locale (one reload if needed).

import { defaultLocale as DEFAULT, type Locale } from './config';
import { loadMessages } from './I18nProvider';

export function getServerI18n(): { locale: Locale; messages: any } {
  return { locale: DEFAULT, messages: loadMessages(DEFAULT) };
}

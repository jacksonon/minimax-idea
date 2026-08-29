import type { Metadata } from 'next';
import { ModeBadge } from '@/components/ModeBadge';
import { LocaleSetter } from '@/components/LocaleSetter';
import { ThemeToggle } from '@/components/ThemeToggle';
import { I18nProvider } from '@/i18n/I18nProvider';
import { defaultLocale } from '@/i18n/config';
import enMessages from '../../messages/en.json';
import './globals.css';

export const metadata: Metadata = {
  title: 'DreamReel — Tell me your dream. I’ll shoot it for you.',
  description: 'A 30-second AI film of your dream, made from a 60-second voice description.',
};

const themeScript = [
  '(function(){try{',
  'var s=localStorage.getItem("dreamreel-theme");',
  'var d=window.matchMedia("(prefers-color-scheme: dark)").matches;',
  'var k=s? s==="dark": d;',
  'if(k)document.documentElement.classList.add("dark");',
  '}catch(e){}})();',
].join('');

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server prerender uses the default locale (English). The client-side
  // I18nProvider reads the cookie in useEffect and switches to the user's
  // chosen locale (one reload if needed).
  return (
    <html lang={defaultLocale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500&family=IBM+Plex+Serif:wght@300;400;500&family=JetBrains+Mono:wght@400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-bg text-ink grain">
        <I18nProvider initialLocale={defaultLocale} initialMessages={enMessages}>
          <ModeBadge />
          <ThemeToggle />
          <LocaleSetter />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}

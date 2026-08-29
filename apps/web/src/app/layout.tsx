import type { Metadata } from 'next';
import { ModeBadge } from '@/components/ModeBadge';
import { ThemeToggle } from '@/components/ThemeToggle';
import './globals.css';

export const metadata: Metadata = {
  title: 'DreamReel — Tell me your dream. I\u2019ll shoot it for you.',
  description: 'A 30-second AI film of your dream, made from a 60-second voice description.',
};

/**
 * Inline script that runs before paint to set the dark class based on:
 *   1. localStorage theme preference (if user clicked the toggle)
 *   2. system preference (prefers-color-scheme: dark)
 * This avoids the "flash of wrong theme" you get with client-only solutions.
 */
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
  return (
    <html lang="en" suppressHydrationWarning>
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
        <ModeBadge />
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}

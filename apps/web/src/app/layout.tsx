import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DreamReel — Tell me your dream. I\u2019ll shoot it for you.',
  description: 'A 30-second AI film of your dream, made from a 60-second voice description.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500&family=IBM+Plex+Serif:wght@300;400;500&family=JetBrains+Mono:wght@400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-bg text-ink grain">
        {children}
      </body>
    </html>
  );
}

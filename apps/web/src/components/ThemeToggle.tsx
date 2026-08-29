'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

/**
 * Small icon button in the top-left corner. Lets the user override the
 * system preference. The choice is persisted in localStorage; the inline
 * script in layout.tsx reads it on the next page load.
 */
export function ThemeToggle() {
  // Default to dark for SSR; real value populates after mount.
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('dreamreel-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('dreamreel-theme', 'light');
    }
  }

  return (
    <button
      onClick={toggle}
      className="fixed top-4 left-4 z-50 flex items-center justify-center h-9 w-9 rounded-full border border-ink/20 bg-bg/80 backdrop-blur text-ink/80 hover:text-amber hover:border-amber/40 transition"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun className="h-4 w-4" strokeWidth={1.5} /> : <Moon className="h-4 w-4" strokeWidth={1.5} />}
    </button>
  );
}

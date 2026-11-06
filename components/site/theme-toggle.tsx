'use client';

import { Moon, Sun } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { isDarkTheme, setDarkTheme, subscribeToTheme } from '@/lib/theme';

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribeToTheme, isDarkTheme, () => false);

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label="Dark mode"
      aria-pressed={dark}
      onClick={() => setDarkTheme(!dark)}
    >
      <Moon className="theme-icon-moon" size={16} aria-hidden="true" />
      <Sun className="theme-icon-sun" size={16} aria-hidden="true" />
    </button>
  );
}

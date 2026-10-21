import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DIRECTION_STORAGE_KEY, THEME_STORAGE_KEY } from '../config/site';

export type Direction = 'rtl' | 'ltr';

type PreferencesContextValue = {
  isDark: boolean;
  direction: Direction;
  toggleTheme: () => void;
  toggleDirection: () => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function readPreference<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const stored = window.localStorage.getItem(key);
    return allowed.find((value) => value === stored) ?? fallback;
  } catch {
    return fallback;
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    readPreference(THEME_STORAGE_KEY, ['light', 'dark'] as const, 'light'),
  );
  const [direction, setDirection] = useState<Direction>(() =>
    readPreference(DIRECTION_STORAGE_KEY, ['rtl', 'ltr'] as const, 'rtl'),
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.dataset.theme = theme;
    const themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeColorMeta) themeColorMeta.content = theme === 'dark' ? '#101827' : '#f5f7fb';
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // The preference still applies for this visit if storage is unavailable.
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.dir = direction;
    document.documentElement.lang = 'ar';
    try {
      window.localStorage.setItem(DIRECTION_STORAGE_KEY, direction);
    } catch {
      // The preference still applies for this visit if storage is unavailable.
    }
  }, [direction]);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      isDark: theme === 'dark',
      direction,
      toggleTheme: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
      toggleDirection: () => setDirection((current) => (current === 'rtl' ? 'ltr' : 'rtl')),
    }),
    [direction, theme],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within PreferencesProvider');
  }
  return context;
}

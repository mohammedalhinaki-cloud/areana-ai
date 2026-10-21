import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CATEGORIES } from '../config/tools';
import { NAV_EXPANDED_STORAGE_KEY } from '../config/site';

type NavigationContextValue = {
  expandedIds: string[];
  toggleCategory: (categoryId: string) => void;
  openCategory: (categoryId: string) => void;
};

const NavigationContext = createContext<NavigationContextValue | null>(null);
const categoryIds = new Set(CATEGORIES.map((category) => category.id));

function readExpandedCategories(): string[] {
  try {
    const saved = window.localStorage.getItem(NAV_EXPANDED_STORAGE_KEY);
    if (!saved) return [];
    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string' && categoryIds.has(id));
  } catch {
    return [];
  }
}

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [expandedIds, setExpandedIds] = useState<string[]>(readExpandedCategories);

  const toggleCategory = useCallback((categoryId: string) => {
    setExpandedIds((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId],
    );
  }, []);

  const openCategory = useCallback((categoryId: string) => {
    setExpandedIds((current) => (current.includes(categoryId) ? current : [...current, categoryId]));
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(NAV_EXPANDED_STORAGE_KEY, JSON.stringify(expandedIds));
    } catch {
      // Navigation remains usable for this visit if storage is unavailable.
    }
  }, [expandedIds]);

  const value = useMemo(
    () => ({ expandedIds, toggleCategory, openCategory }),
    [expandedIds, openCategory, toggleCategory],
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigationExpansion(): NavigationContextValue {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigationExpansion must be used within NavigationProvider');
  }
  return context;
}

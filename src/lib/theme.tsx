'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';

export type AppTheme = 'sapphire' | 'emerald' | 'midnight' | 'royal';

interface ThemeContextType {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'sapphire',
  setTheme: () => {},
});

export const THEMES: { id: AppTheme; name: string; icon: string; color: string; desc: string }[] = [
  {
    id: 'sapphire',
    name: 'Executive Sapphire',
    icon: '💎',
    color: '#0284c7',
    desc: 'Deep Navy, Crisp Frost Glass & Vibrant Sapphire',
  },
  {
    id: 'emerald',
    name: 'Medical Emerald',
    icon: '🌿',
    color: '#059669',
    desc: 'Clean Clinical Mint, Deep Forest & Slate',
  },
  {
    id: 'royal',
    name: 'Balamban Royal',
    icon: '🏛️',
    color: '#2563eb',
    desc: 'Official Cebu Provincial Royal Blue & Gold Accents',
  },
  {
    id: 'midnight',
    name: 'Midnight AMOLED',
    icon: '🌙',
    color: '#38bdf8',
    desc: 'Sleek Dark Mode with Neon Accents for Night Shifts',
  },
];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>('sapphire');

  useEffect(() => {
    const saved = localStorage.getItem('cph_tm_theme') as AppTheme;
    if (saved && THEMES.some(t => t.id === saved)) {
      setThemeState(saved);
      document.documentElement.setAttribute('data-theme', saved);
    } else {
      document.documentElement.setAttribute('data-theme', 'sapphire');
    }
  }, []);

  function setTheme(newTheme: AppTheme) {
    setThemeState(newTheme);
    localStorage.setItem('cph_tm_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

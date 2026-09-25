import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemePreset = 'saas-dark' | 'saas-light';

interface ThemeContextType {
  theme: 'dark' | 'light';
  themePreset: ThemePreset;
  setThemePreset: (preset: ThemePreset) => void;
  toggleTheme: (theme: 'dark' | 'light') => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const presetColors: Record<ThemePreset, { isDark: boolean; properties: Record<string, string> }> = {
  'saas-dark': {
    isDark: true,
    properties: {
      '--color-dark-bg': '#062A95',
      '--color-dark-surface': '#041a5c',
      '--color-dark-border': '#08288a',
      '--color-dark-text': '#f1f5f9',
      '--color-dark-muted': '#CBD5E1',
      '--color-brand-primary': '#22D3EE',
      '--color-brand-highlight': '#00FFD5',
      '--background-brand-gradient-dark': 'linear-gradient(to right, #062A95, #22D3EE)',
    }
  },
  'saas-light': {
    isDark: false,
    properties: {
      '--color-light-bg': '#86B7FE',
      '--color-light-surface': '#FFFFFF',
      '--color-light-border': '#6EA8FE',
      '--color-light-text': '#031343',
      '--color-light-muted': '#1E3A8A',
      '--color-brand-primary-light': '#062A95',
      '--color-brand-primary': '#062A95',
      '--color-brand-highlight': '#22D3EE',
      '--shadow-neutral-diffuse': '0 10px 40px rgba(3, 19, 67, 0.18)',
      '--background-brand-gradient-light': 'linear-gradient(to right, #062A95, #22D3EE)',
    }
  }
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themePreset, setThemePresetState] = useState<ThemePreset>(() => {
    const stored = localStorage.getItem('apex-theme-preset') as ThemePreset;
    if (stored && presetColors[stored]) {
      return stored;
    }
    const legacy = localStorage.getItem('apex-theme');
    if (legacy === 'light') return 'saas-light';
    return 'saas-dark';
  });

  const activeConfig = presetColors[themePreset] || presetColors['saas-dark'];
  const theme: 'dark' | 'light' = activeConfig.isDark ? 'dark' : 'light';

  useEffect(() => {
    localStorage.setItem('apex-theme-preset', themePreset);
    localStorage.setItem('apex-theme', theme);

    // Apply specific dark mode flag to root for nested @apply selectors
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Dynamic injection of theme preset specific HEX values as custom CSS properties
    Object.entries(activeConfig.properties).forEach(([key, val]) => {
      root.style.setProperty(key, val as string);
    });

  }, [themePreset, theme]);

  const setThemePreset = (preset: ThemePreset) => {
    if (presetColors[preset]) {
      setThemePresetState(preset);
    }
  };

  const toggleTheme = (newTheme: 'dark' | 'light') => {
    if (newTheme === 'dark') {
      setThemePreset('saas-dark');
    } else {
      setThemePreset('saas-light');
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, themePreset, setThemePreset, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

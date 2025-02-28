import { GlobalSettings } from '@/main/settings';
import { State } from '@/renderer/store';
import { changeTheme, setSettings } from '@/renderer/store/settingsSlice';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

type Theme = 'dark' | 'light';

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme: Theme;
  storageKey: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme | string) => void;
};

const initialState: ThemeProviderState = {
  theme: 'light',
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);
export function ThemeProvider({
  children,
  defaultTheme = 'light',
  storageKey = 'theme',
  ...props
}: ThemeProviderProps) {
  const dispatch = useDispatch();
  const settings = useSelector<State, GlobalSettings>(
    (state) => state.settings.settings,
  );
  const theme = settings?.theme?.mode ?? 'light';

  const [setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme,
  );

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light';

      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  const value = {
    theme: theme,
    setTheme: (theme: Theme) => {
      window.electron.setting.set('theme.mode', theme);
      localStorage.setItem('theme', theme);
      const settings = window.electron.setting.getSettings();
      dispatch(setSettings(settings));
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error('useTheme必须在ThemeProvider中使用');

  return context;
};

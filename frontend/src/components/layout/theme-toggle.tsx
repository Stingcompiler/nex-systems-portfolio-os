'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useTheme, type Theme } from '@/contexts/ThemeContext';

const CYCLE: Record<Theme, Theme> = { light: 'dark', dark: 'system', system: 'light' };
const ICONS: Record<Theme, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };
const LABEL_KEYS: Record<Theme, string> = {
  light: 'themeLight',
  dark: 'themeDark',
  system: 'themeSystem',
};

export function ThemeToggle() {
  const t = useTranslations('common');
  const { theme, setTheme } = useTheme();

  const Icon = ICONS[theme];

  return (
    <button
      type="button"
      aria-label={t(LABEL_KEYS[theme])}
      title={t(LABEL_KEYS[theme])}
      onClick={() => setTheme(CYCLE[theme])}
      className="flex size-9 items-center justify-center rounded-full text-muted transition-colors duration-fast hover:bg-surface-hover hover:text-foreground"
    >
      <Icon className="size-[1.1rem]" aria-hidden="true" />
    </button>
  );
}

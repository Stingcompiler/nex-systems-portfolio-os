'use client';

import { createContext, useContext, type ReactNode } from 'react';

import type { SiteSettings } from '@/lib/api/types';

/**
 * إعدادات الموقع تُجلب مرة واحدة في تخطيط الخادم وتُمرَّر للأسفل،
 * فلا يعيد أي مكوّن عميل جلبها.
 */
const SettingsContext = createContext<SiteSettings | null>(null);

export function SettingsProvider({
  settings,
  children,
}: {
  settings: SiteSettings | null;
  children: ReactNode;
}) {
  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}

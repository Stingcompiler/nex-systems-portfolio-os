import type { Metadata } from 'next';
import { Cairo, Inter, JetBrains_Mono } from 'next/font/google';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import type { CSSProperties, ReactNode } from 'react';

import '@/app/globals.css';

import { ServiceWorkerRegister } from '@/components/layout/sw-register';
import { ThemeScript } from '@/components/layout/theme-script';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { ThemeProvider, type Theme } from '@/contexts/ThemeContext';
import { getSeoSettings, getSiteSettings } from '@/lib/api/queries';
import { getDirection, isLocale, locales, type Locale } from '@/lib/i18n/routing';
import { buildMetadata } from '@/lib/seo/metadata';

// الخطوط تُستضاف ذاتيًا: Next.js ينزّلها وقت البناء ويقدّمها من نطاقنا،
// فلا يوجد أي طلب خارجي وقت التشغيل.
// العربية: Cairo — خط عصري واضح مصمم للعربية.
const arabic = Cairo({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-arabic',
  display: 'swap',
});

const latin = Inter({
  subsets: ['latin'],
  variable: '--font-latin',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const [settings, seoSettings] = await Promise.all([
    getSiteSettings(locale),
    getSeoSettings(locale),
  ]);

  const base = buildMetadata({
    locale,
    path: '/',
    title: seoSettings?.default_seo_title || settings?.site_name || 'NEXA SYSTEMS',
    description: seoSettings?.default_seo_description || settings?.tagline,
    settings,
    seoSettings,
  });

  return {
    ...base,
    applicationName: 'NEXA SYSTEMS',
    appleWebApp: { capable: true, statusBarStyle: 'default', title: 'NEXA SYSTEMS' },
    icons: {
      icon: '/icons/icon-192.png',
      apple: '/icons/apple-icon-180.png',
    },
  };
}

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#020617' },
  ],
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  // يتيح التوليد الثابت للصفحات داخل هذا التخطيط
  setRequestLocale(locale);

  const [messages, settings] = await Promise.all([
    getMessages(),
    getSiteSettings(locale as Locale),
  ]);

  const fontVariable =
    locale === 'ar' ? 'var(--font-arabic)' : 'var(--font-latin)';

  return (
    <html
      lang={locale}
      dir={getDirection(locale)}
      suppressHydrationWarning
      className={`${arabic.variable} ${latin.variable} ${mono.variable}`}
      style={{ '--font-sans': fontVariable } as CSSProperties}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-dvh">
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider defaultTheme={(settings?.default_theme as Theme) || 'system'}>
            <SettingsProvider settings={settings}>{children}</SettingsProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import { Cairo, IBM_Plex_Mono, IBM_Plex_Sans_Arabic } from 'next/font/google';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';

import '@/app/globals.css';

import { ServiceWorkerRegister } from '@/components/layout/sw-register';
import { ThemeScript } from '@/components/layout/theme-script';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { ThemeProvider, type Theme } from '@/contexts/ThemeContext';
import { getSeoSettings, getSiteSettings } from '@/lib/api/queries';
import { getDirection, isLocale, locales, type Locale } from '@/lib/i18n/routing';
import { buildMetadata } from '@/lib/seo/metadata';

// الخطوط تُستضاف ذاتيًا: Next.js ينزّلها وقت البناء ويقدّمها من نطاقنا،
// فلا يوجد أي طلب خارجي وقت التشغيل. `font-display: swap` وارتداد
// next/font المضبوط المقاسات يمنعان قفز التخطيط.
//
// ثلاث عائلات مقصودة، تخدم اللغتين معًا (كلها تحمل محارف لاتينية وعربية):
//   • Cairo — للعناوين وحدها (600/700).
//   • IBM Plex Sans Arabic — للنصوص والواجهة (400–700).
//   • IBM Plex Mono — للأرقام والمعرّفات والشيفرة (400/500).
//
// بلا preload: الـCSS مضمّن في الصفحة (inlineCss)، فالمتصفح يكتشف
// @font-face فورًا ويجلب الأوجه المستخدمة فقط.
const heading = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['600', '700'],
  variable: '--font-heading',
  display: 'swap',
  preload: false,
});

const sans = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
  preload: false,
});

// الخط البرمجي يخدم الأرقام والمعرّفات ومقاطع الشيفرة داخل النص.
const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
  preload: false,
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
    title: seoSettings?.default_seo_title || settings?.site_name || 'StingSystems',
    description: seoSettings?.default_seo_description || settings?.tagline,
    settings,
    seoSettings,
  });

  return {
    ...base,
    applicationName: 'StingSystems',
    appleWebApp: { capable: true, statusBarStyle: 'default', title: 'StingSystems' },
    icons: {
      icon: '/icons/icon-192.png',
      apple: '/icons/apple-icon-180.png',
    },
  };
}

export const viewport = {
  themeColor: [
    // يطابق --background في globals.css — شريط المتصفح يمتدّ من الصفحة
    { media: '(prefers-color-scheme: light)', color: '#f7f8f5' },
    { media: '(prefers-color-scheme: dark)', color: '#0b120e' },
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

  return (
    <html
      lang={locale}
      dir={getDirection(locale)}
      suppressHydrationWarning
      className={`${heading.variable} ${sans.variable} ${mono.variable}`}
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

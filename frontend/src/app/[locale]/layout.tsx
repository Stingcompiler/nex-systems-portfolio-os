import type { Metadata } from 'next';
import { Alexandria, IBM_Plex_Sans, IBM_Plex_Sans_Arabic, Montserrat } from 'next/font/google';
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
import { SITE_NAME_FALLBACK } from '@/lib/constants/site';

// الخطوط تُستضاف ذاتيًا: Next.js ينزّلها وقت البناء ويقدّمها من نطاقنا،
// فلا يوجد أي طلب خارجي وقت التشغيل. `font-display: swap` وارتداد
// next/font المضبوط المقاسات يمنعان قفز التخطيط.
//
// D-0011 + D-0012: النص والأزرار والتنقل والنماذج والأرقام بعائلة Plex
// (IBM Plex Sans Arabic / IBM Plex Sans، 400/500/600)، وعناوين الموقع h1–h4
// بخط عرض (Alexandria للعربية / Montserrat للإنجليزية، 600/700). اللوحة
// تبقى على Plex وحده. الأرقام (.num) بـ Plex جدولي حتى داخل العناوين.
//
// بلا preload: الـCSS مضمّن في الصفحة (inlineCss)، فالمتصفح يكتشف
// @font-face فورًا ويجلب الأوجه المستخدمة فقط.
const arabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  // بلا 700: الوزن العريض للعناوين وحدها، وهي بخط العرض
  weight: ['400', '500', '600'],
  variable: '--font-arabic',
  display: 'swap',
  preload: false,
});

const latin = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-latin',
  display: 'swap',
  preload: false,
});

// خط العرض: يحمل اللاتينية أيضًا فكلمة إنجليزية داخل عنوان عربي (اسم منتج)
// تبقى بالعائلة نفسها بدل الارتداد إلى خط النظام
const displayArabic = Alexandria({
  subsets: ['arabic', 'latin'],
  weight: ['600', '700'],
  variable: '--font-display-ar',
  display: 'swap',
  preload: false,
});

const displayLatin = Montserrat({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-display-en',
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
    title: seoSettings?.default_seo_title || settings?.site_name || SITE_NAME_FALLBACK,
    description: seoSettings?.default_seo_description || settings?.tagline,
    settings,
    seoSettings,
  });

  return {
    ...base,
    applicationName: SITE_NAME_FALLBACK,
    appleWebApp: { capable: true, statusBarStyle: 'default', title: SITE_NAME_FALLBACK },
    icons: {
      // SVG حاد بأي مقاس؛ PNG للمتصفحات التي لا تقبله.
      // ‎?v=2: شعار «السين البيانية» — Google يحفظ الأيقونة بعنوانها، فالعنوان
      // الجديد يجعله يجلبها من جديد بدل الشعار الأزرق القديم. يُرفع الرقم مع كل تغيير للشعار
      icon: [
        { url: '/brand/stingsystem-mark.svg?v=2', type: 'image/svg+xml' },
        { url: '/icons/favicon-48.png?v=2', sizes: '48x48', type: 'image/png' },
        { url: '/icons/icon-192.png?v=2', sizes: '192x192', type: 'image/png' },
      ],
      apple: '/icons/apple-icon-180.png?v=2',
    },
  };
}

export const viewport = {
  themeColor: [
    // يطابق --background في globals.css — شريط المتصفح يمتدّ من الصفحة
    { media: '(prefers-color-scheme: light)', color: '#f6f8fb' },
    { media: '(prefers-color-scheme: dark)', color: '#0c141f' },
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

  // الخطوط تتبدّل حسب اللغة: النص Plex Arabic/Plex Sans، والعناوين
  // Alexandria/Montserrat (D-0012)
  const fontVariable =
    locale === 'ar' ? 'var(--font-arabic)' : 'var(--font-latin)';
  const displayVariable =
    locale === 'ar' ? 'var(--font-display-ar)' : 'var(--font-display-en)';

  return (
    <html
      lang={locale}
      dir={getDirection(locale)}
      suppressHydrationWarning
      className={`${arabic.variable} ${latin.variable} ${displayArabic.variable} ${displayLatin.variable}`}
      style={
        { '--font-ui': fontVariable, '--font-display': displayVariable } as CSSProperties
      }
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

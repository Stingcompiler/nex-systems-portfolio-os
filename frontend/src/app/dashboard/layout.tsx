import type { Metadata } from 'next';
import { IBM_Plex_Mono, Tajawal } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import type { CSSProperties, ReactNode } from 'react';

import '@/app/globals.css';

import { ServiceWorkerRegister } from '@/components/layout/sw-register';
import { ThemeScript } from '@/components/layout/theme-script';
import { AuthProvider } from '@/contexts/AuthContext';
import { QueryProvider } from '@/contexts/QueryProvider';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import dashboardMessages from '@/messages/ar.json';

/**
 * تخطيط جذر ثانٍ.
 *
 * الموقع العام يعيش تحت `[locale]` بلغتين، ولوحة التحكم عربية فقط —
 * فلكلٍّ عنصر <html> باتجاهه ولغته. لا يوجد `app/layout.tsx` مشترك،
 * فيصبح كل فرع جذرًا مستقلًا.
 */
// نظام Vezano: Tajawal للجسم والعناوين (اللوحة عربية فقط)، وIBM Plex Mono
// للأرقام والمعرّفات.
const arabic = Tajawal({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '700', '800'],
  variable: '--font-arabic',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    template: '%s — لوحة التحكم',
    default: 'لوحة التحكم',
  },
  // لوحة التحكم لا تُفهرس بأي حال
  robots: { index: false, follow: false },
  // اللوحة خارج تخطيط الموقع فلا ترث أيقوناته؛ بدونها طلب المتصفح
  // /favicon.ico وظهر التبويب بأيقونة مفقودة
  icons: {
    icon: [
      { url: '/brand/stingsystem-mark.svg', type: 'image/svg+xml' },
      { url: '/icons/favicon-48.png', sizes: '48x48', type: 'image/png' },
    ],
    apple: '/icons/apple-icon-180.png',
  },
  // تطبيق مستقل يفتح على اللوحة: على iPhone لا تصل إشعارات الويب إلا من
  // تطبيق مثبّت على الشاشة الرئيسية
  manifest: '/dashboard.webmanifest',
  appleWebApp: { capable: true, title: 'لوحة ستينج', statusBarStyle: 'default' },
};

export default function DashboardRootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="ar"
      dir="rtl"
      suppressHydrationWarning
      className={`${arabic.variable} ${mono.variable}`}
      style={
        { '--font-sans': 'var(--font-arabic)', '--font-heading': 'var(--font-arabic)' } as CSSProperties
      }
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-dvh bg-background text-foreground">
        <NextIntlClientProvider locale="ar" messages={dashboardMessages}>
          <ThemeProvider defaultTheme="system">
            <QueryProvider>
              <AuthProvider>
                <ToastProvider>{children}</ToastProvider>
              </AuthProvider>
            </QueryProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
        {/* قابلية التثبيت وإشعارات المتصفح تحتاجان Service Worker مسجّلًا —
            كان يُسجَّل من صفحات الموقع فقط، ومن يفتح اللوحة أولًا لا يجده */}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import { Cairo, JetBrains_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import type { CSSProperties, ReactNode } from 'react';

import '@/app/globals.css';

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
const arabic = Cairo({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-arabic',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
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
};

export default function DashboardRootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="ar"
      dir="rtl"
      suppressHydrationWarning
      className={`${arabic.variable} ${mono.variable}`}
      style={{ '--font-sans': 'var(--font-arabic)' } as CSSProperties}
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
      </body>
    </html>
  );
}

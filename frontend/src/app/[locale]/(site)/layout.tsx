import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';

import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header';
import { SiteProviders } from '@/components/layout/site-providers';
import { WhatsAppButton } from '@/components/layout/whatsapp-button';
import { getSiteSettings } from '@/lib/api/queries';
import { isLocale, type Locale } from '@/lib/i18n/routing';

/**
 * الصفحات تُخزَّن بعد أول توليد بدل بنائها لكل طلب.
 *
 * البناء عند كل طلب كان يعيد تصيير الصفحة كاملة ويجلب عشرات النقاط من
 * Django في كل زيارة، فتجاوزت الحاوية حدّ 512MB مرتين وصار الردّ ثوانيَ.
 * التخزين يعيد الصفحة جاهزة فيبقى العمل مرة كل نافذة لا مرة كل زائر.
 *
 * أما بيانات لحظة البناء — وهي سبب اللجوء إلى البناء عند الطلب — فتُبطَل
 * صراحةً عند إقلاع الحاوية في start.sh، فلا تُقدَّم صفحة مخبوزة فارغة.
 */
export const revalidate = 300;

export default async function SiteLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const resolvedLocale = (isLocale(locale) ? locale : 'ar') as Locale;
  const [settings, t] = await Promise.all([
    getSiteSettings(resolvedLocale),
    getTranslations('common'),
  ]);

  return (
    <SiteProviders>
      <div className="flex min-h-dvh flex-col">
        {/* أول عنصر قابل للتركيز في الصفحة */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          {t('skipToContent')}
        </a>

        <Header settings={settings} />

        <main id="main" className="flex-1">
          {children}
        </main>

        <Footer settings={settings} />

        {settings?.whatsapp ? (
          <WhatsAppButton
            number={settings.whatsapp}
            message={settings.whatsapp_default_message}
            label={t('whatsapp')}
          />
        ) : null}
      </div>
    </SiteProviders>
  );
}

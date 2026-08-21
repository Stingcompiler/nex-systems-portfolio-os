import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ServiceListView } from '@/components/pages/service-views';
import { JsonLd } from '@/components/ui/misc';
import { getSeoSettings, getSiteSettings, getSolutions } from '@/lib/api/queries';
import type { Locale } from '@/lib/i18n/routing';
import { breadcrumbJsonLd } from '@/lib/seo/json-ld';
import { buildMetadata } from '@/lib/seo/metadata';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const [t, settings, seoSettings] = await Promise.all([
    getTranslations({ locale, namespace: 'solutions' }),
    getSiteSettings(locale as Locale),
    getSeoSettings(locale as Locale),
  ]);

  return buildMetadata({
    locale: locale as Locale,
    path: '/solutions',
    title: t('title'),
    description: t('description'),
    settings,
    seoSettings,
  });
}

export default async function SolutionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  setRequestLocale(rawLocale);
  const locale = rawLocale as Locale;

  const [t, tNav, solutions] = await Promise.all([
    getTranslations('solutions'),
    getTranslations('nav'),
    getSolutions(locale, { page_size: 50 }),
  ]);

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd(
          [
            { name: tNav('home'), path: '/' },
            { name: t('title'), path: '/solutions' },
          ],
          locale,
        )}
      />
      <ServiceListView
        items={solutions.results}
        kind="solutions"
        title={t('title')}
        description={t('description')}
      />
    </>
  );
}

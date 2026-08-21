import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ServiceDetailView } from '@/components/pages/service-views';
import { JsonLd } from '@/components/ui/misc';
import { findService, loadService, NOT_FOUND_METADATA } from '@/lib/api/detail';
import { getSeoSettings, getServiceSlugs, getSiteSettings } from '@/lib/api/queries';
import { locales, type Locale } from '@/lib/i18n/routing';
import { breadcrumbJsonLd, faqJsonLd, serviceJsonLd } from '@/lib/seo/json-ld';
import { buildMetadata } from '@/lib/seo/metadata';

export async function generateStaticParams() {
  const solutions = await getServiceSlugs('solutions');
  return locales.flatMap((locale) =>
    solutions.results.map((solution) => ({ locale, slug: solution.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const [solution, settings, seoSettings] = await Promise.all([
    findService('solutions', locale as Locale, slug),
    getSiteSettings(locale as Locale),
    getSeoSettings(locale as Locale),
  ]);

  if (!solution) return NOT_FOUND_METADATA;

  return buildMetadata({
    locale: locale as Locale,
    path: `/solutions/${slug}`,
    title: solution.seo.title || solution.title,
    description: solution.seo.description,
    image: solution.seo.image?.url ?? null,
    publishedTime: solution.published_at,
    settings,
    seoSettings,
  });
}

export default async function SolutionDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  setRequestLocale(rawLocale);
  const locale = rawLocale as Locale;

  const [solution, settings, tNav, t] = await Promise.all([
    loadService('solutions', locale, slug),
    getSiteSettings(locale),
    getTranslations('nav'),
    getTranslations('solutions'),
  ]);

  return (
    <>
      <JsonLd data={serviceJsonLd(solution, settings, locale, 'solutions')} />
      <JsonLd data={faqJsonLd(solution.faqs)} />
      <JsonLd
        data={breadcrumbJsonLd(
          [
            { name: tNav('home'), path: '/' },
            { name: t('title'), path: '/solutions' },
            { name: solution.title, path: `/solutions/${slug}` },
          ],
          locale,
        )}
      />
      <ServiceDetailView service={solution} kind="solutions" locale={locale} settings={settings} />
    </>
  );
}

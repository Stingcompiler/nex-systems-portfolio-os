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
  const services = await getServiceSlugs('services');
  return locales.flatMap((locale) =>
    services.results.map((service) => ({ locale, slug: service.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const [service, settings, seoSettings] = await Promise.all([
    findService('services', locale as Locale, slug),
    getSiteSettings(locale as Locale),
    getSeoSettings(locale as Locale),
  ]);

  if (!service) return NOT_FOUND_METADATA;

  return buildMetadata({
    locale: locale as Locale,
    path: `/services/${slug}`,
    title: service.seo.title || service.title,
    description: service.seo.description,
    image: service.seo.image?.url ?? null,
    publishedTime: service.published_at,
    settings,
    seoSettings,
  });
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  setRequestLocale(rawLocale);
  const locale = rawLocale as Locale;

  const [service, settings, tNav, t] = await Promise.all([
    loadService('services', locale, slug),
    getSiteSettings(locale),
    getTranslations('nav'),
    getTranslations('services'),
  ]);

  return (
    <>
      <JsonLd data={serviceJsonLd(service, settings, locale, 'services')} />
      <JsonLd data={faqJsonLd(service.faqs)} />
      <JsonLd
        data={breadcrumbJsonLd(
          [
            { name: tNav('home'), path: '/' },
            { name: t('title'), path: '/services' },
            { name: service.title, path: `/services/${slug}` },
          ],
          locale,
        )}
      />
      <ServiceDetailView service={service} kind="services" locale={locale} settings={settings} />
    </>
  );
}

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Container } from '@/components/ui/container';
import { Breadcrumbs } from '@/components/ui/misc';
import { EmptyState } from '@/components/ui/states';
import { getSeoSettings, getSiteSettings } from '@/lib/api/queries';
import type { Locale } from '@/lib/i18n/routing';
import { buildMetadata } from '@/lib/seo/metadata';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const [t, settings, seoSettings] = await Promise.all([
    getTranslations({ locale, namespace: 'legal' }),
    getSiteSettings(locale as Locale),
    getSeoSettings(locale as Locale),
  ]);

  return buildMetadata({
    locale: locale as Locale,
    path: '/privacy-policy',
    title: t('privacyTitle'),
    settings,
    seoSettings,
    // لا تُفهرس صفحة سياسة فارغة
    noIndex: true,
  });
}

export default async function PrivacyPolicyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, tNav] = await Promise.all([
    getTranslations('legal'),
    getTranslations('nav'),
  ]);

  return (
    <Container className="py-12 sm:py-16">
      <Breadcrumbs
        label={tNav('breadcrumbs')}
        items={[{ name: tNav('home'), href: '/' }, { name: t('privacyTitle') }]}
      />
      <h1 className="mb-8 text-h1 font-semibold">{t('privacyTitle')}</h1>
      <EmptyState title={t('privacyTitle')} body={t('pending')} />
    </Container>
  );
}

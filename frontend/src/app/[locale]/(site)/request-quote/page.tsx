import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Container } from '@/components/ui/container';
import { Breadcrumbs, JsonLd } from '@/components/ui/misc';
import { RequestForm } from '@/features/request/request-form';
import { getSeoSettings, getSiteSettings } from '@/lib/api/queries';
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
    getTranslations({ locale, namespace: 'requestForm' }),
    getSiteSettings(locale as Locale),
    getSeoSettings(locale as Locale),
  ]);

  return buildMetadata({
    locale: locale as Locale,
    path: '/request-quote',
    title: t('pageTitle'),
    description: t('pageDescription'),
    settings,
    seoSettings,
  });
}

export default async function RequestQuotePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  setRequestLocale(rawLocale);
  const locale = rawLocale as Locale;

  const [t, tNav, settings] = await Promise.all([
    getTranslations('requestForm'),
    getTranslations('nav'),
    getSiteSettings(locale),
  ]);

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd(
          [
            { name: tNav('home'), path: '/' },
            { name: t('pageTitle'), path: '/request-quote' },
          ],
          locale,
        )}
      />

      <Container className="py-12 sm:py-16">
        <Breadcrumbs items={[{ name: tNav('home'), href: '/' }, { name: t('pageTitle') }]} label={tNav('breadcrumbs')} />

        <header className="mb-8 max-w-prose">
          <h1 className="text-h1 font-semibold">{t('pageTitle')}</h1>
          <p className="mt-3 text-muted">{t('pageDescription')}</p>
        </header>

        <div className="max-w-2xl">
          <RequestForm
            whatsapp={settings?.whatsapp ?? ''}
            whatsappMessage={settings?.whatsapp_default_message ?? ''}
          />
        </div>
      </Container>
    </>
  );
}

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Container } from '@/components/ui/container';
import { Breadcrumbs, JsonLd } from '@/components/ui/misc';
import { RequestForm, type RequestServiceContext } from '@/features/request/request-form';
import { getService, getSeoSettings, getSiteSettings } from '@/lib/api/queries';
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

/** يجلب الخدمة المشار إليها في الرابط — رابط قديم أو خاطئ يعود نموذجًا عامًا. */
async function resolveService(
  locale: Locale,
  kind: string | undefined,
  slug: string | undefined,
): Promise<RequestServiceContext | null> {
  if (!slug || !/^[\w-]+$/.test(slug)) return null;
  try {
    const service = await getService(kind === 'solutions' ? 'solutions' : 'services', locale, slug);
    return { slug: service.slug, title: service.title };
  } catch {
    return null;
  }
}

export default async function RequestQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ service?: string; kind?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const query = await searchParams;
  setRequestLocale(rawLocale);
  const locale = rawLocale as Locale;

  const [t, tNav, settings, service] = await Promise.all([
    getTranslations('requestForm'),
    getTranslations('nav'),
    getSiteSettings(locale),
    resolveService(locale, query.kind, query.service),
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

        {/* النموذج والملخّص يأخذان عرض الحاوية: max-w-2xl كان يحشر عمودين
            في 672px ويترك نصف الشاشة فارغًا */}
        <RequestForm
          whatsapp={settings?.whatsapp ?? ''}
          whatsappMessage={settings?.whatsapp_default_message ?? ''}
          service={service}
        />
      </Container>
    </>
  );
}

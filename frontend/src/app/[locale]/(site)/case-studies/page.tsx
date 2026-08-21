import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { CaseStudyCard } from '@/components/content/cards';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { Breadcrumbs, JsonLd } from '@/components/ui/misc';
import { EmptyState } from '@/components/ui/states';
import { getCaseStudies, getSeoSettings, getSiteSettings } from '@/lib/api/queries';
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
    getTranslations({ locale, namespace: 'caseStudies' }),
    getSiteSettings(locale as Locale),
    getSeoSettings(locale as Locale),
  ]);

  return buildMetadata({
    locale: locale as Locale,
    path: '/case-studies',
    title: t('title'),
    description: t('description'),
    settings,
    seoSettings,
  });
}

export default async function CaseStudiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  setRequestLocale(rawLocale);
  const locale = rawLocale as Locale;

  const [t, tNav, tStates, caseStudies] = await Promise.all([
    getTranslations('caseStudies'),
    getTranslations('nav'),
    getTranslations('states'),
    getCaseStudies(locale, { page_size: 50 }),
  ]);

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd(
          [
            { name: tNav('home'), path: '/' },
            { name: t('title'), path: '/case-studies' },
          ],
          locale,
        )}
      />

      <Container className="py-12 sm:py-16">
        <Breadcrumbs items={[{ name: tNav('home'), href: '/' }, { name: t('title') }]} label={tNav('breadcrumbs')} />

        <header className="mb-10 max-w-prose">
          <h1 className="text-h1 font-semibold">{t('title')}</h1>
          <p className="mt-3 text-muted">{t('description')}</p>
        </header>

        {caseStudies.results.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {caseStudies.results.map((caseStudy) => (
              <CaseStudyCard key={caseStudy.id} caseStudy={caseStudy} />
            ))}
          </div>
        ) : (
          <EmptyState
            title={tStates('emptyCaseStudies')}
            body={tStates('emptyBody')}
            action={<ButtonLink href="/projects">{tNav('projects')}</ButtonLink>}
          />
        )}
      </Container>
    </>
  );
}

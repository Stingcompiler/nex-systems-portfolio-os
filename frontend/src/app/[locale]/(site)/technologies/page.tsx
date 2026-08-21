import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Container } from '@/components/ui/container';
import { Breadcrumbs, Card, JsonLd } from '@/components/ui/misc';
import { EmptyState } from '@/components/ui/states';
import { getSeoSettings, getSiteSettings, getTechnologies } from '@/lib/api/queries';
import type { Technology } from '@/lib/api/types';
import type { Locale } from '@/lib/i18n/routing';
import { breadcrumbJsonLd } from '@/lib/seo/json-ld';
import { buildMetadata } from '@/lib/seo/metadata';

const CATEGORY_ORDER = [
  'language',
  'frontend',
  'backend',
  'mobile',
  'desktop',
  'database',
  'tool',
] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const [t, settings, seoSettings] = await Promise.all([
    getTranslations({ locale, namespace: 'technologies' }),
    getSiteSettings(locale as Locale),
    getSeoSettings(locale as Locale),
  ]);

  return buildMetadata({
    locale: locale as Locale,
    path: '/technologies',
    title: t('title'),
    description: t('description'),
    settings,
    seoSettings,
  });
}

export default async function TechnologiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  setRequestLocale(rawLocale);
  const locale = rawLocale as Locale;

  const [t, tNav, tStates, technologies] = await Promise.all([
    getTranslations('technologies'),
    getTranslations('nav'),
    getTranslations('states'),
    getTechnologies(locale),
  ]);

  const grouped = new Map<string, Technology[]>();
  for (const technology of technologies.results) {
    const bucket = grouped.get(technology.category) ?? [];
    bucket.push(technology);
    grouped.set(technology.category, bucket);
  }

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd(
          [
            { name: tNav('home'), path: '/' },
            { name: t('title'), path: '/technologies' },
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

        {technologies.results.length ? (
          <div className="space-y-10">
            {CATEGORY_ORDER.filter((category) => grouped.has(category)).map((category) => (
              <section key={category}>
                <h2 className="mb-4 text-h3 font-semibold">
                  {t(`category.${category}`)}
                </h2>
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {grouped.get(category)!.map((technology) => (
                    <li key={technology.id}>
                      <Card className="h-full">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="font-semibold">{technology.name}</h3>
                          <span
                            className="text-xs text-muted"
                            aria-label={`${technology.proficiency}/5`}
                          >
                            <span dir="ltr">{technology.proficiency}/5</span>
                          </span>
                        </div>
                        {technology.description ? (
                          <p className="mt-2 text-sm text-muted">
                            {technology.description}
                          </p>
                        ) : null}
                      </Card>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <EmptyState title={tStates('emptyTechnologies')} body={tStates('emptyBody')} />
        )}
      </Container>
    </>
  );
}

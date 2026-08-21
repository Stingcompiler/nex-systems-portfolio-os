import { Download, ExternalLink } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { CoverImage } from '@/components/content/media';
import { ExternalButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { Breadcrumbs, Card, JsonLd, Prose } from '@/components/ui/misc';
import { EmptyState } from '@/components/ui/states';
import {
  getCertifications,
  getEducation,
  getExperiences,
  getSeoSettings,
  getSiteSettings,
  getTechnologies,
} from '@/lib/api/queries';
import type { Locale } from '@/lib/i18n/routing';
import { breadcrumbJsonLd, organizationJsonLd, personJsonLd } from '@/lib/seo/json-ld';
import { buildMetadata } from '@/lib/seo/metadata';
import { formatMonthYear } from '@/lib/utils/format';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const [t, settings, seoSettings] = await Promise.all([
    getTranslations({ locale, namespace: 'about' }),
    getSiteSettings(locale as Locale),
    getSeoSettings(locale as Locale),
  ]);

  return buildMetadata({
    locale: locale as Locale,
    path: '/about',
    title: settings?.site_name ? `${t('title')} — ${settings.site_name}` : t('title'),
    description: settings?.tagline || t('description'),
    image: settings?.logo_light?.url ?? settings?.owner_photo?.url ?? null,
    settings,
    seoSettings,
  });
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  setRequestLocale(rawLocale);
  const locale = rawLocale as Locale;

  const [t, tNav, tCommon, tStates, settings, experiences, education, certifications, technologies] =
    await Promise.all([
      getTranslations('about'),
      getTranslations('nav'),
      getTranslations('common'),
      getTranslations('states'),
      getSiteSettings(locale),
      getExperiences(locale),
      getEducation(locale),
      getCertifications(locale),
      getTechnologies(locale),
    ]);

  const cv = locale === 'ar' ? settings?.cv_ar : settings?.cv_en;
  const isEmpty =
    !settings?.owner_bio &&
    !experiences.results.length &&
    !education.results.length &&
    !certifications.results.length;

  return (
    <>
      <JsonLd data={organizationJsonLd(settings, locale)} />
      <JsonLd
        data={personJsonLd(
          settings,
          locale,
          technologies.results.map((technology) => technology.name),
        )}
      />
      <JsonLd
        data={breadcrumbJsonLd(
          [
            { name: tNav('home'), path: '/' },
            { name: t('title'), path: '/about' },
          ],
          locale,
        )}
      />

      <Container className="py-12 sm:py-16">
        <Breadcrumbs items={[{ name: tNav('home'), href: '/' }, { name: t('title') }]} label={tNav('breadcrumbs')} />

        {/* Company intro */}
        <div className="mb-16">
          <h1 className="text-h1 font-semibold">
            {settings?.site_name || t('title')}
          </h1>
          {settings?.tagline ? (
            <p className="mt-2 text-lg text-primary">{settings.tagline}</p>
          ) : null}
          {settings?.owner_bio ? (
            <div className="mt-6">
              <Prose text={settings.owner_bio} />
            </div>
          ) : null}
        </div>

        {/* Founder / Developer card */}
        {settings?.owner_name ? (
          <section className="mb-16">
            <h2 className="mb-6 text-h2 font-semibold">{t('founder')}</h2>
            <div className="grid gap-10 lg:grid-cols-[2fr_1fr]">
              <div>
                <h3 className="text-h3 font-semibold">{settings.owner_name}</h3>
                {settings.owner_title ? (
                  <p className="mt-2 text-lg text-primary">{settings.owner_title}</p>
                ) : null}

                {cv?.url ? (
                  <ExternalButtonLink href={cv.url} className="mt-6" variant="secondary">
                    <Download className="size-4" aria-hidden="true" />
                    {tCommon('downloadCv')}
                  </ExternalButtonLink>
                ) : null}
              </div>

              <div className="lg:order-first lg:col-start-2 lg:row-start-1">
                <CoverImage
                  media={settings.owner_photo}
                  alt={settings.owner_name}
                  ratio="aspect-square"
                  sizes="(max-width: 1024px) 100vw, 33vw"
                  className="rounded-xl"
                />
              </div>
            </div>
          </section>
        ) : null}

        {isEmpty ? (
          <div className="mt-12">
            <EmptyState title={tStates('emptyTitle')} body={tStates('emptyBody')} />
          </div>
        ) : null}

        {experiences.results.length ? (
          <section className="mt-16">
            <h2 className="mb-6 text-h2 font-semibold">{t('experience')}</h2>
            <ol className="space-y-4">
              {experiences.results.map((experience) => (
                <li key={experience.id}>
                  <Card>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-h3 font-semibold">{experience.title}</h3>
                      <span className="text-sm text-muted">
                        {formatMonthYear(experience.start_date, locale)}
                        {' — '}
                        {experience.is_current
                          ? t('current')
                          : formatMonthYear(experience.end_date, locale)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-primary">{experience.organization}</p>
                    {experience.description ? (
                      <p className="mt-3 text-sm text-muted">{experience.description}</p>
                    ) : null}
                  </Card>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {education.results.length ? (
          <section className="mt-12">
            <h2 className="mb-6 text-h2 font-semibold">{t('education')}</h2>
            <ol className="space-y-4">
              {education.results.map((item) => (
                <li key={item.id}>
                  <Card>
                    <h3 className="text-h3 font-semibold">{item.degree}</h3>
                    <p className="mt-1 text-sm text-primary">{item.institution}</p>
                    {item.field ? (
                      <p className="mt-1 text-sm text-muted">{item.field}</p>
                    ) : null}
                  </Card>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {certifications.results.length ? (
          <section className="mt-12">
            <h2 className="mb-6 text-h2 font-semibold">{t('certifications')}</h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {certifications.results.map((certification) => (
                <li key={certification.id}>
                  <Card className="h-full">
                    <h3 className="font-semibold">{certification.name}</h3>
                    <p className="mt-1 text-sm text-muted">{certification.issuer}</p>
                    {certification.credential_url ? (
                      <a
                        href={certification.credential_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        <ExternalLink className="size-4" aria-hidden="true" />
                        {t('credential')}
                      </a>
                    ) : null}
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </Container>
    </>
  );
}

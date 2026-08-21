import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ServiceCard, TestimonialCard } from '@/components/content/cards';
import { CoverImage } from '@/components/content/media';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { Breadcrumbs, Card, JsonLd, Prose } from '@/components/ui/misc';
import { Section, SectionHeader } from '@/components/ui/section';
import { findCaseStudy, loadCaseStudy, NOT_FOUND_METADATA } from '@/lib/api/detail';
import { getCaseStudies, getSeoSettings, getSiteSettings } from '@/lib/api/queries';
import type { CaseStudyDetail } from '@/lib/api/types';
import { locales, type Locale } from '@/lib/i18n/routing';
import { articleJsonLd, breadcrumbJsonLd } from '@/lib/seo/json-ld';
import { buildMetadata } from '@/lib/seo/metadata';

export async function generateStaticParams() {
  const caseStudies = await getCaseStudies('ar', { page_size: 100 });
  return locales.flatMap((locale) =>
    caseStudies.results.map((caseStudy) => ({ locale, slug: caseStudy.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const [caseStudy, settings, seoSettings] = await Promise.all([
    findCaseStudy(locale as Locale, slug),
    getSiteSettings(locale as Locale),
    getSeoSettings(locale as Locale),
  ]);

  if (!caseStudy) return NOT_FOUND_METADATA;

  return buildMetadata({
    locale: locale as Locale,
    path: `/case-studies/${slug}`,
    title: caseStudy.seo.title || caseStudy.title,
    description: caseStudy.seo.description,
    image: caseStudy.seo.image?.url ?? null,
    type: 'article',
    publishedTime: caseStudy.published_at,
    settings,
    seoSettings,
  });
}

export default async function CaseStudyDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  setRequestLocale(rawLocale);
  const locale = rawLocale as Locale;

  const [caseStudy, settings, t, tNav] = await Promise.all([
    loadCaseStudy(locale, slug),
    getSiteSettings(locale),
    getTranslations('caseStudies'),
    getTranslations('nav'),
  ]);

  // الأقسام النصية تُعرض بالترتيب، ويُتجاوز الفارغ منها تلقائيًا
  const narrative: { key: keyof CaseStudyDetail; label: string }[] = [
    { key: 'problem', label: t('problem') },
    { key: 'requirements', label: t('requirements') },
    { key: 'challenges', label: t('challenges') },
    { key: 'solution', label: t('solution') },
    { key: 'architecture', label: t('architecture') },
    { key: 'results', label: t('results') },
    { key: 'lessons', label: t('lessons') },
  ];

  return (
    <>
      <JsonLd data={articleJsonLd(caseStudy, settings, locale)} />
      <JsonLd
        data={breadcrumbJsonLd(
          [
            { name: tNav('home'), path: '/' },
            { name: t('title'), path: '/case-studies' },
            { name: caseStudy.title, path: `/case-studies/${slug}` },
          ],
          locale,
        )}
      />

      <Container className="py-12 sm:py-16">
        <Breadcrumbs
          label={tNav('breadcrumbs')}
          items={[
            { name: tNav('home'), href: '/' },
            { name: t('title'), href: '/case-studies' },
            { name: caseStudy.title },
          ]}
        />

        <header className="max-w-prose">
          <h1 className="text-h1 font-semibold">{caseStudy.title}</h1>
          {caseStudy.overview ? (
            <p className="mt-4 text-lg text-muted">{caseStudy.overview}</p>
          ) : null}
        </header>

        {caseStudy.project ? (
          <div className="mt-6">
            <ButtonLink
              href={`/projects/${caseStudy.project.slug}`}
              variant="secondary"
              size="sm"
            >
              {t('viewProject')}
            </ButtonLink>
          </div>
        ) : null}

        {caseStudy.metrics.length ? (
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {caseStudy.metrics.map((metric, index) => (
              <li key={index}>
                <Card className="text-center">
                  <p className="text-h2 font-bold">
                    <span className="text-gradient" dir="ltr">{metric.value}</span>
                    {metric.suffix ? (
                      <span className="text-h3 text-gradient">{metric.suffix}</span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-sm text-muted">{metric.label}</p>
                </Card>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-12 space-y-10">
          {narrative.map(({ key, label }) => {
            const value = caseStudy[key];
            if (typeof value !== 'string' || !value.trim()) return null;
            return (
              <section key={String(key)}>
                <h2 className="mb-4 text-h2 font-semibold">{label}</h2>
                <Prose text={value} />
              </section>
            );
          })}
        </div>

        {caseStudy.diagram_image ? (
          <figure className="mt-12">
            <h2 className="mb-4 text-h2 font-semibold">{t('architecture')}</h2>
            <CoverImage
              media={caseStudy.diagram_image}
              alt={caseStudy.title}
              ratio="aspect-[16/9]"
              sizes="100vw"
            />
          </figure>
        ) : null}

        {caseStudy.development_phases.length ? (
          <section className="mt-12">
            <h2 className="mb-6 text-h2 font-semibold">{t('phases')}</h2>
            <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {caseStudy.development_phases.map((phase, index) => (
                <li key={index}>
                  <Card className="h-full">
                    <span className="mb-2 inline-flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      <span dir="ltr">{index + 1}</span>
                    </span>
                    <h3 className="mb-1 font-semibold">{phase.title}</h3>
                    {phase.description ? (
                      <p className="text-sm text-muted">{phase.description}</p>
                    ) : null}
                  </Card>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </Container>

      {caseStudy.testimonial ? (
        <Section tone="muted">
          <SectionHeader title={t('testimonial')} />
          <div className="max-w-2xl">
            <TestimonialCard testimonial={caseStudy.testimonial} />
          </div>
        </Section>
      ) : null}

      {caseStudy.related_services.length ? (
        <Section>
          <SectionHeader title={t('relatedServices')} />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {caseStudy.related_services.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                basePath={service.kind === 'solution' ? '/solutions' : '/services'}
              />
            ))}
          </div>
        </Section>
      ) : null}
    </>
  );
}

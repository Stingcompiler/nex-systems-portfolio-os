import { Download, ExternalLink } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ProjectCard, TechBadge } from '@/components/content/cards';
import { CoverImage } from '@/components/content/media';
import { PageCta } from '@/components/content/page-cta';
import { ButtonLink, ExternalButtonLink } from '@/components/ui/button';
import { CardGrid, gridColumns } from '@/components/ui/card-grid';
import { Container } from '@/components/ui/container';
import { Breadcrumbs, Card, JsonLd, Prose } from '@/components/ui/misc';
import {
  getCertifications,
  getEducation,
  getExperiences,
  getFeaturedProjects,
  getProcessSteps,
  getSeoSettings,
  getServices,
  getSiteSettings,
  getTechnologies,
} from '@/lib/api/queries';
import { Link } from '@/lib/i18n/navigation';
import type { Locale } from '@/lib/i18n/routing';
import { breadcrumbJsonLd, organizationJsonLd, personJsonLd } from '@/lib/seo/json-ld';
import { buildMetadata } from '@/lib/seo/metadata';
import { cn } from '@/lib/utils/cn';
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
    // لا الشعار: بطاقة اللغة الافتراضية أنسب كمعاينة من شعار خام
    image: settings?.owner_photo?.url ?? null,
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

  const [
    t,
    tNav,
    tCommon,
    settings,
    services,
    steps,
    experiences,
    education,
    certifications,
    technologies,
    projects,
  ] = await Promise.all([
    getTranslations('about'),
    getTranslations('nav'),
    getTranslations('common'),
    getSiteSettings(locale),
    getServices(locale, { page_size: 6 }),
    getProcessSteps(locale),
    getExperiences(locale),
    getEducation(locale),
    getCertifications(locale),
    getTechnologies(locale),
    getFeaturedProjects(locale),
  ]);

  const cv = locale === 'ar' ? settings?.cv_ar : settings?.cv_en;
  const featuredTechnologies = technologies.results.filter((item) => item.is_featured);

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

        {/* من نحن: سطر واحد ثابت عن طبيعة الاستوديو — الـtagline من اللوحة تحته */}
        <header className="mb-16 max-w-prose">
          <h1 className="text-h1 font-semibold">{settings?.site_name || t('title')}</h1>
          {settings?.tagline ? (
            <p className="mt-2 text-lg text-primary">{settings.tagline}</p>
          ) : null}
          <p className="mt-6 text-body-lg text-muted">{t('intro')}</p>
        </header>

        {/* المسؤول عن التحليل والتنفيذ والدعم أولًا — ثم ما بناه فعلًا */}
        {settings?.owner_name ? (
          <section className="mb-16">
            <h2 className="mb-6 text-h2 font-semibold">{t('founder')}</h2>
            <Card>
              {/* عمودان فقط حين توجد صورة — بدونها كان النص يُحشر في عمود الصورة الضيق */}
              <div className={cn('grid gap-8', settings.owner_photo && 'lg:grid-cols-[1fr_2.4fr]')}>
                {settings.owner_photo ? (
                  <CoverImage
                    media={settings.owner_photo}
                    alt={settings.owner_name}
                    ratio="aspect-square"
                    sizes="(max-width: 1024px) 100vw, 25vw"
                    className="rounded-xl"
                  />
                ) : null}
                <div>
                  <h3 className="text-h3 font-semibold">{settings.owner_name}</h3>
                  {settings.owner_title ? (
                    <p className="mt-1 text-primary">{settings.owner_title}</p>
                  ) : null}
                  {settings.owner_bio ? (
                    <div className="mt-4">
                      <Prose text={settings.owner_bio} />
                    </div>
                  ) : null}
                  {cv?.url ? (
                    <ExternalButtonLink href={cv.url} className="mt-6" variant="secondary" size="sm">
                      <Download className="size-4" aria-hidden="true" />
                      {tCommon('downloadCv')}
                    </ExternalButtonLink>
                  ) : null}
                </div>
              </div>
            </Card>

            {projects.length ? (
              <div className="mt-8">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <h3 className="text-h3 font-semibold">{t('publishedWork')}</h3>
                  <ButtonLink href="/projects" variant="secondary" size="sm">
                    {tNav('projects')}
                  </ButtonLink>
                </div>
                <CardGrid count={Math.min(projects.length, 2)}>
                  {projects.slice(0, 2).map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </CardGrid>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* ماذا نبني: الخدمات الفعلية لا وصف عام */}
        {services.results.length ? (
          <section className="mb-16">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-prose">
                <h2 className="text-h2 font-semibold">{t('whatWeBuild')}</h2>
                <p className="mt-2 text-muted">{t('whatWeBuildBody')}</p>
              </div>
              <ButtonLink href="/services" variant="secondary" size="sm">
                {t('allServices')}
              </ButtonLink>
            </div>
            <ul className={cn('grid gap-4', gridColumns(services.results.length))}>
              {services.results.map((service) => (
                <li key={service.id}>
                  <Link
                    href={`/services/${service.slug}`}
                    className="block h-full rounded-lg border border-border bg-surface p-5 transition-colors hover:border-primary/40"
                  >
                    <h3 className="font-semibold">{service.title}</h3>
                    <p className="mt-1.5 text-sm text-muted">{service.short_description}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* كيف نعمل: المراحل الست مختصرة — الترتيب هنا معلومة حقيقية */}
        {steps.length ? (
          <section className="mb-16">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-prose">
                <h2 className="text-h2 font-semibold">{t('howWeWork')}</h2>
                <p className="mt-2 text-muted">{t('howWeWorkBody')}</p>
              </div>
              <ButtonLink href="/process" variant="secondary" size="sm">
                {t('fullProcess')}
              </ButtonLink>
            </div>
            <ol className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              {steps.map((step, index) => (
                <li key={step.id} className="flex gap-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-sm font-bold text-primary">
                    <span className="code-inline inline">{index + 1}</span>
                  </span>
                  <div>
                    <h3 className="font-semibold">{step.title}</h3>
                    {step.description ? (
                      <p className="mt-1 text-sm text-muted">{step.description}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {featuredTechnologies.length ? (
          <section className="mb-16">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <h2 className="text-h2 font-semibold">{t('stack')}</h2>
              <ButtonLink href="/technologies" variant="secondary" size="sm">
                {t('allTechnologies')}
              </ButtonLink>
            </div>
            <ul className="flex flex-wrap gap-2">
              {featuredTechnologies.map((technology) => (
                <li key={technology.id}>
                  <TechBadge technology={technology} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {experiences.results.length ? (
          <section className="mb-16">
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
          <section className="mb-16">
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
          <section className="mb-16">
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

        <PageCta />
      </Container>
    </>
  );
}

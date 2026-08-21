import { Apple, ExternalLink, Github, Play } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { TechBadge } from '@/components/content/cards';
import { CoverImage } from '@/components/content/media';
import { ButtonLink, ExternalButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { Breadcrumbs, Card, JsonLd, Prose } from '@/components/ui/misc';
import { Section, SectionHeader } from '@/components/ui/section';
import { findProject, loadProject, NOT_FOUND_METADATA } from '@/lib/api/detail';
import { getProjects, getSeoSettings, getSiteSettings } from '@/lib/api/queries';
import { locales, type Locale } from '@/lib/i18n/routing';
import { breadcrumbJsonLd, creativeWorkJsonLd } from '@/lib/seo/json-ld';
import { buildMetadata } from '@/lib/seo/metadata';
import { formatDate } from '@/lib/utils/format';

export async function generateStaticParams() {
  const projects = await getProjects('ar', { page_size: 100 });
  return locales.flatMap((locale) =>
    projects.results.map((project) => ({ locale, slug: project.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const [project, settings, seoSettings] = await Promise.all([
    findProject(locale as Locale, slug),
    getSiteSettings(locale as Locale),
    getSeoSettings(locale as Locale),
  ]);

  if (!project) return NOT_FOUND_METADATA;

  return buildMetadata({
    locale: locale as Locale,
    path: `/projects/${slug}`,
    title: project.seo.title || project.title,
    description: project.seo.description,
    image: project.seo.image?.url ?? null,
    publishedTime: project.published_at,
    settings,
    seoSettings,
  });
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  setRequestLocale(rawLocale);
  const locale = rawLocale as Locale;

  const [project, t, tCommon, tNav] = await Promise.all([
    loadProject(locale, slug),
    getTranslations('projects'),
    getTranslations('common'),
    getTranslations('nav'),
  ]);

  const links = [
    { url: project.live_url, label: tCommon('visitSite'), icon: ExternalLink },
    { url: project.github_url, label: tCommon('viewCode'), icon: Github },
    { url: project.play_store_url, label: tCommon('googlePlay'), icon: Play },
    { url: project.app_store_url, label: tCommon('appStore'), icon: Apple },
  ].filter((link) => link.url);

  return (
    <>
      <JsonLd data={creativeWorkJsonLd(project, locale)} />
      <JsonLd
        data={breadcrumbJsonLd(
          [
            { name: tNav('home'), path: '/' },
            { name: t('title'), path: '/projects' },
            { name: project.title, path: `/projects/${slug}` },
          ],
          locale,
        )}
      />

      <Container className="py-12 sm:py-16">
        <Breadcrumbs
          label={tNav('breadcrumbs')}
          items={[
            { name: tNav('home'), href: '/' },
            { name: t('title'), href: '/projects' },
            { name: project.title },
          ]}
        />

        <div className="grid gap-10 lg:grid-cols-[2fr_1fr]">
          <div>
            <h1 className="text-h1 font-semibold">{project.title}</h1>
            <p className="mt-4 max-w-prose text-lg text-muted">{project.summary}</p>

            <CoverImage
              media={project.cover_image}
              alt={project.title}
              priority
              sizes="(max-width: 1024px) 100vw, 66vw"
              className="mt-8"
            />

            <div className="mt-8">
              <Prose text={project.description} />
            </div>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Card>
              <dl className="space-y-4 text-sm">
                <div>
                  <dt className="text-muted">{tCommon('client')}</dt>
                  <dd className="font-medium">
                    {project.client_name || t('anonymous')}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">{tCommon('sector')}</dt>
                  <dd className="font-medium">{project.sector_display}</dd>
                </div>
                <div>
                  <dt className="text-muted">{tCommon('projectType')}</dt>
                  <dd className="font-medium">{project.project_type_display}</dd>
                </div>
                {project.completed_at ? (
                  <div>
                    <dt className="text-muted">{tCommon('completedAt')}</dt>
                    <dd className="font-medium">
                      <time dateTime={project.completed_at}>
                        {formatDate(project.completed_at, locale)}
                      </time>
                    </dd>
                  </div>
                ) : null}
              </dl>

              {project.technologies.length ? (
                <>
                  <h2 className="mb-3 mt-6 text-sm font-semibold">
                    {tCommon('technologies')}
                  </h2>
                  <ul className="flex flex-wrap gap-2">
                    {project.technologies.map((technology) => (
                      <li key={technology.id}>
                        <TechBadge technology={technology} />
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              {links.length ? (
                <>
                  <h2 className="mb-3 mt-6 text-sm font-semibold">{t('links')}</h2>
                  <div className="flex flex-col gap-2">
                    {links.map((link) => (
                      <ExternalButtonLink
                        key={link.url}
                        href={link.url}
                        size="sm"
                        variant="secondary"
                      >
                        <link.icon className="size-4" aria-hidden="true" />
                        {link.label}
                      </ExternalButtonLink>
                    ))}
                  </div>
                </>
              ) : null}

              {project.case_study_slug ? (
                <ButtonLink
                  href={`/case-studies/${project.case_study_slug}`}
                  className="mt-6 w-full"
                >
                  {t('viewCaseStudy')}
                </ButtonLink>
              ) : null}
            </Card>
          </aside>
        </div>
      </Container>

      {project.images.length ? (
        <Section tone="muted">
          <SectionHeader title={t('gallery')} />
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {project.images.map((image) => (
              <li key={image.id}>
                <figure>
                  <CoverImage media={image.image} alt={image.caption || project.title} />
                  {image.caption ? (
                    <figcaption className="mt-2 text-sm text-muted">
                      {image.caption}
                    </figcaption>
                  ) : null}
                </figure>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  );
}

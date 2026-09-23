import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ProjectCard } from '@/components/content/cards';
import { ButtonLink } from '@/components/ui/button';
import { CardGrid } from '@/components/ui/card-grid';
import { Container } from '@/components/ui/container';
import { Breadcrumbs, JsonLd } from '@/components/ui/misc';
import { EmptyState } from '@/components/ui/states';
import { getCaseStudies, getProjects, getSeoSettings, getSiteSettings } from '@/lib/api/queries';
import { Link } from '@/lib/i18n/navigation';
import type { Locale } from '@/lib/i18n/routing';
import { breadcrumbJsonLd } from '@/lib/seo/json-ld';
import { buildMetadata } from '@/lib/seo/metadata';
import { cn } from '@/lib/utils/cn';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const [t, settings, seoSettings] = await Promise.all([
    getTranslations({ locale, namespace: 'projects' }),
    getSiteSettings(locale as Locale),
    getSeoSettings(locale as Locale),
  ]);

  return buildMetadata({
    locale: locale as Locale,
    path: '/projects',
    title: t('title'),
    description: t('description'),
    settings,
    seoSettings,
  });
}

export default async function ProjectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ sector?: string; project_type?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const filters = await searchParams;
  setRequestLocale(rawLocale);
  const locale = rawLocale as Locale;

  const filtered = Boolean(filters.sector || filters.project_type);

  const [t, tNav, tStates, tCommon, projects, allProjects, caseStudies] = await Promise.all([
    getTranslations('projects'),
    getTranslations('nav'),
    getTranslations('states'),
    getTranslations('common'),
    getProjects(locale, {
      sector: filters.sector,
      project_type: filters.project_type,
      page_size: 50,
    }, { strict: true }),
    // خيارات الفلترة من القائمة الكاملة لا من النتائج المفلترة: وإلا
    // اختفت بقية القطاعات فور اختيار أحدها وعلق الزائر في قطاع واحد
    filtered ? getProjects(locale, { page_size: 50 }) : null,
    getCaseStudies(locale, { page_size: 1 }),
  ]);

  const sectors = Array.from(
    new Map(
      (allProjects ?? projects).results.map((project) => [
        project.sector,
        project.sector_display,
      ]),
    ).entries(),
  );

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd(
          [
            { name: tNav('home'), path: '/' },
            { name: t('title'), path: '/projects' },
          ],
          locale,
        )}
      />

      <Container className="py-12 sm:py-16">
        <Breadcrumbs items={[{ name: tNav('home'), href: '/' }, { name: t('title') }]} label={tNav('breadcrumbs')} />

        <header className="mb-8 max-w-prose">
          <h1 className="text-h1 font-semibold">{t('title')}</h1>
          <p className="mt-3 text-muted">{t('description')}</p>
          {/* رابط دراسات الحالة يظهر حين تُنشر واحدة على الأقل — لا وجهة فارغة */}
          {caseStudies.count > 0 ? (
            <Link
              href="/case-studies"
              className="mt-4 inline-flex min-h-11 items-center gap-2 font-medium text-primary hover:underline"
            >
              {t('caseStudiesLink')}
              <ArrowRight className="size-4 flip-rtl" aria-hidden="true" />
            </Link>
          ) : null}
        </header>

        {sectors.length > 1 ? (
          <nav aria-label={tNav('projects')} className="mb-8">
            <ul className="flex flex-wrap gap-2">
              <li>
                <FilterChip href="/projects" active={!filters.sector}>
                  {tCommon('all')}
                </FilterChip>
              </li>
              {sectors.map(([value, label]) => (
                <li key={value}>
                  <FilterChip
                    href={`/projects?sector=${value}`}
                    active={filters.sector === value}
                  >
                    {label}
                  </FilterChip>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        {projects.results.length ? (
          <CardGrid count={projects.results.length}>
            {projects.results.map((project, index) => (
              <ProjectCard key={project.id} project={project} priority={index < 3} />
            ))}
          </CardGrid>
        ) : (
          <EmptyState
            title={
              filters.sector || filters.project_type
                ? tStates('emptySearch')
                : tStates('emptyProjects')
            }
            body={filtered ? undefined : tStates('emptyBody')}
            action={
              filtered ? (
                <ButtonLink href="/projects" variant="secondary">
                  {tCommon('resetFilters')}
                </ButtonLink>
              ) : (
                <ButtonLink href="/request-quote">{tNav('requestQuote')}</ButtonLink>
              )
            }
          />
        )}
      </Container>
    </>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors duration-fast',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-surface text-muted hover:bg-surface-hover hover:text-foreground',
      )}
    >
      {children}
    </Link>
  );
}

import { ArrowLeft, Quote, Star } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

import { CoverImage } from '@/components/content/media';
import { Badge, Card } from '@/components/ui/misc';
import type {
  CaseStudyListItem,
  ProjectListItem,
  ServiceListItem,
  Stat,
  TechnologyRef,
  Testimonial,
} from '@/lib/api/types';
import { Link } from '@/lib/i18n/navigation';
import type { Locale } from '@/lib/i18n/routing';
import { formatMonthYear, formatPrice } from '@/lib/utils/format';

/**
 * [بند 9] سهم واحد ثابت ينعكس بالـCSS عبر .flip-rtl —
 * لا تفريع على locale في مكوّنات العرض، ولا استيراد سهمين.
 */
function DirectionArrow() {
  return (
    <ArrowLeft
      className="size-4 shrink-0 flip-rtl transition-transform duration-fast group-hover/card:-translate-x-1"
      aria-hidden="true"
    />
  );
}

export async function ServiceCard({
  service,
  basePath,
}: {
  service: ServiceListItem;
  basePath: '/services' | '/solutions';
}) {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations('common');
  const tServices = await getTranslations('services');
  const price = formatPrice(service.price_from, service.price_currency, locale);

  return (
    <Card interactive className="relative flex h-full flex-col">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="text-h3 font-semibold">
          <Link
            href={`${basePath}/${service.slug}`}
            className="after:absolute after:inset-0 focus-visible:outline-none"
          >
            {service.title}
          </Link>
        </h3>
        {service.is_featured ? (
          <Badge tone="primary">{tServices('featured')}</Badge>
        ) : null}
      </div>

      <p className="mb-4 flex-1 text-sm text-muted">{service.short_description}</p>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <Badge>{service.sector_display}</Badge>
        {price ? (
          <span>
            {tServices('priceFrom')} <span className="code-inline inline">{price}</span>
          </span>
        ) : null}
      </div>

      <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary">
        {t('readMore')}
        <DirectionArrow />
      </span>
    </Card>
  );
}

export async function ProjectCard({
  project,
  priority = false,
}: {
  project: ProjectListItem;
  priority?: boolean;
}) {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations('projects');

  return (
    <Card interactive className="relative flex h-full flex-col overflow-hidden p-0">
      <div className="overflow-hidden">
        <CoverImage
          media={project.cover_image}
          alt={project.title}
          priority={priority}
          className="rounded-b-none rounded-t-xl transition-transform duration-slow group-hover/card:scale-[1.04]"
        />
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge>{project.sector_display}</Badge>
          <Badge>{project.project_type_display}</Badge>
          {project.is_featured ? <Badge tone="accent">{t('featured')}</Badge> : null}
        </div>

        <h3 className="mb-2 text-h3 font-semibold">
          <Link
            href={`/projects/${project.slug}`}
            className="after:absolute after:inset-0 focus-visible:outline-none"
          >
            {project.title}
          </Link>
        </h3>

        <p className="mb-4 flex-1 text-sm text-muted">{project.summary}</p>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>{project.client_name || t('anonymous')}</span>
          {project.completed_at ? (
            <time dateTime={project.completed_at} className="code-inline inline">
              {formatMonthYear(project.completed_at, locale)}
            </time>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

export async function CaseStudyCard({ caseStudy }: { caseStudy: CaseStudyListItem }) {
  const t = await getTranslations('common');

  return (
    <Card interactive className="relative flex h-full flex-col">
      <Badge className="mb-3 self-start">{caseStudy.project?.sector_display}</Badge>

      <h3 className="mb-2 text-h3 font-semibold">
        <Link
          href={`/case-studies/${caseStudy.slug}`}
          className="after:absolute after:inset-0 focus-visible:outline-none"
        >
          {caseStudy.title}
        </Link>
      </h3>

      <p className="mb-4 flex-1 text-sm text-muted">{caseStudy.overview}</p>

      <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
        {t('readMore')}
        <DirectionArrow />
      </span>
    </Card>
  );
}

export function TechBadge({ technology }: { technology: TechnologyRef }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted transition-colors duration-fast hover:border-primary/40 hover:text-primary">
      {technology.name}
    </span>
  );
}

export function StatCard({ stat }: { stat: Stat }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 text-center shadow-subtle transition-all duration-normal hover:-translate-y-1 hover:border-primary/30 hover:shadow-card">
      <p className="text-h1 font-bold">
        <span className="text-gradient code-inline inline">{stat.value}</span>
        {stat.suffix ? <span className="text-h3 text-gradient">{stat.suffix}</span> : null}
      </p>
      <p className="mt-1 text-sm text-muted">{stat.label}</p>
    </div>
  );
}

export async function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  const t = await getTranslations('testimonials');

  return (
    <Card className="flex h-full flex-col">
      {/* علامة الاقتباس اتجاهية — تنعكس؛ التقييم بالنجوم لا ينعكس */}
      <Quote className="mb-3 size-6 text-primary/40 flip-rtl" aria-hidden="true" />
      <p className="mb-4 flex-1 text-sm">{testimonial.content}</p>

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{testimonial.client_name}</p>
          <p className="text-xs text-muted">
            {[testimonial.client_title, testimonial.company].filter(Boolean).join(' — ')}
          </p>
        </div>
        <div
          className="flex items-center gap-0.5"
          aria-label={t('rating', { value: testimonial.rating })}
        >
          {Array.from({ length: testimonial.rating }).map((_, index) => (
            <Star key={index} className="size-3.5 fill-warning text-warning" aria-hidden="true" />
          ))}
        </div>
      </div>
    </Card>
  );
}

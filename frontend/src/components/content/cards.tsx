import { ArrowRight, Quote, Star } from 'lucide-react';
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
 * السهم «إلى الأمام»: يمين في الإنجليزية، ويسار بعد الانعكاس في العربية،
 * والإزاحة عند التحويم في اتجاه القراءة نفسه.
 */
function DirectionArrow() {
  return (
    <ArrowRight
      className="size-4 shrink-0 flip-rtl transition-transform duration-fast group-hover/card:translate-x-1 rtl:group-hover/card:-translate-x-1"
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
      {/* «مميّزة» تحكم الترتيب فقط: أغلب الخدمات تحملها فلا تميّز شيئًا كشارة */}
      <h3 className="mb-3 text-h3 font-semibold">
        <Link
          href={`${basePath}/${service.slug}`}
          className="after:absolute after:inset-0 focus-visible:outline-none"
        >
          {service.title}
        </Link>
      </h3>

      {/* 16px لا 14: وصف يُقرأ، لا حاشية — كانت ستّ بطاقات نص متكاثف */}
      <p className="mb-5 flex-1 text-base text-muted">{service.short_description}</p>

      <div className="flex flex-wrap items-center gap-2 text-label text-muted">
        {/* «عام» هو القطاع الافتراضي في الباكند — شارة بلا معلومة */}
        {service.sector !== 'general' ? <Badge>{service.sector_display}</Badge> : null}
        {price ? (
          <span>
            {tServices('priceFrom')}{' '}
            <span className="code-inline inline font-mono text-foreground">{price}</span>
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
      {/* بلا غلاف: بطاقة نصية مقصودة، لا مساحة لونية فارغة بحجم صورة
          توحي بأن المحتوى لم يكتمل */}
      {project.cover_image ? (
        <div className="overflow-hidden border-b border-border">
          <CoverImage
            media={project.cover_image}
            alt={project.title}
            priority={priority}
            className="rounded-b-none rounded-t-xl transition-transform duration-slow group-hover/card:scale-[1.04]"
          />
        </div>
      ) : (
        <span aria-hidden="true" className="h-1 bg-brand" />
      )}

      <div className="flex flex-1 flex-col p-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {project.sector !== 'general' ? <Badge>{project.sector_display}</Badge> : null}
          <Badge>{project.project_type_display}</Badge>
          {/* بديل قسم «دراسات الحالة» على الرئيسية الذي كان يكرّر المشروع نفسه */}
          {project.has_case_study ? <Badge tone="primary">{t('hasCaseStudy')}</Badge> : null}
        </div>

        <h3 className="mb-2 text-h3 font-semibold">
          <Link
            href={`/projects/${project.slug}`}
            className="after:absolute after:inset-0 focus-visible:outline-none"
          >
            {project.title}
          </Link>
        </h3>

        <p className="mb-5 flex-1 text-base text-muted">{project.summary}</p>

        <div className="flex flex-wrap items-center justify-between gap-2 text-label text-muted">
          <span>{project.client_name || t('anonymous')}</span>
          {project.completed_at ? (
            <time dateTime={project.completed_at} className="code-inline inline font-mono">
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

      <p className="mb-5 flex-1 text-base text-muted">{caseStudy.overview}</p>

      <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
        {t('readMore')}
        <DirectionArrow />
      </span>
    </Card>
  );
}

export function TechBadge({ technology }: { technology: TechnologyRef }) {
  return (
    <span className="code-inline inline-flex items-center rounded-full border border-border bg-surface px-3 py-1 font-mono text-xs font-medium text-muted transition-colors duration-fast hover:border-primary/40 hover:text-primary">
      {technology.name}
    </span>
  );
}

export function StatCard({ stat }: { stat: Stat }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 text-center shadow-subtle transition-all duration-normal hover:-translate-y-1 hover:border-primary/30 hover:shadow-card">
      {/* الرقم بخط المونو وبلون صلب: التدرّج على الأرقام كان آخر أثر «قالب»،
          والمونو يجعل الأرقام تُقرأ كبيانات مقاسة لا كزخرفة */}
      <p className="font-mono text-h1 font-medium tabular-nums text-primary">
        <span className="code-inline inline">{stat.value}</span>
        {stat.suffix ? <span className="text-h3">{stat.suffix}</span> : null}
      </p>
      <p className="mt-2 text-label uppercase tracking-wide text-muted">{stat.label}</p>
    </div>
  );
}

export async function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  const t = await getTranslations('testimonials');

  return (
    <Card className="flex h-full flex-col">
      {/* علامة الاقتباس اتجاهية — تنعكس؛ التقييم بالنجوم لا ينعكس */}
      <Quote className="mb-4 size-7 text-primary/40 flip-rtl" aria-hidden="true" />
      {/* أقوى دليل اجتماعي في الصفحة كان أصغر نص فيها. الاقتباس يُقرأ
          كاقتباس (17px) ويُقتطع عند ثمانية أسطر — رسائل الشكر الكاملة
          تُعرض في صفحة الآراء لا في بطاقة */}
      <blockquote className="mb-6 flex-1 text-body-lg leading-relaxed [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:8] overflow-hidden">
        {testimonial.content}
      </blockquote>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <div>
          <p className="font-heading text-base font-semibold">{testimonial.client_name}</p>
          <p className="text-label text-muted">
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

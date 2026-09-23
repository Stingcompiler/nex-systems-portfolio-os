import { ArrowRight, Check, Mail } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import {
  CaseStudyCard,
  ProjectCard,
  ServiceCard,
  StatCard,
  TestimonialCard,
} from '@/components/content/cards';
import { FaqList } from '@/components/content/faq-list';
import { CoverImage, TechLogo } from '@/components/content/media';
import { CardGrid } from '@/components/ui/card-grid';
import { PostCard } from '@/features/blog/post-card';
import { NewsletterForm } from '@/features/newsletter/newsletter-form';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { Card, Prose } from '@/components/ui/misc';
import { Section, SectionHeader, type SectionTone } from '@/components/ui/section';
import type {
  CaseStudyListItem,
  Faq,
  PageSection,
  PostListItem,
  ProcessStep,
  ProjectListItem,
  ServiceListItem,
  SiteSettings,
  Stat,
  Technology,
  Testimonial,
} from '@/lib/api/types';
import { Link } from '@/lib/i18n/navigation';
import type { Locale } from '@/lib/i18n/routing';
import { cn } from '@/lib/utils/cn';

interface SectionProps {
  section: PageSection;
  locale: Locale;
  /** رقم القسم في ترتيب الصفحة — يُعرض في سطر الجذب. تحسبه الصفحة من الأقسام المعروضة فعلًا. */
  index?: number;
}

/** عنوان القسم من قاعدة البيانات مع ارتداد إلى ملف الترجمة. */
async function resolveTitle(section: PageSection) {
  const t = await getTranslations('sections');
  if (section.title) return section.title;
  try {
    return t(section.key);
  } catch {
    return '';
  }
}

export async function HeroSection({
  section,
  settings,
  stats,
  showcase,
  services,
}: SectionProps & {
  settings: SiteSettings | null;
  stats: Stat[];
  /** مشروع حقيقي بلقطة تُعرض بجوار الرسالة — أقوى دليل في أول شاشة */
  showcase?: ProjectListItem | null;
  /** بديل نصي حين لا توجد لقطة: ما نبنيه فعلًا، من المحتوى المنشور */
  services: ServiceListItem[];
}) {
  const t = await getTranslations('home');

  // العنوان من اللوحة أولًا؛ النص الاحتياطي يمنع بطلًا فارغًا إن تعذّر جلب المحتوى
  const title = section.title || settings?.tagline || t('heroTitle');
  const subtitle = section.subtitle || (section.title ? '' : t('heroSubtitle'));

  const words = title.trim().split(' ');
  const lead = words.slice(0, -1).join(' ');
  const highlight = words.length > 1 ? words[words.length - 1] : '';
  const heroStats = stats.slice(0, 3);
  const heroServices = services.slice(0, 4);
  const hasAside = Boolean(showcase?.cover_image) || heroServices.length > 0;

  return (
    <section className="hero-surface relative overflow-hidden border-b border-border">
      {/* وهج واحد خافت — كان وهجين يتكرران في الدعوة والبطاقات */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 end-[-6rem] -z-10 size-[26rem] rounded-full bg-brand opacity-[0.12] blur-3xl"
      />

      <Container
        className={cn(
          'relative grid items-center gap-12 py-20 sm:py-28',
          hasAside && 'lg:grid-cols-[1.05fr_0.95fr]',
        )}
      >
        <div className="animate-fade-up">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1 text-sm font-medium text-primary backdrop-blur">
            <span className="inline-flex size-2 rounded-full bg-primary" aria-hidden="true" />
            {t('heroBadge')}
          </p>

          <h1 className="text-display font-bold [text-wrap:balance]">
            {highlight ? (
              <>
                {lead} <span className="text-primary">{highlight}</span>
              </>
            ) : (
              title
            )}
          </h1>

          {subtitle ? (
            <p className="mt-6 max-w-prose text-body-lg text-muted">{subtitle}</p>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/request-quote" size="lg">
              {section.cta_label || t('ctaPrimary')}
              <ArrowRight className="size-4 flip-rtl" aria-hidden="true" />
            </ButtonLink>
            <ButtonLink href="/projects" size="lg" variant="secondary">
              {t('ctaSecondary')}
            </ButtonLink>
          </div>

          {/* أرقام من اللوحة فقط (سنوات، مشاريع…) — لا مؤشرات تشغيل توضيحية */}
          {heroStats.length ? (
            <dl className="mt-12 flex flex-wrap gap-x-12 gap-y-5 border-t border-border pt-7">
              {heroStats.map((stat) => (
                <div key={stat.id}>
                  <dt className="font-mono text-h2 font-medium tabular-nums text-foreground">
                    <span className="code-inline inline">{stat.value}</span>
                    {stat.suffix ? <span className="text-h3 text-primary">{stat.suffix}</span> : ''}
                  </dt>
                  <dd className="mt-1 text-label text-muted">{stat.label}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

        {showcase?.cover_image ? (
          <HeroShowcase project={showcase} label={t('showcaseLabel')} />
        ) : heroServices.length ? (
          <HeroServices services={heroServices} title={t('heroServicesTitle')} />
        ) : null}
      </Container>
    </section>
  );
}

/**
 * لقطة مشروع فعلي بدل لوحة مؤشرات توضيحية: الزائر يرى ما سُلّم لا رسمًا
 * يشبه لوحة تحكم بأرقام قد تُفهم نتائجَ مقاسة.
 */
async function HeroShowcase({ project, label }: { project: ProjectListItem; label: string }) {
  return (
    <figure className="group/showcase relative">
      <Link
        href={`/projects/${project.slug}`}
        className="block overflow-hidden rounded-2xl border border-border bg-surface shadow-elevated transition-shadow duration-normal hover:shadow-card focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CoverImage
          media={project.cover_image}
          alt={project.title}
          fit="contain"
          priority
          ratio="aspect-[16/10]"
          sizes="(max-width: 1024px) 100vw, 45vw"
          className="rounded-none bg-surface-hover"
        />
        <figcaption className="flex items-center justify-between gap-4 border-t border-border p-4 sm:p-5">
          <span className="min-w-0">
            <span className="block text-label text-muted">{label}</span>
            <span className="mt-0.5 block font-heading text-base font-semibold sm:text-lg">
              {project.title}
            </span>
          </span>
          <ArrowRight
            className="size-5 shrink-0 text-primary transition-transform duration-fast flip-rtl group-hover/showcase:translate-x-1 rtl:group-hover/showcase:-translate-x-1"
            aria-hidden="true"
          />
        </figcaption>
      </Link>
    </figure>
  );
}

/** تكوين نصي منظّم حين لا توجد لقطة مشروع بعد. */
async function HeroServices({ services, title }: { services: ServiceListItem[]; title: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-card backdrop-blur sm:p-8">
      <p className="mb-5 text-sm font-medium text-muted">{title}</p>
      <ul className="divide-y divide-border">
        {services.map((service) => (
          <li key={service.id} className="py-4 first:pt-0 last:pb-0">
            <Link
              href={`/services/${service.slug}`}
              className="group/item flex items-start justify-between gap-4"
            >
              <span className="min-w-0">
                <span className="block font-heading text-base font-semibold group-hover/item:text-primary">
                  {service.title}
                </span>
                {service.short_description ? (
                  <span className="mt-1 line-clamp-2 block text-sm text-muted">
                    {service.short_description}
                  </span>
                ) : null}
              </span>
              <ArrowRight
                className="mt-1 size-4 shrink-0 text-muted flip-rtl group-hover/item:text-primary"
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export async function IntroSection({
  section,
  settings,
}: SectionProps & { settings: SiteSettings | null }) {
  const bio = settings?.owner_bio;
  if (!bio) return null;

  const t = await getTranslations('common');
  const title = await resolveTitle(section);

  return (
    <Section tone="muted">
      <SectionHeader
        title={title}
        action={
          <ButtonLink href="/about" variant="secondary" size="sm">
            {t('readMore')}
          </ButtonLink>
        }
      />
      <Prose text={bio} />
    </Section>
  );
}

export async function StatsSection({
  section,
  stats,
  index,
}: SectionProps & { stats: Stat[] }) {
  if (!stats.length) return null;

  return (
    <Section>
      <SectionHeader
        title={await resolveTitle(section)}
        subtitle={section.subtitle}
        index={index}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.id} stat={stat} />
        ))}
      </div>
    </Section>
  );
}

export async function ServicesSection({
  section,
  services,
  basePath,
  tone,
  index,
}: SectionProps & {
  services: ServiceListItem[];
  basePath: '/services' | '/solutions';
  tone?: SectionTone;
}) {
  if (!services.length) return null;

  const t = await getTranslations('common');
  const limit = section.config?.limit ?? 6;

  return (
    <Section tone={tone}>
      <SectionHeader
        title={await resolveTitle(section)}
        subtitle={section.subtitle}
        index={index}
        action={
          <ButtonLink href={basePath} variant="secondary" size="sm">
            {t('viewAll')}
          </ButtonLink>
        }
      />
      <CardGrid count={Math.min(services.length, limit)}>
        {services.slice(0, limit).map((service) => (
          <ServiceCard key={service.id} service={service} basePath={basePath} />
        ))}
      </CardGrid>
    </Section>
  );
}

export async function ProjectsSection({
  section,
  projects,
  index,
}: SectionProps & { projects: ProjectListItem[] }) {
  if (!projects.length) return null;

  const t = await getTranslations('common');
  // مشروعان بارزان بلقطات واسعة يقنعان أكثر من ستة مصغّرة؛ اللوحة تغيّر العدد
  const limit = section.config?.limit ?? 2;

  return (
    <Section tone="dark">
      <SectionHeader
        title={await resolveTitle(section)}
        subtitle={section.subtitle}
        index={index}
        action={
          <ButtonLink href="/projects" variant="secondary" size="sm">
            {t('viewAll')}
          </ButtonLink>
        }
      />
      <CardGrid count={Math.min(projects.length, limit)}>
        {projects.slice(0, limit).map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </CardGrid>
    </Section>
  );
}

export async function CaseStudiesSection({
  section,
  caseStudies,
  index,
}: SectionProps & { caseStudies: CaseStudyListItem[] }) {
  if (!caseStudies.length) return null;

  const t = await getTranslations('common');
  const limit = section.config?.limit ?? 3;

  return (
    <Section tone="muted">
      <SectionHeader
        title={await resolveTitle(section)}
        subtitle={section.subtitle}
        index={index}
        action={
          <ButtonLink href="/case-studies" variant="secondary" size="sm">
            {t('viewAll')}
          </ButtonLink>
        }
      />
      <CardGrid count={Math.min(caseStudies.length, limit)}>
        {caseStudies.slice(0, limit).map((caseStudy) => (
          <CaseStudyCard key={caseStudy.id} caseStudy={caseStudy} />
        ))}
      </CardGrid>
    </Section>
  );
}

export async function ProcessSection({
  section,
  steps,
  index,
}: SectionProps & { steps: ProcessStep[] }) {
  if (!steps.length) return null;

  const t = await getTranslations('common');
  // الرئيسية تعرض المراحل الأساسية فقط؛ التفاصيل الكاملة في صفحة «طريقة العمل»
  const shown = steps.slice(0, 4);
  const columns = shown.length;
  const lgColumns =
    columns >= 4 ? 'lg:grid-cols-4' : columns === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2';

  return (
    <Section tone="muted">
      <SectionHeader
        title={await resolveTitle(section)}
        subtitle={section.subtitle}
        index={index}
        action={
          <ButtonLink href="/process" variant="secondary" size="sm">
            {t('details')}
          </ButtonLink>
        }
      />
      <ol className={cn('grid gap-6', columns > 1 && 'sm:grid-cols-2', lgColumns)}>
        {shown.map((step, index) => (
          <li key={step.id} className="relative">
            {/* خطّ رابط بين الخطوات على الشاشات الواسعة — يُحذف من آخر عمود
                في كل صف (عدد الأعمدة عند lg = عدد المراحل المعروضة)، وإلا امتدّ خارج الصفحة
                وأنشأ تمريرًا أفقيًا بعرض 111px على 1280 */}
            {index < shown.length - 1 && (index + 1) % columns !== 0 ? (
              <span
                aria-hidden="true"
                className="absolute top-6 hidden h-px w-full bg-gradient-to-l from-border to-transparent lg:block"
                style={{ insetInlineStart: '50%' }}
              />
            ) : null}
            <div className="relative">
              {/* رقم الخطوة بخط المونو ومرقّم بصفر بادئ — يطابق سطر الجذب */}
              <span className="mb-5 block font-mono text-h2 font-medium text-primary">
                <span className="code-inline inline">{String(index + 1).padStart(2, '0')}</span>
              </span>
              <h3 className="mb-3 text-h3 font-semibold">{step.title}</h3>
              <p className="text-base leading-relaxed text-muted">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}

export async function TechnologiesSection({
  section,
  technologies,
  index,
}: SectionProps & { technologies: Technology[] }) {
  if (!technologies.length) return null;

  const t = await getTranslations('common');

  return (
    <Section>
      <SectionHeader
        title={await resolveTitle(section)}
        subtitle={section.subtitle}
        index={index}
        action={
          <ButtonLink href="/technologies" variant="secondary" size="sm">
            {t('viewAll')}
          </ButtonLink>
        }
      />
      {/* شعارات أحادية اللون إن رُفعت من اللوحة، وإلا شارات نصية:
          التساقط عنصرًا بعنصر، فقائمة مختلطة تظل متسقة الارتفاع */}
      <ul className="flex flex-wrap items-center gap-x-10 gap-y-6">
        {technologies.map((technology) => (
          <li key={technology.id}>
            {technology.logo ? (
              <Link
                href="/technologies"
                title={technology.name}
                className="group/logo inline-flex min-h-11 items-center text-muted transition-colors duration-fast hover:text-primary"
              >
                <TechLogo media={technology.logo} name={technology.name} className="h-7 w-auto min-w-7 sm:h-8 sm:min-w-8" />
              </Link>
            ) : (
              /* أسماء التقنيات لاتينية ومعرّفات بطبيعتها: بخط المونو ومعزولة
                 اتجاهيًا — «C#» كان يُرسم «#C» داخل السياق العربي */
              <Link
                href="/technologies"
                className="code-inline inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 font-mono text-sm font-medium hover:bg-surface-hover"
              >
                {technology.name}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

export async function TestimonialsSection({
  section,
  testimonials,
  index,
}: SectionProps & { testimonials: Testimonial[] }) {
  if (!testimonials.length) return null;

  return (
    <Section tone="dark">
      <SectionHeader
        title={await resolveTitle(section)}
        subtitle={section.subtitle}
        index={index}
      />
      <CardGrid count={testimonials.length}>
        {testimonials.map((testimonial) => (
          <TestimonialCard key={testimonial.id} testimonial={testimonial} />
        ))}
      </CardGrid>
    </Section>
  );
}

export async function PostsSection({
  section,
  posts,
  index,
}: SectionProps & { posts: PostListItem[] }) {
  if (!posts.length) return null;

  const t = await getTranslations('common');
  const limit = section.config?.limit ?? 3;

  return (
    <Section>
      <SectionHeader
        title={await resolveTitle(section)}
        subtitle={section.subtitle}
        index={index}
        action={
          <ButtonLink href="/blog" variant="secondary" size="sm">
            {t('viewAll')}
          </ButtonLink>
        }
      />
      <CardGrid count={Math.min(posts.length, limit)}>
        {posts.slice(0, limit).map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </CardGrid>
    </Section>
  );
}

export async function FaqSection({
  section,
  faqs,
  index,
}: SectionProps & { faqs: Faq[] }) {
  if (!faqs.length) return null;

  const limit = section.config?.limit ?? 6;

  return (
    <Section>
      <SectionHeader
        title={await resolveTitle(section)}
        subtitle={section.subtitle}
        index={index}
      />
      <FaqList faqs={faqs.slice(0, limit)} />
    </Section>
  );
}

export async function CtaSection({
  section,
  settings,
}: SectionProps & { settings: SiteSettings | null }) {
  const t = await getTranslations('home');
  const tContact = await getTranslations('contact');
  const title = await resolveTitle(section);

  return (
    <Section tone="muted">
      {/* لوحة دعوة بارزة: تدرّج العلامة + وهج شعاعي، نص أبيض */}
      <div className="hero-surface brand-panel relative overflow-hidden rounded-2xl bg-brand p-8 text-center shadow-elevated sm:p-14">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_50%_0%,rgb(255_255_255/0.18),transparent_70%)]"
        />
        <h2 className="text-h2 font-semibold text-white">{title}</h2>
        {section.subtitle ? (
          <p className="mx-auto mt-3 max-w-prose text-white/85">{section.subtitle}</p>
        ) : null}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink
            href="/request-quote"
            size="lg"
            className="bg-white text-primary shadow-lg hover:bg-white/90"
          >
            {section.cta_label || t('ctaPrimary')}
            <ArrowRight className="size-4 flip-rtl" aria-hidden="true" />
          </ButtonLink>
        </div>

        {settings?.whatsapp ? (
          <p className="mt-4 inline-flex items-center gap-2 text-sm text-white/80">
            <Check className="size-4" aria-hidden="true" />
            {tContact('preferWhatsapp')}
          </p>
        ) : null}
      </div>
    </Section>
  );
}

export async function NewsletterSection({ section }: SectionProps) {
  const t = await getTranslations('newsletter');
  const title = await resolveTitle(section);

  return (
    <Section id="newsletter">
      <div className="grid gap-8 rounded-2xl border border-border bg-surface p-8 sm:p-12 lg:grid-cols-[1fr_1.2fr] lg:items-center">
        <div className="max-w-prose">
          <span className="mb-4 grid size-11 place-items-center rounded-lg bg-primary/10 text-primary">
            <Mail className="size-5" aria-hidden="true" />
          </span>
          <h2 className="text-h2 font-semibold">{title || t('title')}</h2>
          <p className="mt-3 text-muted">{section.subtitle || t('subtitle')}</p>
        </div>
        <NewsletterForm source="home" className="relative" />
      </div>
    </Section>
  );
}

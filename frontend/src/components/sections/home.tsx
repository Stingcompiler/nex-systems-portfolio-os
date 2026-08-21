import { ArrowLeft, Check } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import {
  CaseStudyCard,
  ProjectCard,
  ServiceCard,
  StatCard,
  TestimonialCard,
} from '@/components/content/cards';
import { PostCard } from '@/features/blog/post-card';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { Card, Prose } from '@/components/ui/misc';
import { Section, SectionHeader } from '@/components/ui/section';
import type {
  CaseStudyListItem,
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

interface SectionProps {
  section: PageSection;
  locale: Locale;
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
}: SectionProps & { settings: SiteSettings | null; stats: Stat[] }) {
  const t = await getTranslations('home');

  const title = section.title || settings?.tagline || '';
  const subtitle = section.subtitle || '';

  // إبراز آخر كلمة من العنوان بتدرّج لوني — لمسة عصرية دون ضجيج
  const words = title.trim().split(' ');
  const lead = words.slice(0, -1).join(' ');
  const highlight = words.length > 1 ? words[words.length - 1] : '';
  const heroStats = stats.slice(0, 3);

  return (
    <section className="hero-surface relative overflow-hidden border-b border-border">
      {/* كتل متدرّجة زخرفية خلف المحتوى */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 end-[-6rem] -z-10 size-[26rem] rounded-full bg-brand opacity-[0.18] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 start-[-8rem] -z-10 size-[26rem] rounded-full opacity-[0.14] blur-3xl"
        style={{ backgroundColor: 'rgb(var(--accent))' }}
      />

      <Container className="relative grid items-center gap-12 py-24 sm:py-32 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="animate-fade-up">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1 text-sm font-medium text-primary backdrop-blur">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
            {t('heroBadge')}
          </p>

          <h1 className="text-display font-bold [text-wrap:balance]">
            {highlight ? (
              <>
                {lead} <span className="text-gradient">{highlight}</span>
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
              <ArrowLeft className="size-4 flip-rtl" aria-hidden="true" />
            </ButtonLink>
            <ButtonLink href="/projects" size="lg" variant="secondary">
              {t('ctaSecondary')}
            </ButtonLink>
          </div>

          {/* شريط أرقام موجز — من البيانات الحقيقية إن وُجدت */}
          {heroStats.length ? (
            <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4 border-t border-border pt-6">
              {heroStats.map((stat) => (
                <div key={stat.id}>
                  <dt className="text-h3 font-bold text-gradient">
                    <span className="code-inline inline">{stat.value}</span>
                    {stat.suffix || ''}
                  </dt>
                  <dd className="mt-0.5 text-xs text-muted">{stat.label}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

        <div className="relative mt-10 lg:mt-0">
          <div
            aria-hidden="true"
            className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-brand opacity-20 blur-3xl"
          />

          <div className="overflow-hidden rounded-2xl border border-border/50 bg-surface/80 shadow-elevated backdrop-blur-xl">
            <div className="flex items-center gap-1.5 border-b border-border/40 px-3 py-2 sm:px-4 sm:py-2.5">
              <span className="size-2 rounded-full bg-danger/50 sm:size-2.5" />
              <span className="size-2 rounded-full bg-warning/50 sm:size-2.5" />
              <span className="size-2 rounded-full bg-success/50 sm:size-2.5" />
              <span className="ms-2 flex-1 rounded-md bg-surface-hover px-2 py-0.5 text-[9px] text-muted sm:ms-3 sm:text-[10px]">
                app.nexasystems.com
              </span>
            </div>

            <div className="p-3 sm:p-4">
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {[
                  { label: 'Projects', value: '24', trend: '+3' },
                  { label: 'Deploys', value: '148', trend: '+12' },
                  { label: 'Uptime', value: '99.9%', trend: 'stable' },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="rounded-lg border border-border/30 bg-background/60 p-2 sm:p-2.5"
                  >
                    <div className="text-[8px] leading-none text-muted sm:text-[10px]">
                      {m.label}
                    </div>
                    <div className="mt-1 text-xs font-bold sm:text-sm">{m.value}</div>
                    <div className="mt-0.5 text-[8px] font-medium text-success sm:text-[10px]">
                      {m.trend}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-2 rounded-lg border border-border/30 bg-background/60 p-2 sm:mt-3 sm:p-3">
                <div className="mb-1.5 text-[8px] text-muted sm:text-[10px]">Performance</div>
                <svg
                  viewBox="0 0 200 50"
                  className="h-8 w-full sm:h-12"
                  aria-hidden="true"
                >
                  <rect x="4" y="30" width="14" height="20" rx="2" className="fill-primary/20" />
                  <rect x="24" y="18" width="14" height="32" rx="2" className="fill-primary/20" />
                  <rect x="44" y="24" width="14" height="26" rx="2" className="fill-primary/25" />
                  <rect x="64" y="10" width="14" height="40" rx="2" className="fill-primary/30" />
                  <rect x="84" y="14" width="14" height="36" rx="2" className="fill-primary/35" />
                  <rect x="104" y="8" width="14" height="42" rx="2" className="fill-primary/40" />
                  <rect x="124" y="12" width="14" height="38" rx="2" className="fill-primary/50" />
                  <rect x="144" y="5" width="14" height="45" rx="2" className="fill-primary/60" />
                  <rect x="164" y="8" width="14" height="42" rx="2" className="fill-primary/75" />
                  <rect x="184" y="2" width="14" height="48" rx="2" className="fill-primary" />
                </svg>
              </div>

              <div className="mt-2 hidden space-y-1.5 sm:mt-3 sm:block">
                <div className="flex items-center gap-2 rounded-lg border border-border/30 bg-background/60 p-2">
                  <span className="size-1.5 rounded-full bg-success" />
                  <span className="text-[10px] text-muted">Build #847 deployed</span>
                  <span className="ms-auto text-[9px] text-muted/60">2m</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border/30 bg-background/60 p-2">
                  <span className="size-1.5 rounded-full bg-primary" />
                  <span className="text-[10px] text-muted">API tests passed</span>
                  <span className="ms-auto text-[9px] text-muted/60">5m</span>
                </div>
              </div>
            </div>
          </div>

          <div className="absolute -bottom-3 -start-3 z-10 hidden animate-float rounded-xl border border-border/50 bg-surface/95 p-2 shadow-card backdrop-blur sm:block sm:p-2.5">
            <div className="flex items-center gap-1.5">
              <span className="size-1.5 animate-pulse rounded-full bg-success" />
              <span className="text-[9px] text-muted">terminal</span>
            </div>
            <code className="mt-1 block whitespace-nowrap text-[10px] text-success/80">
              ✓ build passed
            </code>
          </div>

          <div className="absolute -end-2 -top-2 z-10 hidden animate-float-reverse rounded-full border border-border/50 bg-surface/95 px-2.5 py-1 shadow-card backdrop-blur sm:block">
            <span className="text-[10px] font-medium text-primary">v2.4.0</span>
          </div>
        </div>
      </Container>
    </section>
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

export async function StatsSection({ section, stats }: SectionProps & { stats: Stat[] }) {
  if (!stats.length) return null;

  return (
    <Section>
      <SectionHeader title={await resolveTitle(section)} subtitle={section.subtitle} />
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
}: SectionProps & {
  services: ServiceListItem[];
  basePath: '/services' | '/solutions';
  tone?: 'default' | 'muted';
}) {
  if (!services.length) return null;

  const t = await getTranslations('common');
  const limit = section.config?.limit ?? 6;

  return (
    <Section tone={tone}>
      <SectionHeader
        title={await resolveTitle(section)}
        subtitle={section.subtitle}
        action={
          <ButtonLink href={basePath} variant="secondary" size="sm">
            {t('viewAll')}
          </ButtonLink>
        }
      />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {services.slice(0, limit).map((service) => (
          <ServiceCard key={service.id} service={service} basePath={basePath} />
        ))}
      </div>
    </Section>
  );
}

export async function ProjectsSection({
  section,
  projects,
}: SectionProps & { projects: ProjectListItem[] }) {
  if (!projects.length) return null;

  const t = await getTranslations('common');
  const limit = section.config?.limit ?? 6;

  return (
    <Section>
      <SectionHeader
        title={await resolveTitle(section)}
        subtitle={section.subtitle}
        action={
          <ButtonLink href="/projects" variant="secondary" size="sm">
            {t('viewAll')}
          </ButtonLink>
        }
      />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {projects.slice(0, limit).map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </Section>
  );
}

export async function CaseStudiesSection({
  section,
  caseStudies,
}: SectionProps & { caseStudies: CaseStudyListItem[] }) {
  if (!caseStudies.length) return null;

  const t = await getTranslations('common');
  const limit = section.config?.limit ?? 3;

  return (
    <Section tone="muted">
      <SectionHeader
        title={await resolveTitle(section)}
        subtitle={section.subtitle}
        action={
          <ButtonLink href="/case-studies" variant="secondary" size="sm">
            {t('viewAll')}
          </ButtonLink>
        }
      />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {caseStudies.slice(0, limit).map((caseStudy) => (
          <CaseStudyCard key={caseStudy.id} caseStudy={caseStudy} />
        ))}
      </div>
    </Section>
  );
}

export async function ProcessSection({
  section,
  steps,
}: SectionProps & { steps: ProcessStep[] }) {
  if (!steps.length) return null;

  return (
    <Section tone="muted">
      <SectionHeader title={await resolveTitle(section)} subtitle={section.subtitle} />
      <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => (
          <li key={step.id} className="relative">
            {/* خطّ رابط بين الخطوات على الشاشات الواسعة */}
            {index < steps.length - 1 ? (
              <span
                aria-hidden="true"
                className="absolute top-6 hidden h-px w-full bg-gradient-to-l from-border to-transparent lg:block"
                style={{ insetInlineStart: '50%' }}
              />
            ) : null}
            <div className="relative">
              <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-brand text-lg font-bold text-white shadow-[0_8px_24px_-8px_rgb(var(--primary)/0.6)]">
                <span className="code-inline inline">{index + 1}</span>
              </span>
              <h3 className="mb-2 text-h3 font-semibold">{step.title}</h3>
              <p className="text-sm leading-relaxed text-muted">{step.description}</p>
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
}: SectionProps & { technologies: Technology[] }) {
  if (!technologies.length) return null;

  const t = await getTranslations('common');

  return (
    <Section tone="muted">
      <SectionHeader
        title={await resolveTitle(section)}
        subtitle={section.subtitle}
        action={
          <ButtonLink href="/technologies" variant="secondary" size="sm">
            {t('viewAll')}
          </ButtonLink>
        }
      />
      <ul className="flex flex-wrap gap-2">
        {technologies.map((technology) => (
          <li key={technology.id}>
            <Link
              href="/technologies"
              className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-hover"
            >
              {technology.name}
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export async function TestimonialsSection({
  section,
  testimonials,
}: SectionProps & { testimonials: Testimonial[] }) {
  if (!testimonials.length) return null;

  return (
    <Section>
      <SectionHeader title={await resolveTitle(section)} subtitle={section.subtitle} />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {testimonials.map((testimonial) => (
          <TestimonialCard key={testimonial.id} testimonial={testimonial} />
        ))}
      </div>
    </Section>
  );
}

export async function PostsSection({
  section,
  posts,
}: SectionProps & { posts: PostListItem[] }) {
  if (!posts.length) return null;

  const t = await getTranslations('common');
  const limit = section.config?.limit ?? 3;

  return (
    <Section>
      <SectionHeader
        title={await resolveTitle(section)}
        subtitle={section.subtitle}
        action={
          <ButtonLink href="/blog" variant="secondary" size="sm">
            {t('viewAll')}
          </ButtonLink>
        }
      />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {posts.slice(0, limit).map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
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
            <ArrowLeft className="size-4 flip-rtl" aria-hidden="true" />
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

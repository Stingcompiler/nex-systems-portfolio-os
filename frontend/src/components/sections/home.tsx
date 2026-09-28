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
import { TechLogo } from '@/components/content/media';
import { CardGrid } from '@/components/ui/card-grid';
import { PostCard } from '@/features/blog/post-card';
import { NewsletterForm } from '@/features/newsletter/newsletter-form';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { InView } from '@/components/ui/in-view';
import { WhatsAppIcon } from '@/components/ui/whatsapp-icon';
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
import { sectorIcon } from '@/lib/constants/sector-icons';
import { Link } from '@/lib/i18n/navigation';
import type { Locale } from '@/lib/i18n/routing';
import { cn } from '@/lib/utils/cn';
import { whatsappLink } from '@/lib/utils/format';

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
}: SectionProps & {
  settings: SiteSettings | null;
  stats: Stat[];
}) {
  const t = await getTranslations('home');

  // العنوان من اللوحة أولًا؛ النص الاحتياطي يمنع بطلًا فارغًا إن تعذّر جلب المحتوى
  const title = section.title || settings?.tagline || t('heroTitle');
  const subtitle = section.subtitle || (section.title ? '' : t('heroSubtitle'));

  const words = title.trim().split(/\s+/);
  const highlight = words.length > 1;
  const heroStats = stats.slice(0, 3);
  const trust = Object.values(t.raw('trust') as Record<string, string>);
  const whatsapp = settings?.whatsapp
    ? whatsappLink(settings.whatsapp, settings.whatsapp_default_message)
    : '';

  /* بلا لقطة مشروع بجوار العنوان: كانت لقطة جوال داكنة ممدّدة تبدو فارغة، وتكرّر
     أول مشروع في «مشاريع مختارة» بعدها مباشرة. العنوان والوعود والزر أولًا،
     والدليل في قسم المشاريع. الارتفاع أقصر ليظهر بداية القسم التالي */
  return (
    <section className="hero-surface relative overflow-hidden border-b border-border">
      <Container className="relative py-14 sm:py-20">
        {/* الشاشة الواسعة: المحتوى في المنتصف — بلا لقطة بجواره كان نصفها الآخر فارغًا */}
        <div className="max-w-3xl lg:mx-auto lg:text-center">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1 text-sm font-medium text-primary backdrop-blur">
            <span className="inline-flex size-2 rounded-full bg-primary" aria-hidden="true" />
            {t('heroBadge')}
          </p>

          {/* كل كلمة تصعد من خلف قناع بالتتابع (مرة واحدة عند الدخول). الكلمة
              كاملة داخل قناعها فلا ينكسر وصل الحروف العربية، والهامش فوق/تحت
              القناع يحفظ الهمزات والنقاط من القص. النص في HTML من الخادم كما هو */}
          <h1 className="text-display font-bold [text-wrap:balance]">
            {words.map((word, index) => (
              <span key={index}>
                <span className="-my-[0.2em] inline-block overflow-hidden py-[0.2em] align-bottom">
                  <span
                    className={cn(
                      'inline-block motion-safe:animate-rise',
                      highlight && index === words.length - 1 && 'text-primary',
                    )}
                    style={{ animationDelay: `${80 + index * 70}ms` }}
                  >
                    {word}
                  </span>
                </span>
                {index < words.length - 1 ? ' ' : null}
              </span>
            ))}
          </h1>

          {subtitle ? (
            <p
              className="mt-6 max-w-prose text-body-lg text-muted motion-safe:animate-fade-up lg:mx-auto"
              style={{ animationDelay: `${words.length * 70 + 150}ms` }}
            >
              {subtitle}
            </p>
          ) : null}

          <div
            className="mt-8 flex flex-wrap gap-3 motion-safe:animate-fade-up lg:justify-center"
            style={{ animationDelay: `${words.length * 70 + 250}ms` }}
          >
            <ButtonLink href="/request-quote" size="lg">
              {section.cta_label || t('ctaPrimary')}
              <ArrowRight className="size-4 flip-rtl" aria-hidden="true" />
            </ButtonLink>
            {whatsapp ? (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-border-strong bg-surface px-6 font-medium text-foreground transition-colors hover:border-primary/50 hover:text-primary"
              >
                <WhatsAppIcon className="size-5 text-[#25D366]" />
                {t('ctaWhatsapp')}
              </a>
            ) : (
              <ButtonLink href="/projects" size="lg" variant="secondary">
                {t('ctaSecondary')}
              </ButtonLink>
            )}
          </div>

          {/* شريط الثقة: ثلاثة التزامات بلا بطاقات — إيقاع مختلف عن بقية الأقسام */}
          <ul
            aria-label={t('trustLabel')}
            style={{ animationDelay: `${words.length * 70 + 350}ms` }}
            className="motion-safe:animate-fade-up mt-10 flex flex-col gap-3 border-t border-border pt-6 text-sm font-medium sm:flex-row sm:flex-wrap sm:gap-x-8 lg:justify-center"
          >
            {trust.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                  <Check className="size-3.5" aria-hidden="true" />
                </span>
                {item}
              </li>
            ))}
          </ul>

          {/* أرقام من اللوحة فقط — تظهر حين تُفعَّل مؤشرات حقيقية */}
          {heroStats.length ? (
            <dl className="mt-8 flex flex-wrap gap-x-12 gap-y-5 lg:justify-center">
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
      </Container>
    </section>
  );
}

/** رابط «عرض الكل» نصي صغير على سطر العنوان — كان زرًا يأخذ سطرًا وحده على الجوال. */
async function ViewAll({ href, label }: { href: string; label?: string }) {
  const t = await getTranslations('common');
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
    >
      {label ?? t('viewAll')}
      <ArrowRight className="size-4 flip-rtl" aria-hidden="true" />
    </Link>
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
        action={<ViewAll href={basePath} />}
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
        action={<ViewAll href="/projects" />}
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
        action={<ViewAll href="/case-studies" />}
      />
      <CardGrid count={Math.min(caseStudies.length, limit)}>
        {caseStudies.slice(0, limit).map((caseStudy) => (
          <CaseStudyCard key={caseStudy.id} caseStudy={caseStudy} />
        ))}
      </CardGrid>
    </Section>
  );
}

/**
 * طريقة العمل على الرئيسية: ست خطوات بلغة العميل (ملف الترجمة)، لا مراحل
 * صفحة «طريقة العمل» بمصطلحاتها التقنية (ERD وUML) — العميل يشتري النتيجة.
 * كانت تعرض أول أربع مراحل فتنتهي عند «بناء الواجهات» دون تسليم ولا تدريب.
 */
export async function ProcessSection({ section, index }: SectionProps & { steps?: ProcessStep[] }) {
  const t = await getTranslations('common');
  const tHome = await getTranslations('home');
  const steps = Object.values(
    tHome.raw('processSteps') as Record<string, { title: string; body: string }>,
  );

  return (
    <Section tone="muted">
      <SectionHeader
        title={await resolveTitle(section)}
        subtitle={section.subtitle}
        index={index}
        action={<ViewAll href="/process" label={t('details')} />}
      />
      {/* مسار متصل (Flowing paths): خط أعلى كل خطوة يمتلئ بالتتابع حين يصل
          الزائر إلى القسم — ست خطوات تُقرأ رحلةً واحدة لا قائمة متفرقة */}
      <InView as="ol" className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((step, position) => (
          <li key={step.title} className="relative flex gap-4 pt-5">
            <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 overflow-hidden rounded-full bg-border">
              <span
                className="block h-full bg-primary ltr:origin-left rtl:origin-right motion-safe:scale-x-0 motion-safe:group-data-[shown=true]:animate-fill"
                style={{ animationDelay: `${position * 180}ms` }}
              />
            </span>
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-base font-semibold text-primary-foreground">
              {position + 1}
            </span>
            <div className="min-w-0">
              <h3 className="text-h3 font-semibold">{step.title}</h3>
              <p className="mt-1 text-base leading-relaxed text-muted">{step.body}</p>
            </div>
          </li>
        ))}
      </InView>
    </Section>
  );
}

/**
 * «اختر قطاعك»: الحلول بطاقات صغيرة (أيقونة + اسم) بعمودين على الجوال.
 * كانت ست بطاقات طويلة بعمود واحد، ثم ست خدمات تقنية مثلها — قرابة
 * شاشتين قبل أي دليل. الخدمات التقنية رابط نصي هنا وصفحتها كاملة.
 */
export async function SectorsSection({
  section,
  solutions,
  index,
}: SectionProps & { solutions: ServiceListItem[] }) {
  if (!solutions.length) return null;

  const tHome = await getTranslations('home');
  const limit = section.config?.limit ?? 6;

  return (
    <Section>
      <SectionHeader
        title={await resolveTitle(section)}
        subtitle={section.subtitle}
        index={index}
        action={<ViewAll href="/solutions" label={tHome('sectorsCta')} />}
      />
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {solutions.slice(0, limit).map((solution) => {
          const Icon = sectorIcon(solution.slug, solution.sector);
          return (
            <li key={solution.id}>
              <Link
                href={`/solutions/${solution.slug}`}
                // الجوال: الأيقونة فوق الاسم — بجانبه كان «منصات إدارة الجامعات
                // والكليات» يلتف على أربعة أسطر في نصف عرض الشاشة
                className="group/sector flex h-full flex-col items-start gap-3 rounded-xl border border-border bg-surface p-4 transition-colors duration-fast hover:border-primary/40 sm:flex-row sm:items-center sm:p-5"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 font-heading text-sm font-semibold leading-snug group-hover/sector:text-primary sm:text-base">
                  {solution.title}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-6 text-sm text-muted">
        <Link href="/services" className="font-medium text-primary hover:underline">
          {tHome('servicesLink')}
        </Link>
      </p>
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
        action={<ViewAll href="/technologies" />}
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
        action={<ViewAll href="/blog" />}
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
      {/* لوحة دعوة بتدرّج العلامة العميق ونص أبيض كامل: الوهج الشعاعي
          وطبقة hero-surface كانا يفتّحان الخلفية تحت النص فينخفض التباين */}
      <div className="relative overflow-hidden rounded-2xl bg-brand p-8 text-center shadow-elevated sm:p-14">
        <h2 className="text-h2 font-semibold text-white">{title}</h2>
        {section.subtitle ? (
          <p className="mx-auto mt-3 max-w-prose text-white">{section.subtitle}</p>
        ) : null}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink
            href="/request-quote"
            size="lg"
            className="bg-white text-brand-ink shadow-lg hover:bg-white/90"
          >
            {section.cta_label || t('ctaPrimary')}
            <ArrowRight className="size-4 flip-rtl" aria-hidden="true" />
          </ButtonLink>
        </div>

        {settings?.whatsapp ? (
          <p className="mt-4 inline-flex items-center gap-2 text-sm text-white">
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
          <span className="mb-4 grid size-11 place-items-center rounded-lg bg-primary-soft text-primary">
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

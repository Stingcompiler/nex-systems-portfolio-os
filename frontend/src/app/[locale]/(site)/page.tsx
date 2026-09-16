import { setRequestLocale } from 'next-intl/server';

import {
  CtaSection,
  HeroSection,
  NewsletterSection,
  PostsSection,
  ProcessSection,
  ProjectsSection,
  ServicesSection,
  TechnologiesSection,
  TestimonialsSection,
} from '@/components/sections/home';
import { JsonLd } from '@/components/ui/misc';
import {
  getFeaturedProjects,
  getLatestPosts,
  getProcessSteps,
  getSections,
  getServices,
  getSiteSettings,
  getSolutions,
  getStats,
  getTechnologies,
  getTestimonials,
} from '@/lib/api/queries';
import type { PageSection } from '@/lib/api/types';
import type { Locale } from '@/lib/i18n/routing';
import { organizationJsonLd, professionalServiceJsonLd, websiteJsonLd } from '@/lib/seo/json-ld';

const MIN_POSTS_ON_HOME = 3;

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  setRequestLocale(rawLocale);
  const locale = rawLocale as Locale;

  const [
    settings,
    sections,
    stats,
    services,
    solutions,
    projects,
    processSteps,
    technologies,
    testimonials,
    posts,
  ] = await Promise.all([
    getSiteSettings(locale),
    getSections(locale, 'home'),
    getStats(locale),
    getServices(locale, { page_size: 6 }),
    getSolutions(locale, { page_size: 6 }),
    getFeaturedProjects(locale),
    getProcessSteps(locale),
    getTechnologies(locale),
    getTestimonials(locale),
    getLatestPosts(locale),
  ]);

  const featuredTechnologies = technologies.results.filter((item) => item.is_featured);

  /**
   * كل قسم يقرر بنفسه أن يختفي عندما لا يوجد محتوى، فلا يظهر
   * عنوان قسم فوق فراغ. الترتيب والإظهار يأتيان من قاعدة البيانات.
   *
   * ثلاثة مفاتيح لا تُرسم على الرئيسية مهما كانت قيمتها في اللوحة:
   * - intro: جملة واحدة عن المالك لا تستحق قسمًا — صفحة «نبذة» تحملها.
   * - stats: البطل يعرض الأرقام نفسها قبله بشاشة واحدة.
   * - case_studies: تكرّر مشروعًا معروضًا في القسم السابق مباشرة؛
   *   بطاقة المشروع تحمل شارة «دراسة حالة» بدلًا من ذلك.
   */
  /**
   * أقسام المحتوى المرقّمة في سطر الجذب (01 · 02 · …). البطل والدعوة
   * والنشرة إطار للصفحة لا فصول فيها، فلا تحمل رقمًا.
   * الترقيم يُحسب من الأقسام التي ستُعرض فعلًا، فلا تظهر فجوة
   * (01، 02، 04) حين يُخفى قسم من اللوحة أو يُحجب لقلّة محتواه.
   */
  const NUMBERED_KEYS = new Set([
    'services',
    'solutions',
    'projects',
    'process',
    'technologies',
    'testimonials',
    'posts',
  ]);

  function willRender(section: PageSection) {
    if (!section.is_visible) return false;
    switch (section.key) {
      case 'services':
        return services.results.length > 0;
      case 'solutions':
        return solutions.results.length > 0;
      case 'projects':
        return projects.length > 0;
      case 'process':
        return processSteps.length > 0;
      case 'technologies':
        return featuredTechnologies.length > 0;
      case 'testimonials':
        return testimonials.results.length > 0;
      case 'posts':
        return posts.length >= MIN_POSTS_ON_HOME;
      default:
        return false;
    }
  }

  function renderSection(section: PageSection, index?: number) {
    if (!section.is_visible) return null;

    switch (section.key) {
      case 'hero':
        return <HeroSection section={section} settings={settings} stats={stats} locale={locale} />;
      case 'services':
        return (
          <ServicesSection
            section={section}
            services={services.results}
            basePath="/services"
            locale={locale}
            index={index}
          />
        );
      case 'solutions':
        return (
          <ServicesSection
            section={section}
            services={solutions.results}
            basePath="/solutions"
            tone="muted"
            locale={locale}
            index={index}
          />
        );
      case 'projects':
        return (
          <ProjectsSection section={section} projects={projects} locale={locale} index={index} />
        );
      case 'process':
        return (
          <ProcessSection section={section} steps={processSteps} locale={locale} index={index} />
        );
      case 'technologies':
        return (
          <TechnologiesSection
            section={section}
            technologies={featuredTechnologies}
            locale={locale}
            index={index}
          />
        );
      case 'testimonials':
        return (
          <TestimonialsSection
            section={section}
            testimonials={testimonials.results}
            locale={locale}
            index={index}
          />
        );
      case 'cta':
        return <CtaSection section={section} settings={settings} locale={locale} />;
      case 'posts':
        // مقال واحد أو اثنان تحت عنوان «أحدث المقالات» يعلنان أن المدونة مهجورة —
        // القسم يظهر حين يوجد ما يكفي ليبدو مدونةً فعلًا
        return posts.length >= MIN_POSTS_ON_HOME ? (
          <PostsSection section={section} posts={posts} locale={locale} index={index} />
        ) : null;
      case 'newsletter':
        return <NewsletterSection section={section} locale={locale} />;
      case 'intro':
      case 'stats':
      case 'case_studies':
      default:
        return null;
    }
  }

  let chapter = 0;

  return (
    <>
      <JsonLd data={websiteJsonLd(settings, locale)} />
      <JsonLd data={organizationJsonLd(settings, locale)} />
      <JsonLd data={professionalServiceJsonLd(settings, locale)} />

      {sections.map((section) => {
        const numbered = NUMBERED_KEYS.has(section.key) && willRender(section);
        const index = numbered ? ++chapter : undefined;
        return <div key={section.id}>{renderSection(section, index)}</div>;
      })}
    </>
  );
}

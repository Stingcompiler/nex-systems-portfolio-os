import type {
  CaseStudyDetail,
  Faq,
  PostDetail,
  ProjectDetail,
  ServiceDetail,
  SiteSettings,
} from '@/lib/api/types';
import type { Locale } from '@/lib/i18n/routing';
import { absoluteUrl } from '@/lib/seo/metadata';

type Json = Record<string, unknown>;

export function websiteJsonLd(settings: SiteSettings | null, locale: Locale): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: settings?.site_name || 'NEXA SYSTEMS',
    url: absoluteUrl(`/${locale}`),
    inLanguage: locale,
    description: settings?.tagline || undefined,
  };
}

export function organizationJsonLd(settings: SiteSettings | null, locale: Locale): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: settings?.site_name || 'NEXA SYSTEMS',
    url: absoluteUrl(`/${locale}`),
    logo: settings?.logo_light?.url ? absoluteUrl(settings.logo_light.url) : undefined,
    email: settings?.email || undefined,
    telephone: settings?.phone || undefined,
    sameAs: settings?.social_links?.map((link) => link.url) ?? undefined,
    address: settings?.city
      ? {
          '@type': 'PostalAddress',
          addressLocality: settings.city,
          addressCountry: settings.country || undefined,
        }
      : undefined,
  };
}

export function personJsonLd(
  settings: SiteSettings | null,
  locale: Locale,
  skills: string[] = [],
): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: settings?.owner_name || settings?.site_name || 'NEXA SYSTEMS',
    jobTitle: settings?.owner_title || undefined,
    description: settings?.owner_bio || undefined,
    url: absoluteUrl(`/${locale}/about`),
    image: settings?.owner_photo?.url ? absoluteUrl(settings.owner_photo.url) : undefined,
    knowsAbout: skills.length ? skills : undefined,
    email: settings?.email || undefined,
    sameAs: settings?.social_links?.map((link) => link.url) ?? undefined,
  };
}

export function professionalServiceJsonLd(
  settings: SiteSettings | null,
  locale: Locale,
): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: settings?.site_name || 'NEXA SYSTEMS',
    description: settings?.tagline || undefined,
    url: absoluteUrl(`/${locale}`),
    email: settings?.email || undefined,
    telephone: settings?.phone || undefined,
    areaServed: 'Worldwide',
    availableLanguage: ['ar', 'en'],
  };
}

export function serviceJsonLd(
  service: ServiceDetail,
  settings: SiteSettings | null,
  locale: Locale,
  kind: 'services' | 'solutions',
): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.title,
    description: service.short_description,
    url: absoluteUrl(`/${locale}/${kind}/${service.slug}`),
    serviceType: service.sector_display,
    provider: {
      '@type': 'Organization',
      name: settings?.site_name || 'NEXA SYSTEMS',
      url: absoluteUrl(`/${locale}`),
    },
    areaServed: 'Worldwide',
    ...(service.price_from
      ? {
          offers: {
            '@type': 'Offer',
            price: service.price_from,
            priceCurrency: service.price_currency || 'USD',
          },
        }
      : {}),
  };
}

export function creativeWorkJsonLd(project: ProjectDetail, locale: Locale): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: project.title,
    description: project.summary,
    url: absoluteUrl(`/${locale}/projects/${project.slug}`),
    dateCreated: project.completed_at || undefined,
    image: project.cover_image?.url ? absoluteUrl(project.cover_image.url) : undefined,
    keywords: project.technologies.map((technology) => technology.name).join(', '),
  };
}

export function articleJsonLd(
  caseStudy: CaseStudyDetail,
  settings: SiteSettings | null,
  locale: Locale,
): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: caseStudy.title,
    description: caseStudy.overview,
    url: absoluteUrl(`/${locale}/case-studies/${caseStudy.slug}`),
    datePublished: caseStudy.published_at || undefined,
    inLanguage: locale,
    author: {
      '@type': 'Person',
      name: settings?.owner_name || settings?.site_name || 'NEXA SYSTEMS',
    },
    image: caseStudy.project?.cover_image?.url
      ? absoluteUrl(caseStudy.project.cover_image.url)
      : undefined,
  };
}

export function articleFromPostJsonLd(
  post: PostDetail,
  settings: SiteSettings | null,
  locale: Locale,
): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    url: absoluteUrl(`/${locale}/blog/${post.slug}`),
    datePublished: post.published_at || undefined,
    inLanguage: locale,
    wordCount: undefined,
    author: {
      '@type': 'Person',
      name: post.author_name || settings?.owner_name || settings?.site_name || 'NEXA SYSTEMS',
    },
    publisher: {
      '@type': 'Organization',
      name: settings?.site_name || 'NEXA SYSTEMS',
    },
    image: post.cover_image?.url ? absoluteUrl(post.cover_image.url) : undefined,
    articleSection: post.category?.name || undefined,
    keywords: post.tags.map((tag) => tag.name).join(', ') || undefined,
  };
}

export function faqJsonLd(faqs: Faq[]): Json | null {
  if (!faqs.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };
}

export function breadcrumbJsonLd(
  items: { name: string; path: string }[],
  locale: Locale,
): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(`/${locale}${item.path === '/' ? '' : item.path}`),
    })),
  };
}

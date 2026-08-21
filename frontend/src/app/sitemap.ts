import type { MetadataRoute } from 'next';

import {
  getCaseStudies,
  getPostSlugs,
  getProjects,
  getServiceSlugs,
} from '@/lib/api/queries';
import { locales } from '@/lib/i18n/routing';
import { absoluteUrl } from '@/lib/seo/metadata';

/** الصفحات الثابتة مع أولويتها ودورية تغيّرها. */
const STATIC_PAGES: { path: string; priority: number; changeFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly' }[] = [
  { path: '', priority: 1, changeFrequency: 'weekly' },
  { path: '/services', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/solutions', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/projects', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/case-studies', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/blog', priority: 0.8, changeFrequency: 'daily' },
  { path: '/process', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/technologies', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/about', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.8, changeFrequency: 'yearly' },
];

/** يبني مدخلًا لكل لغة مع روابط بديلة hreflang. */
function entriesFor(
  path: string,
  options: { priority?: number; changeFrequency?: MetadataRoute.Sitemap[number]['changeFrequency']; lastModified?: string | null } = {},
): MetadataRoute.Sitemap {
  const languages: Record<string, string> = {};
  for (const locale of locales) {
    languages[locale] = absoluteUrl(`/${locale}${path}`);
  }

  return locales.map((locale) => ({
    url: absoluteUrl(`/${locale}${path}`),
    lastModified: options.lastModified ? new Date(options.lastModified) : new Date(),
    changeFrequency: options.changeFrequency,
    priority: options.priority,
    alternates: { languages },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [services, solutions, projects, caseStudies, posts] = await Promise.all([
    getServiceSlugs('services'),
    getServiceSlugs('solutions'),
    getProjects('ar', { page_size: 200 }),
    getCaseStudies('ar', { page_size: 200 }),
    getPostSlugs(),
  ]);

  return [
    ...STATIC_PAGES.flatMap((page) =>
      entriesFor(page.path, {
        priority: page.priority,
        changeFrequency: page.changeFrequency,
      }),
    ),
    ...services.results.flatMap((service) =>
      entriesFor(`/services/${service.slug}`, { priority: 0.8, changeFrequency: 'monthly' }),
    ),
    ...solutions.results.flatMap((solution) =>
      entriesFor(`/solutions/${solution.slug}`, { priority: 0.8, changeFrequency: 'monthly' }),
    ),
    ...projects.results.flatMap((project) =>
      entriesFor(`/projects/${project.slug}`, { priority: 0.7, changeFrequency: 'monthly' }),
    ),
    ...caseStudies.results.flatMap((caseStudy) =>
      entriesFor(`/case-studies/${caseStudy.slug}`, {
        priority: 0.7,
        changeFrequency: 'yearly',
        lastModified: caseStudy.published_at,
      }),
    ),
    ...posts.results.flatMap((post) =>
      entriesFor(`/blog/${post.slug}`, {
        priority: 0.6,
        changeFrequency: 'monthly',
        lastModified: post.published_at,
      }),
    ),
  ];
}

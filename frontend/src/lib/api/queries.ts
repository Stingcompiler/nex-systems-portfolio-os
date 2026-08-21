import { apiGet, apiGetSafe } from '@/lib/api/server';
import type {
  CaseStudyDetail,
  CaseStudyListItem,
  Category,
  Certification,
  Education,
  Experience,
  Faq,
  PageSection,
  Paginated,
  PostDetail,
  PostListItem,
  ProcessStep,
  ProjectDetail,
  ProjectListItem,
  SeoSettings,
  ServiceDetail,
  ServiceListItem,
  SiteSettings,
  Stat,
  Tag,
  Technology,
  Testimonial,
} from '@/lib/api/types';
import type { Locale } from '@/lib/i18n/routing';

/** وسوم التخزين المؤقت — تستخدمها لوحة التحكم لإبطال محتوى بعينه. */
export const CacheTags = {
  settings: 'settings',
  sections: 'sections',
  services: 'services',
  projects: 'projects',
  caseStudies: 'case-studies',
  technologies: 'technologies',
  testimonials: 'testimonials',
  resume: 'resume',
  posts: 'posts',
} as const;

const EMPTY_PAGE = { count: 0, total_pages: 0, current_page: 1, page_size: 0, next: null, previous: null, results: [] };

function emptyPage<T>(): Paginated<T> {
  return EMPTY_PAGE as Paginated<T>;
}

// --------------------------------------------------------------- الإعدادات

export function getSiteSettings(locale: Locale) {
  return apiGetSafe<SiteSettings | null>(
    'settings/',
    { locale, revalidate: 600, tags: [CacheTags.settings] },
    null,
  );
}

export function getSeoSettings(locale: Locale) {
  return apiGetSafe<SeoSettings | null>(
    'settings/seo/',
    { locale, revalidate: 3600, tags: [CacheTags.settings] },
    null,
  );
}

export function getSections(locale: Locale, page = 'home') {
  return apiGetSafe<PageSection[]>(
    'sections/',
    { locale, searchParams: { page }, revalidate: 300, tags: [CacheTags.sections] },
    [],
  );
}

export function getStats(locale: Locale) {
  return apiGetSafe<Stat[]>(
    'stats/',
    { locale, revalidate: 600, tags: [CacheTags.settings] },
    [],
  );
}

export function getProcessSteps(locale: Locale) {
  return apiGetSafe<ProcessStep[]>(
    'process-steps/',
    { locale, revalidate: 3600, tags: [CacheTags.settings] },
    [],
  );
}

export function getFaqs(locale: Locale, scope?: string) {
  return apiGetSafe<Faq[]>(
    'faqs/',
    { locale, searchParams: { scope }, revalidate: 3600, tags: [CacheTags.settings] },
    [],
  );
}

// --------------------------------------------------------------- الخدمات والحلول

interface ServiceQuery {
  sector?: string;
  technology?: string;
  search?: string;
  is_featured?: boolean;
  page?: number;
  page_size?: number;
}

function serviceList(kind: 'services' | 'solutions', locale: Locale, query: ServiceQuery = {}) {
  return apiGetSafe<Paginated<ServiceListItem>>(
    `${kind}/`,
    { locale, searchParams: { ...query }, revalidate: 600, tags: [CacheTags.services] },
    emptyPage<ServiceListItem>(),
  );
}

export const getServices = (locale: Locale, query?: ServiceQuery) =>
  serviceList('services', locale, query);

export const getSolutions = (locale: Locale, query?: ServiceQuery) =>
  serviceList('solutions', locale, query);

export function getService(kind: 'services' | 'solutions', locale: Locale, slug: string) {
  return apiGet<ServiceDetail>(`${kind}/${slug}/`, {
    locale,
    revalidate: 600,
    tags: [CacheTags.services, `service:${slug}`],
  });
}

export function getServiceSlugs(kind: 'services' | 'solutions') {
  return apiGetSafe<Paginated<ServiceListItem>>(
    `${kind}/`,
    { locale: 'ar', searchParams: { page_size: 100 }, revalidate: 3600 },
    emptyPage<ServiceListItem>(),
  );
}

// --------------------------------------------------------------- المشاريع

interface ProjectQuery {
  sector?: string;
  project_type?: string;
  technology?: string;
  search?: string;
  is_featured?: boolean;
  page?: number;
  page_size?: number;
}

export function getProjects(locale: Locale, query: ProjectQuery = {}) {
  return apiGetSafe<Paginated<ProjectListItem>>(
    'projects/',
    { locale, searchParams: { ...query }, revalidate: 600, tags: [CacheTags.projects] },
    emptyPage<ProjectListItem>(),
  );
}

export function getFeaturedProjects(locale: Locale) {
  return apiGetSafe<ProjectListItem[]>(
    'projects/featured/',
    { locale, revalidate: 600, tags: [CacheTags.projects] },
    [],
  );
}

export function getProject(locale: Locale, slug: string) {
  return apiGet<ProjectDetail>(`projects/${slug}/`, {
    locale,
    revalidate: 600,
    tags: [CacheTags.projects, `project:${slug}`],
  });
}

// --------------------------------------------------------------- دراسات الحالة

export function getCaseStudies(locale: Locale, query: { page?: number; page_size?: number } = {}) {
  return apiGetSafe<Paginated<CaseStudyListItem>>(
    'case-studies/',
    { locale, searchParams: { ...query }, revalidate: 600, tags: [CacheTags.caseStudies] },
    emptyPage<CaseStudyListItem>(),
  );
}

export function getCaseStudy(locale: Locale, slug: string) {
  return apiGet<CaseStudyDetail>(`case-studies/${slug}/`, {
    locale,
    revalidate: 600,
    tags: [CacheTags.caseStudies, `case-study:${slug}`],
  });
}

// --------------------------------------------------------------- بقية المحتوى

export function getTechnologies(locale: Locale, query: { category?: string } = {}) {
  return apiGetSafe<Paginated<Technology>>(
    'technologies/',
    {
      locale,
      searchParams: { page_size: 100, ...query },
      revalidate: 3600,
      tags: [CacheTags.technologies],
    },
    emptyPage<Technology>(),
  );
}

export function getTestimonials(locale: Locale) {
  return apiGetSafe<Paginated<Testimonial>>(
    'testimonials/',
    { locale, revalidate: 600, tags: [CacheTags.testimonials] },
    emptyPage<Testimonial>(),
  );
}

export function getExperiences(locale: Locale) {
  return apiGetSafe<Paginated<Experience>>(
    'experiences/',
    { locale, revalidate: 3600, tags: [CacheTags.resume] },
    emptyPage<Experience>(),
  );
}

export function getEducation(locale: Locale) {
  return apiGetSafe<Paginated<Education>>(
    'education/',
    { locale, revalidate: 3600, tags: [CacheTags.resume] },
    emptyPage<Education>(),
  );
}

export function getCertifications(locale: Locale) {
  return apiGetSafe<Paginated<Certification>>(
    'certifications/',
    { locale, revalidate: 3600, tags: [CacheTags.resume] },
    emptyPage<Certification>(),
  );
}

// --------------------------------------------------------------- المدونة

interface PostQuery {
  category?: string;
  tag?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export function getPosts(locale: Locale, query: PostQuery = {}) {
  return apiGetSafe<Paginated<PostListItem>>(
    'posts/',
    { locale, searchParams: { ...query }, revalidate: 300, tags: [CacheTags.posts] },
    emptyPage<PostListItem>(),
  );
}

export function getLatestPosts(locale: Locale) {
  return apiGetSafe<PostListItem[]>(
    'posts/latest/',
    { locale, revalidate: 300, tags: [CacheTags.posts] },
    [],
  );
}

export function getPopularPosts(locale: Locale) {
  return apiGetSafe<PostListItem[]>(
    'posts/popular/',
    { locale, revalidate: 600, tags: [CacheTags.posts] },
    [],
  );
}

export function getPost(locale: Locale, slug: string) {
  return apiGet<PostDetail>(`posts/${slug}/`, {
    locale,
    revalidate: 300,
    tags: [CacheTags.posts, `post:${slug}`],
  });
}

export function getPostSlugs() {
  return apiGetSafe<Paginated<PostListItem>>(
    'posts/',
    { locale: 'ar', searchParams: { page_size: 200 }, revalidate: 3600 },
    emptyPage<PostListItem>(),
  );
}

export function getCategories(locale: Locale) {
  return apiGetSafe<Category[]>(
    'categories/',
    { locale, revalidate: 3600, tags: [CacheTags.posts] },
    [],
  );
}

export function getTags(locale: Locale) {
  return apiGetSafe<Tag[]>(
    'tags/',
    { locale, revalidate: 3600, tags: [CacheTags.posts] },
    [],
  );
}

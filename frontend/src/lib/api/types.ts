/** أنواع مطابقة لمسلسلات الـ API العامة. */

export interface Paginated<T> {
  count: number;
  total_pages: number;
  current_page: number;
  page_size: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface MediaRef {
  id: number;
  url: string;
  thumbnail_url: string;
  alt: string;
  width: number | null;
  height: number | null;
}

export interface SeoPayload {
  title: string;
  description: string;
  image: MediaRef | null;
}

export interface SocialLink {
  id: number;
  platform: string;
  platform_display: string;
  label: string;
  url: string;
  display_order: number;
}

export interface SiteSettings {
  site_name: string;
  tagline: string;
  logo_light: MediaRef | null;
  logo_dark: MediaRef | null;
  favicon: MediaRef | null;
  owner_name: string;
  owner_title: string;
  owner_bio: string;
  owner_photo: MediaRef | null;
  cv_ar: MediaRef | null;
  cv_en: MediaRef | null;
  email: string;
  phone: string;
  whatsapp: string;
  whatsapp_default_message: string;
  address: string;
  country: string;
  city: string;
  default_language: string;
  default_theme: string;
  currency: string;
  maintenance_mode: boolean;
  maintenance_message: string;
  analytics_provider: string;
  analytics_site_id: string;
  analytics_script_url: string;
  social_links: SocialLink[];
}

export interface SeoSettings {
  default_seo_title: string;
  default_seo_description: string;
  default_og_image: MediaRef | null;
  twitter_handle: string;
  google_verification: string;
  bing_verification: string;
}

export type SectionKey =
  | 'hero'
  | 'intro'
  | 'stats'
  | 'services'
  | 'solutions'
  | 'projects'
  | 'case_studies'
  | 'process'
  | 'technologies'
  | 'testimonials'
  | 'posts'
  | 'newsletter'
  | 'cta';

export interface PageSection {
  id: number;
  page: string;
  key: SectionKey;
  title: string;
  subtitle: string;
  cta_label: string;
  cta_url: string;
  image: MediaRef | null;
  is_visible: boolean;
  display_order: number;
  config: { limit?: number; [key: string]: unknown };
}

export interface Stat {
  id: number;
  label: string;
  value: string;
  suffix: string;
  icon: string;
  display_order: number;
}

export interface Faq {
  id: number;
  question: string;
  answer: string;
  scope: string;
  service: number | null;
  display_order: number;
}

export interface ProcessStep {
  id: number;
  title: string;
  description: string;
  duration: string;
  icon: string;
  deliverables: string[];
  display_order: number;
}

export interface Technology {
  id: number;
  name: string;
  slug: string;
  category: string;
  category_display: string;
  description: string;
  icon: string;
  color: string;
  proficiency: number;
  is_featured: boolean;
}

export interface TechnologyRef {
  id: number;
  name: string;
  slug: string;
  category: string;
  icon: string;
  color: string;
}

export interface ServiceFeature {
  title: string;
  description: string;
  icon: string;
}

export interface ServiceListItem {
  id: number;
  kind: 'service' | 'solution';
  sector: string;
  sector_display: string;
  title: string;
  slug: string;
  short_description: string;
  icon: string;
  cover_image: MediaRef | null;
  price_from: string | null;
  price_currency: string;
  is_featured: boolean;
  display_order: number;
}

export interface ServiceDetail extends ServiceListItem {
  description: string;
  price_note: string;
  duration_estimate: string;
  features: ServiceFeature[];
  deliverables: string[];
  technologies: TechnologyRef[];
  related_projects: ProjectListItem[];
  faqs: Faq[];
  view_count: number;
  seo: SeoPayload;
  published_at: string | null;
}

export interface ProjectListItem {
  id: number;
  title: string;
  slug: string;
  summary: string;
  cover_image: MediaRef | null;
  sector: string;
  sector_display: string;
  project_type: string;
  project_type_display: string;
  status: string;
  technologies: TechnologyRef[];
  client_name: string;
  completed_at: string | null;
  is_featured: boolean;
  has_case_study: boolean;
  live_url: string;
}

export interface ProjectImage {
  id: number;
  image: MediaRef;
  caption: string;
  display_order: number;
}

export interface ProjectDetail extends ProjectListItem {
  description: string;
  images: ProjectImage[];
  video_url: string;
  github_url: string;
  play_store_url: string;
  app_store_url: string;
  case_study_slug: string | null;
  view_count: number;
  seo: SeoPayload;
  published_at: string | null;
}

export interface Testimonial {
  id: number;
  client_name: string;
  client_title: string;
  company: string;
  content: string;
  rating: number;
  avatar: MediaRef | null;
  project: number | null;
  proof_url: string;
  is_featured: boolean;
}

export interface CaseStudyListItem {
  id: number;
  title: string;
  slug: string;
  overview: string;
  project: ProjectListItem;
  published_at: string | null;
}

export interface CaseStudyPhase {
  title: string;
  description: string;
  duration?: string;
}

export interface CaseStudyMetric {
  label: string;
  value: string;
  suffix?: string;
}

export interface CaseStudyDetail extends CaseStudyListItem {
  problem: string;
  requirements: string;
  challenges: string;
  solution: string;
  architecture: string;
  results: string;
  lessons: string;
  development_phases: CaseStudyPhase[];
  metrics: CaseStudyMetric[];
  diagram_image: MediaRef | null;
  testimonial: Testimonial | null;
  related_services: ServiceListItem[];
  view_count: number;
  seo: SeoPayload;
}

export interface Experience {
  id: number;
  title: string;
  organization: string;
  location: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  description: string;
}

export interface Education {
  id: number;
  degree: string;
  institution: string;
  field: string;
  start_date: string | null;
  end_date: string | null;
  description: string;
}

export interface Certification {
  id: number;
  name: string;
  issuer: string;
  issue_date: string | null;
  expiry_date: string | null;
  credential_id: string;
  credential_url: string;
  image: MediaRef | null;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  color: string;
  post_count: number;
  display_order: number;
}

export interface Tag {
  id: number;
  name: string;
  slug: string;
  usage_count: number;
}

export interface PostListItem {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  cover_image: MediaRef | null;
  category: Category | null;
  tags: Tag[];
  author_name: string;
  reading_time: number;
  view_count: number;
  is_featured: boolean;
  published_at: string | null;
}

export interface PostDetail extends PostListItem {
  content: string;
  allow_comments: boolean;
  related_posts: PostListItem[];
  is_saved: boolean;
  seo: SeoPayload;
}

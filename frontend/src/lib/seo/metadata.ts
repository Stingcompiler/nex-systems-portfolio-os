import type { Metadata } from 'next';

import type { SeoSettings, SiteSettings } from '@/lib/api/types';
import { locales, type Locale } from '@/lib/i18n/routing';

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
).replace(/\/$/, '');

export function absoluteUrl(path = ''): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

interface BuildMetadataInput {
  locale: Locale;
  /** المسار بلا بادئة اللغة، مثل `/services/web-development` */
  path: string;
  title: string;
  description?: string;
  image?: string | null;
  type?: 'website' | 'article';
  publishedTime?: string | null;
  settings?: SiteSettings | null;
  seoSettings?: SeoSettings | null;
  noIndex?: boolean;
}

/**
 * يبني الوسوم الكاملة لصفحة واحدة: canonical و hreflang و Open Graph
 * و Twitter Card، مع ارتداد إلى إعدادات SEO العامة عند نقص أي حقل.
 */
export function buildMetadata({
  locale,
  path,
  title,
  description,
  image,
  type = 'website',
  publishedTime,
  settings,
  seoSettings,
  noIndex = false,
}: BuildMetadataInput): Metadata {
  const siteName = settings?.site_name || 'NEXA SYSTEMS';
  const fullTitle = title === siteName ? title : `${title} | ${siteName}`;
  const resolvedDescription =
    description?.trim() || seoSettings?.default_seo_description || settings?.tagline || '';
  const resolvedImage = image || seoSettings?.default_og_image?.url || null;

  const cleanPath = path === '/' ? '' : path.replace(/\/$/, '');
  const canonical = absoluteUrl(`/${locale}${cleanPath}`);

  const languages: Record<string, string> = {};
  for (const alternate of locales) {
    languages[alternate] = absoluteUrl(`/${alternate}${cleanPath}`);
  }
  // x-default يشير إلى العربية لأنها اللغة الافتراضية للمنصة
  languages['x-default'] = absoluteUrl(`/ar${cleanPath}`);

  return {
    title: fullTitle,
    description: resolvedDescription,
    metadataBase: new URL(SITE_URL),
    alternates: { canonical, languages },
    robots: noIndex ? { index: false, follow: false } : undefined,
    openGraph: {
      type,
      url: canonical,
      title: fullTitle,
      description: resolvedDescription,
      siteName,
      locale: locale === 'ar' ? 'ar_AR' : 'en_US',
      images: resolvedImage ? [{ url: absoluteUrl(resolvedImage) }] : undefined,
      ...(publishedTime ? { publishedTime } : {}),
    },
    twitter: {
      card: resolvedImage ? 'summary_large_image' : 'summary',
      title: fullTitle,
      description: resolvedDescription,
      site: seoSettings?.twitter_handle || undefined,
      images: resolvedImage ? [absoluteUrl(resolvedImage)] : undefined,
    },
    verification: {
      google: seoSettings?.google_verification || undefined,
      other: seoSettings?.bing_verification
        ? { 'msvalidate.01': seoSettings.bing_verification }
        : undefined,
    },
  };
}

import type { Metadata } from 'next';

import type { MediaRef, SeoSettings, SiteSettings } from '@/lib/api/types';
import { locales, type Locale } from '@/lib/i18n/routing';
import { SITE_NAME_FALLBACK } from '@/lib/constants/site';

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
/**
 * صورة المشاركة الافتراضية من اللوحة — بشرط أن تكون بطاقة مشاركة فعلًا.
 *
 * رُفع سابقًا الشعار الخام (مربّع، 1MB) في هذا الحقل فظهر مقصوصًا في
 * واتساب وX. تُقبل الصورة الأفقية بعرض 600px فأكثر ونسبة قريبة من 1.91:1،
 * وغير ذلك يُتجاهل فتبقى البطاقة المولّدة بالشعار والعنوان.
 */
function shareCard(media: MediaRef | null | undefined) {
  if (!media?.url || !media.width || !media.height) return null;
  const ratio = media.width / media.height;
  if (media.width < 600 || ratio < 1.5 || ratio > 2.2) return null;
  return { url: media.url, size: { width: media.width, height: media.height } };
}

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
  const siteName = settings?.site_name || SITE_NAME_FALLBACK;
  const fullTitle = title === siteName ? title : `${title} | ${siteName}`;
  const resolvedDescription =
    description?.trim() || seoSettings?.default_seo_description || settings?.tagline || '';
  // صورة الصفحة إن وُجدت، ثم صورة المشاركة الافتراضية من اللوحة إن كانت
  // بطاقة صالحة، وإلا بطاقة اللغة المولّدة (scripts/generate-og.py).
  const fallback = shareCard(seoSettings?.default_og_image);
  const resolvedImage = image || fallback?.url || `/og/${locale}.png`;
  const imageSize = !image && fallback ? fallback.size : { width: 1200, height: 630 };

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
      images: [{ url: absoluteUrl(resolvedImage), ...imageSize }],
      ...(publishedTime ? { publishedTime } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: resolvedDescription,
      site: seoSettings?.twitter_handle || undefined,
      images: [absoluteUrl(resolvedImage)],
    },
    verification: {
      google: seoSettings?.google_verification || undefined,
      other: seoSettings?.bing_verification
        ? { 'msvalidate.01': seoSettings.bing_verification }
        : undefined,
    },
  };
}

import { notFound } from 'next/navigation';

import { getCaseStudy, getProject, getService } from '@/lib/api/queries';
import { ApiError } from '@/lib/api/server';
import type { Locale } from '@/lib/i18n/routing';

/**
 * صفحات التفاصيل: 404 من الـ API تعني صفحة غير موجودة (أو مسودة)،
 * وأي خطأ آخر يُترك ليصعد إلى حدود الخطأ فيظهر للزائر كخلل مؤقت لا كصفحة مفقودة.
 */
async function loadOr404<T>(loader: () => Promise<T>): Promise<T> {
  try {
    return await loader();
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) {
      notFound();
    }
    throw error;
  }
}

export function loadService(
  kind: 'services' | 'solutions',
  locale: Locale,
  slug: string,
) {
  return loadOr404(() => getService(kind, locale, slug));
}

export function loadProject(locale: Locale, slug: string) {
  return loadOr404(() => getProject(locale, slug));
}

export function loadCaseStudy(locale: Locale, slug: string) {
  return loadOr404(() => getCaseStudy(locale, slug));
}

/**
 * نسخ لـ `generateMetadata` تعيد `null` بدل استدعاء notFound().
 *
 * السبب: استدعاء notFound() داخل generateMetadata يعرض صفحة 404 لكنه
 * يترك رمز الاستجابة 200، فتُفهرَس صفحة غير موجودة. تحديد الحالة يجب أن
 * يبقى في مكوّن الصفحة وحده.
 */
async function findOrNull<T>(loader: () => Promise<T>): Promise<T | null> {
  try {
    return await loader();
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) {
      return null;
    }
    throw error;
  }
}

export function findService(
  kind: 'services' | 'solutions',
  locale: Locale,
  slug: string,
) {
  return findOrNull(() => getService(kind, locale, slug));
}

export function findProject(locale: Locale, slug: string) {
  return findOrNull(() => getProject(locale, slug));
}

export function findCaseStudy(locale: Locale, slug: string) {
  return findOrNull(() => getCaseStudy(locale, slug));
}

/** وسوم صفحة غير موجودة — لا تُفهرس ولا تُتبع. */
export const NOT_FOUND_METADATA = {
  robots: { index: false, follow: false },
} as const;

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { notFoundMetadata } from '@/lib/api/detail';

/**
 * أي مسار تحت اللغة لا يطابق صفحة: بدون هذا الملف كان Next يعرض صفحة 404
 * الافتراضية بالإنجليزية ("This page could not be found") بدل صفحة الموقع
 * المترجمة في `[locale]/not-found.tsx`. النمط الموصى به في next-intl.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return notFoundMetadata(locale);
}

export default function CatchAllNotFound() {
  notFound();
}

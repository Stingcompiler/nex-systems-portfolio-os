import type { MetadataRoute } from 'next';

import { absoluteUrl } from '@/lib/seo/metadata';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // لوحة التحكم وصفحات العضو والـ API لا تُفهرس إطلاقًا
        disallow: [
          '/api/', '/dashboard/', '/admin/',
          '/ar/member/', '/en/member/',
          '/ar/newsletter/', '/en/newsletter/',
          // صفحات المتابعة برموز سرية؛ «/ar/track» نفسها (البحث) تبقى متاحة
          '/ar/track/', '/en/track/',
        ],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: absoluteUrl(''),
  };
}

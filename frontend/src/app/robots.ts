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
        ],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: absoluteUrl(''),
  };
}

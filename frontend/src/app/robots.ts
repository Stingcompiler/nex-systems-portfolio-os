import type { MetadataRoute } from 'next';

import { absoluteUrl } from '@/lib/seo/metadata';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // لوحة التحكم وصفحات العضو والـ API لا تُفهرس إطلاقًا
        disallow: ['/api/', '/dashboard/', '/ar/member/', '/en/member/', '/admin/'],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: absoluteUrl(''),
  };
}

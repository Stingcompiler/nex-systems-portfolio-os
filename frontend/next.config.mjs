import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/request.ts');

/**
 * المفاتيح التي تحتاجها الواجهة فقط.
 *
 * الإعدادات موحّدة في ملف `.env` واحد بجذر المستودع، لكن لا يُحمَّل منه
 * إلا هذه المفاتيح: مفتاح Django السري وكلمة مرور قاعدة البيانات وبيانات
 * SMTP يجب ألا تدخل عملية Node أصلًا.
 */
const FRONTEND_ENV_KEYS = [
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_API_URL',
  'INTERNAL_API_URL',
  'BACKEND_ORIGIN',
  'REVALIDATE_SECRET',
];

function loadRootEnv() {
  const here = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(here, '..', '.env');
  if (!existsSync(envPath)) return;

  for (const rawLine of readFileSync(envPath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    if (!FRONTEND_ENV_KEYS.includes(key)) continue;
    // متغيّر معرّف مسبقًا في البيئة يتقدّم على الملف
    if (process.env[key] !== undefined) continue;

    process.env[key] = line
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
  }
}

loadRootEnv();

const backendOrigin = process.env.BACKEND_ORIGIN ?? 'http://127.0.0.1:8000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // خادم Django التطويري (المستخدم وقت البناء المحلي) أحادي الخيط عمليًا،
  // فتقييد تزامن التوليد الثابت يمنع إغراقه. الإنتاج يبني خلف gunicorn
  // متعدد العمّال فلا يتأثر بهذا السقف.
  experimental: {
    staticGenerationMaxConcurrency: 8,
    staticGenerationRetryCount: 3,
    // يستورد أيقونات lucide المستخدمة فقط بدل حزمة الأيقونات كاملة —
    // يقلّل عدد الوحدات المُترجَمة لكل مسار في التطوير والإنتاج معًا.
    optimizePackageImports: ['lucide-react'],
  },

  // مسارات Django تنتهي بشرطة مائلة. إعادة التوجيه التلقائية في Next كانت
  // تحوّل /api/v1/health/ إلى /api/v1/health قبل إعادة الكتابة، فينكسر
  // النداء (وطلبات POST خاصة لا يعالجها APPEND_SLASH في Django).
  // إعادة توجيه صفحات الموقع تتم في middleware بدلًا من ذلك.
  skipTrailingSlashRedirect: true,

  // مبدأ الأصل الواحد: المتصفح لا يعرف إلا نطاق Next.js.
  // في الإنتاج يقوم Nginx بنفس التوجيه، فسلوك التطوير مطابق للإنتاج.
  async rewrites() {
    return [
      // الشرطة المائلة تُعاد صراحةً: Next يجرّدها من المسار قبل إعادة الكتابة،
      // فيصل Django مسارًا ناقصًا ويردّ بتحويل 301 يكسر النداء.
      { source: '/api/:path*', destination: `${backendOrigin}/api/:path*/` },
      // لوحة إدارة Django تُقدَّم على نفس الأصل في الإنتاج (خلف Nginx)
      { source: '/admin', destination: `${backendOrigin}/admin/` },
      { source: '/admin/:path*', destination: `${backendOrigin}/admin/:path*/` },

      // الملفات تُمرَّر كما هي — إضافة شرطة إليها تكسر أسماءها
      { source: '/media/:path*', destination: `${backendOrigin}/media/:path*` },
      { source: '/static/:path*', destination: `${backendOrigin}/static/:path*` },
    ];
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'http', hostname: '127.0.0.1' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);

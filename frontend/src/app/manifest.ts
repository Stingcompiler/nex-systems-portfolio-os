import type { MetadataRoute } from 'next';

import { SITE_NAME_FALLBACK } from '@/lib/constants/site';

/**
 * بيان التطبيق القابل للتثبيت (PWA).
 *
 * يُخزَّن للصفحات العامة فقط. لا يُخزَّن إطلاقًا: لوحة التحكم، بيانات
 * العملاء، الرموز، أو أي صفحة عضو حساسة — انظر service worker.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME_FALLBACK,
    short_name: SITE_NAME_FALLBACK,
    description: 'حلول برمجية متكاملة للويب والموبايل وسطح المكتب',
    start_url: '/ar',
    display: 'standalone',
    // يطابقان --background و--primary في globals.css
    background_color: '#f6f8fb',
    theme_color: '#0e7c86',
    dir: 'rtl',
    lang: 'ar',
    orientation: 'portrait',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}

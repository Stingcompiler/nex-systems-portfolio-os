import type { MetadataRoute } from 'next';

/**
 * بيان التطبيق القابل للتثبيت (PWA).
 *
 * يُخزَّن للصفحات العامة فقط. لا يُخزَّن إطلاقًا: لوحة التحكم، بيانات
 * العملاء، الرموز، أو أي صفحة عضو حساسة — انظر service worker.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NEXA SYSTEMS',
    short_name: 'NEXA',
    description: 'حلول برمجية متكاملة للويب والموبايل وسطح المكتب',
    start_url: '/ar',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#2563eb',
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

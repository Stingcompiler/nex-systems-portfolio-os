/*
 * Service Worker لـ stingdev.
 *
 * قواعد صارمة للخصوصية والصحة:
 *  - لا يُخزَّن إطلاقًا: /api و /admin و /dashboard وأي مسار عضو (/member).
 *    هذه تحمل بيانات حساسة ورموزًا يجب ألا تبقى في ذاكرة التخزين.
 *  - الصفحات العامة: الشبكة أولًا، مع ارتداد إلى صفحة عدم الاتصال.
 *  - الأصول الثابتة (_next/static): من الذاكرة أولًا (محتوى مُبصَّم لا يتغيّر).
 */
const VERSION = 'stingdev-v1';
// العربية هي اللغة الافتراضية — صفحة عدم الاتصال المخزَّنة مسبقًا
const OFFLINE_URL = '/ar/offline';
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isPrivate(url) {
  return (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/dashboard') ||
    /\/member(\/|$)/.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // المسارات الحساسة تمرّ للشبكة دائمًا ولا تُخزَّن أبدًا
  if (isPrivate(url)) return;

  // الأصول المُبصَّمة: من الذاكرة أولًا
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
    return;
  }

  // صفحات التنقّل: الشبكة أولًا، ثم آخر نسخة مخزَّنة، ثم صفحة عدم الاتصال
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL))),
    );
  }
});

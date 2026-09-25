/*
 * Service Worker لـ stingdev.
 *
 * قواعد صارمة للخصوصية والصحة:
 *  - لا يُخزَّن إطلاقًا: /api و /admin و /dashboard وأي مسار عضو (/member)
 *    وصفحات رموز النشرة (/newsletter) لأن روابطها شخصية.
 *    هذه تحمل بيانات حساسة ورموزًا يجب ألا تبقى في ذاكرة التخزين.
 *  - الصفحات العامة: الشبكة أولًا، مع ارتداد إلى صفحة عدم الاتصال.
 *  - الأصول الثابتة (_next/static): من الذاكرة أولًا (محتوى مُبصَّم لا يتغيّر).
 */
const VERSION = 'stingdev-v3';
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
    /\/member(\/|$)/.test(url.pathname) ||
    /\/newsletter\//.test(url.pathname) ||
    // صفحات المتابعة برموز شخصية
    /\/track\//.test(url.pathname)
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

// ------------------------------------------------------------ إشعارات الفريق
// الخادم يرسل {title, body, url, tag} مشفّرًا؛ المتصفح يفكّه ويسلّمه هنا.

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'ستينج سيستم', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/favicon-48.png',
      dir: 'rtl',
      lang: 'ar',
      // الوسم نفسه يستبدل الإشعار القديم بدل تكديس نسخ للطلب نفسه
      tag: data.tag,
      data: { url: data.url || '/dashboard' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/dashboard', self.location.origin);
  // روابط الموقع فقط — لا يُفتح عنوان خارجي من محتوى إشعار
  if (target.origin !== self.location.origin) return;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => new URL(client.url).pathname === target.pathname);
      if (open) return open.focus();
      const dashboard = windows.find((client) => new URL(client.url).pathname.startsWith('/dashboard'));
      if (dashboard && 'navigate' in dashboard) {
        return dashboard.navigate(target.href).then((client) => client && client.focus());
      }
      return self.clients.openWindow(target.href);
    }),
  );
});

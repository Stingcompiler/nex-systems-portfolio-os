'use client';

import { useEffect } from 'react';

/**
 * يسجّل Service Worker في الإنتاج فقط.
 *
 * لا يُسجَّل في التطوير كي لا يخزّن أصولًا قيد التغيّر المستمر. التحديث
 * التلقائي الآمن يتم عبر skipWaiting + clients.claim في SW نفسه.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* التثبيت الفاشل لا يُعطّل الموقع */
      });
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register);

    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}

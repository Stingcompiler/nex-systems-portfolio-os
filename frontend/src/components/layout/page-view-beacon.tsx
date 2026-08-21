'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * يسجّل مشاهدة كل صفحة عامة يزورها الزائر.
 *
 * يُركَّب مرة في تخطيط الموقع ويطلق إشارة عند كل تغيّر مسار. المسار
 * النسبي (`/api/v1`) يعني أن المتصفح لا يعرف عنوان Django. الفشل صامت
 * — العدّاد ليس حرجًا. الاشتقاقات (الجهاز، المصدر، البصمة) تتم في الخادم.
 */
export function PageViewBeacon() {
  const pathname = usePathname();
  const last = useRef<string>('');

  useEffect(() => {
    // لا نسجّل لوحة التحكم ولا صفحات العضو الخاصة
    if (pathname.startsWith('/dashboard') || /\/member(\/|$)/.test(pathname)) {
      return;
    }
    if (last.current === pathname) return;
    last.current = pathname;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
    const locale = pathname.split('/')[1] || 'ar';

    const timer = window.setTimeout(() => {
      fetch(`${apiUrl}/analytics/view/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: pathname,
          locale,
          referrer: document.referrer,
        }),
        keepalive: true,
      }).catch(() => {
        /* العدّاد ليس حرجًا */
      });
    }, 800);

    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
}

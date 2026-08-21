'use client';

import { useEffect, useRef } from 'react';

/**
 * يسجّل مشاهدة المقال بعد التحميل.
 *
 * العدّ من الخادم مستحيل مع الصفحات المولّدة ثابتًا، فترسل هذه الإشارة
 * من العميل مرة واحدة لكل تحميل. تستخدم مسارًا نسبيًا (`/api/v1`)، فلا
 * يعرف المتصفح عنوان Django. الفشل صامت — العدّاد ليس حرجًا.
 */
export function ViewBeacon({ slug }: { slug: string }) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
    const timer = window.setTimeout(() => {
      fetch(`${apiUrl}/posts/view/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
        keepalive: true,
      }).catch(() => {
        /* العدّاد ليس حرجًا — الفشل يُتجاهل */
      });
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [slug]);

  return null;
}

'use client';

import { useEffect, useRef, type ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

/**
 * الترويسة اللاصقة تعرف إن غادر الزائر أعلى الصفحة: تضع `data-scrolled`
 * فيصير الشريط أصلب بظل خفيف — فوق البطل يبقى شفافًا يندمج معه، وفوق
 * المحتوى ينفصل عنه بوضوح.
 *
 * عنصر عميل رفيع حول محتوى خادم: الأبناء يُرسَمون في الخادم كما هم، ولا
 * يُعاد رسم شيء عند التمرير — السمة تُكتب على العنصر مباشرة لا عبر حالة React.
 */
export function ScrollHeader({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const header = ref.current;
    if (!header) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      header.dataset.scrolled = String(window.scrollY > 8);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header ref={ref} data-scrolled="false" className={cn(className)}>
      {children}
    </header>
  );
}

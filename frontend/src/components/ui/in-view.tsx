'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

/**
 * يضع `data-shown="true"` على الحاوية حين تدخل الشاشة (مرة واحدة)، فتبدأ
 * حركات الأبناء المرتبطة بها عبر `group-data-[shown=true]:…` — لا تُصرف
 * الحركة على قسم لم يصل إليه الزائر بعد.
 */
export function InView({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'ol' | 'ul';
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || shown) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [shown]);

  return (
    // @ts-expect-error المرجع يناسب العناصر الثلاثة
    <Tag ref={ref} data-shown={shown} className={cn('group', className)}>
      {children}
    </Tag>
  );
}

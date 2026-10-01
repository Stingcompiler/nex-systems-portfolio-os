'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * مؤشر ينزلق إلى العنصر النشط (Tabs → panels) بلا مكتبة حركة.
 *
 * يقيس العنصر الذي يحمل `data-active="true"` داخل الحاوية ويحرّك طبقة
 * خلفه بـ transform. الحاوية تبقى مركّبة عند تغيّر معامل الرابط (مرشحات
 * المشاريع) أو الحالة (تبويبات اللوحة)، فيرى الزائر أين انتقل بدل قفزة.
 * القياس الأول بلا انتقال، ومن أوقف الحركة يرى الانتقال فوريًا.
 *
 * العناصر الأبناء تحتاج `relative z-10` لتعلو المؤشر، ولونها النشط يُكتب
 * كنص فقط (الخلفية للمؤشر).
 */
export function IndicatorTrack({
  children,
  className,
  indicatorClassName,
  variant = 'fill',
}: {
  children: ReactNode;
  className?: string;
  /** لون المؤشر وشكله، مثل `rounded-full bg-primary` */
  indicatorClassName?: string;
  /** fill: خلفية كاملة؛ underline: خط سفلي بسماكة 2px */
  variant?: 'fill' | 'underline';
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [hidden, setHidden] = useState(false);
  const [animated, setAnimated] = useState(false);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const measure = () => {
      const active = track.querySelector<HTMLElement>('[data-active="true"]');
      // بلا عنصر نشط (شريط التنقل في صفحة خارج روابطه): يبقى المؤشر في
      // مكانه ويتلاشى، فيظهر من هناك منزلقًا حين يعود عنصر نشط
      setHidden(!active);
      if (!active) return;
      const next: Box = {
        x: active.offsetLeft,
        y: variant === 'underline' ? active.offsetTop + active.offsetHeight - 2 : active.offsetTop,
        width: active.offsetWidth,
        height: variant === 'underline' ? 2 : active.offsetHeight,
      };
      setBox((previous) =>
        previous &&
        previous.x === next.x &&
        previous.y === next.y &&
        previous.width === next.width &&
        previous.height === next.height
          ? previous
          : next,
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  });

  // الانتقال يُفعَّل بعد أول رسم: الموضع الأول يظهر مباشرة دون انزلاق من الزاوية
  useLayoutEffect(() => {
    if (box && !animated) {
      const frame = requestAnimationFrame(() => setAnimated(true));
      return () => cancelAnimationFrame(frame);
    }
  }, [box, animated]);

  const style: CSSProperties | undefined = box
    ? {
        width: box.width,
        height: box.height,
        transform: `translate(${box.x}px, ${box.y}px)`,
      }
    : undefined;

  return (
    <div ref={trackRef} className={cn('relative', className)}>
      {box ? (
        <span
          aria-hidden="true"
          style={style}
          className={cn(
            'pointer-events-none absolute left-0 top-0 z-0 transition-opacity duration-200',
            animated &&
              'motion-safe:transition-[transform,width,height,opacity] motion-safe:duration-300 motion-safe:ease-out',
            hidden && 'opacity-0',
            indicatorClassName,
          )}
        />
      ) : null}
      {children}
    </div>
  );
}

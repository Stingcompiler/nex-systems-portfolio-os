'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * عدّاد يتحرك من قيمته السابقة إلى الجديدة (Odometer / count-up).
 *
 * في اللوحة تتغير الأرقام بتبديل المدة أو عند التحميل: رقم يعدّ إلى قيمته
 * يقول «هذه بيانات حيّة» ويُري الفرق. requestAnimationFrame مع تباطؤ في
 * النهاية؛ من أوقف الحركة يرى القيمة النهائية مباشرة.
 */
export function CountUp({
  value,
  duration = 800,
  format = (number: number) => String(number),
}: {
  value: number;
  duration?: number;
  format?: (value: number) => string;
}) {
  const [shown, setShown] = useState(value);
  const from = useRef(0);

  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (start === value || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(value);
      return;
    }
    let frame = 0;
    const began = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - began) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setShown(Math.round(start + (value - start) * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  // tabular-nums: الأرقام بعرض ثابت فلا يرتجف العنصر أثناء العدّ
  return <span className="tabular-nums">{format(shown)}</span>;
}

import type { CSSProperties } from 'react';

import { cn } from '@/lib/utils/cn';

/** ألوان القصاصات من الهوية: التيل والكحلي والفاتح والبرتقالي. */
const COLORS = ['#0E7C86', '#12253B', '#8FE0E4', '#E8704A', '#F2B84B', '#1D9E75'];

/**
 * قصاصات بمواضع ثابتة موزّعة على دائرة (لا عشوائية: الناتج نفسه في الخادم
 * والمتصفح، فلا اختلاف في الترطيب). كل قصاصة: زاوية + مسافة + دوران.
 */
const PIECES = Array.from({ length: 24 }, (_, index) => {
  const angle = (index / 24) * Math.PI * 2 + (index % 2 ? 0.2 : -0.1);
  const distance = 70 + ((index * 37) % 50);
  return {
    x: Math.round(Math.cos(angle) * distance),
    // انحراف إلى الأسفل قليلًا — كأن الجاذبية تشدّها
    y: Math.round(Math.sin(angle) * distance + 30),
    r: ((index * 97) % 540) - 270,
    color: COLORS[index % COLORS.length],
    wide: index % 3 === 0,
    delay: (index % 4) * 30,
  };
});

/**
 * تأكيد النجاح: دائرة تقفز، وعلامة ✓ تُرسم، وقصاصات تنطلق مرة واحدة.
 *
 * لحظة الإرسال أهم لحظة في الموقع — العميل وثق بك للتو؛ التأكيد الساكن
 * يُضعفها. CSS وSVG فقط، ويحترم «تقليل الحركة» (motion-safe): من أوقف
 * الحركة يرى العلامة مكتملة دون قصاصات.
 */
export function SuccessBurst({ className }: { className?: string }) {
  return (
    <span className={cn('relative mx-auto grid size-16 place-items-center', className)} aria-hidden="true">
      <span className="absolute inset-0">
        {PIECES.map((piece, index) => (
          <span
            key={index}
            className={cn(
              'absolute start-1/2 top-1/2 hidden rounded-[1px] opacity-0 motion-safe:block motion-safe:animate-confetti',
              piece.wide ? 'h-1.5 w-2.5' : 'h-2 w-1.5',
            )}
            style={
              {
                backgroundColor: piece.color,
                '--x': `${piece.x}px`,
                '--y': `${piece.y}px`,
                '--r': `${piece.r}deg`,
                animationDelay: `${250 + piece.delay}ms`,
              } as CSSProperties
            }
          />
        ))}
      </span>
      <span className="relative grid size-16 place-items-center rounded-full bg-success-soft motion-safe:animate-pop">
        <svg viewBox="0 0 24 24" className="size-8 text-success" fill="none">
          <path
            d="M5 12.5l4.5 4.5L19 7.5"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="motion-safe:animate-draw"
            style={{ strokeDasharray: 22, '--dash': 22, animationDelay: '180ms' } as CSSProperties}
          />
        </svg>
      </span>
    </span>
  );
}

/**
 * مرجع استدعاء يُظهر رسالة النجاح عند تركيبها. النموذج الطويل يُستبدل
 * برسالة قصيرة فتقصر الصفحة ويجد الزائر نفسه عند التذييل — لا يرى
 * التأكيد ولا رقمه المرجعي. بلا تمرير ناعم لمن أوقف الحركة.
 */
export function revealOnMount(element: HTMLElement | null) {
  if (!element) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  element.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
}

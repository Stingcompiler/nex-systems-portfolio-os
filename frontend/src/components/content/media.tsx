import Image from 'next/image';
import type { CSSProperties } from 'react';

import type { MediaRef } from '@/lib/api/types';
import { cn } from '@/lib/utils/cn';

/**
 * صورة غلاف.
 *
 * الأبعاد الصريحة تمنع القفز البصري (CLS)، والغياب يعرض بديلًا هادئًا
 * بدل فراغ أبيض — الصور تُضاف من لوحة التحكم لاحقًا.
 *
 * `fit="contain"` للقطات الشاشة: القص يبتر الواجهات ويخفي ما يُفترض أن
 * تُظهره اللقطة. `natural` يلغي النسبة الثابتة ويعتمد أبعاد الصورة نفسها،
 * فلا قص ولا أشرطة فارغة.
 */
export function CoverImage({
  media,
  alt,
  className,
  ratio = 'aspect-[16/10]',
  natural = false,
  fit = 'cover',
  quality,
  priority = false,
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
}: {
  media: MediaRef | null | undefined;
  alt: string;
  className?: string;
  ratio?: string;
  natural?: boolean;
  fit?: 'cover' | 'contain';
  quality?: number;
  priority?: boolean;
  sizes?: string;
}) {
  // النسبة الطبيعية تحتاج بعدين معلومين؛ وإلا نعود إلى النسبة الثابتة
  const intrinsic =
    natural && media?.width && media.height
      ? ({ aspectRatio: `${media.width} / ${media.height}` } as CSSProperties)
      : undefined;

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded bg-surface-hover',
        intrinsic ? null : ratio,
        className,
      )}
      style={intrinsic}
    >
      {media?.url ? (
        <Image
          src={media.url}
          alt={media.alt || alt}
          fill
          sizes={sizes}
          quality={quality}
          priority={priority}
          className={cn(
            fit === 'contain' ? 'object-contain' : 'object-cover',
            // الحشوة على الصورة نفسها: عنصر fill مطلق لا تُزيحه حشوة الأب.
            // تجعل الشريط الفارغ حول اللقطة يبدو إطارًا مقصودًا.
            fit === 'contain' && !intrinsic ? 'p-2 sm:p-3' : null,
          )}
        />
      ) : (
        <div
          aria-hidden="true"
          className="grid size-full place-items-center bg-gradient-to-br from-primary/10 to-accent/10"
        />
      )}
    </div>
  );
}

import Image from 'next/image';

import type { MediaRef } from '@/lib/api/types';
import { cn } from '@/lib/utils/cn';

/**
 * صورة غلاف بنسبة ثابتة.
 *
 * الأبعاد الصريحة تمنع القفز البصري (CLS)، والغياب يعرض بديلًا هادئًا
 * بدل فراغ أبيض — الصور تُضاف من لوحة التحكم لاحقًا.
 */
export function CoverImage({
  media,
  alt,
  className,
  ratio = 'aspect-[16/10]',
  priority = false,
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
}: {
  media: MediaRef | null | undefined;
  alt: string;
  className?: string;
  ratio?: string;
  priority?: boolean;
  sizes?: string;
}) {
  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded bg-surface-hover',
        ratio,
        className,
      )}
    >
      {media?.url ? (
        <Image
          src={media.url}
          alt={media.alt || alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
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

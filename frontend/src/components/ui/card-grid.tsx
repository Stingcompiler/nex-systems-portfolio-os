import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

/**
 * أعمدة الشبكة بحسب عدد العناصر.
 *
 * الشبكة الثلاثية الثابتة تترك عنصرين بجوار عمود فارغ، وأربعة عناصر
 * صفًّا من ثلاثة ويتيمًا تحته. القاعدة:
 * - عنصر واحد: عمود واحد بعرض مقروء.
 * - عنصران أو أربعة: عمودان (2×2 للأربعة).
 * - غير ذلك: ثلاثة أعمدة على الشاشات الواسعة.
 * الهاتف عمود واحد دائمًا.
 */
export function gridColumns(count: number): string {
  if (count <= 1) return 'max-w-3xl';
  if (count === 2 || count === 4) return 'sm:grid-cols-2';
  return 'sm:grid-cols-2 lg:grid-cols-3';
}

export function CardGrid({
  count,
  children,
  className,
  as: Tag = 'div',
}: {
  count: number;
  children: ReactNode;
  className?: string;
  as?: 'div' | 'ul' | 'ol';
}) {
  return <Tag className={cn('grid gap-6', gridColumns(count), className)}>{children}</Tag>;
}

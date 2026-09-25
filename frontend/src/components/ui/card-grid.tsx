import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

/**
 * أعمدة الشبكة بحسب عدد العناصر.
 *
 * الشبكة الثلاثية الثابتة تترك عنصرين بجوار عمود فارغ، وأربعة عناصر
 * صفًّا من ثلاثة ويتيمًا تحته. القاعدة:
 * - عنصر واحد: عمود واحد بعرض مقروء.
 * - عنصران: عمودان.
 * - أربعة: 2×2 على الشاشات المتوسطة، وصف واحد من أربعة من 1280px — شبكة 2×2
 *   على الشاشة الواسعة جعلت بطاقة المشروع 600×570 بصورة ارتفاعها 370، فاحتلت
 *   أربعة مشاريع 1200px بينما بطاقة الخدمة 215.
 * - غير ذلك: ثلاثة أعمدة على الشاشات الواسعة.
 * الهاتف عمود واحد دائمًا.
 */
export function gridColumns(count: number): string {
  if (count <= 1) return 'max-w-3xl';
  if (count === 2) return 'sm:grid-cols-2';
  if (count === 4) return 'sm:grid-cols-2 xl:grid-cols-4';
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

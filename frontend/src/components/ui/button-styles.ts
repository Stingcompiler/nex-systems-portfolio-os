import { cn } from '@/lib/utils/cn';

/*
 * أصناف الأزرار منفصلة عن button.tsx: ذاك الملف يستورد Link من next-intl،
 * فكل مكوّن عميل يستورد منه buttonClass كان يحمّل التنقل كاملًا في حزمته
 * (+6KB في صفحتي الطلب والتواصل). المكوّنات العميلة تستورد من هنا.
 */

/** [بند 11] أُضيف danger — واللوحة تستدعي هذا المكوّن بدل الأزرار اليدوية. */
export type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type Size = 'sm' | 'md' | 'lg' | 'icon';

export const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-primary text-primary-foreground shadow-brand ' +
    'hover:bg-primary/90 hover:shadow-brand-lg hover:-translate-y-0.5',
  secondary:
    'bg-surface text-foreground border border-border shadow-subtle ' +
    'hover:bg-surface-hover hover:border-primary/30',
  // [بند 14] خلفية هادئة من رمز صريح بدل primary/10
  outline: 'border border-primary/40 text-primary hover:bg-primary-soft hover:border-primary/60',
  ghost: 'text-foreground hover:bg-surface-hover',
  danger: 'bg-danger text-white hover:brightness-110',
};

export const SIZES: Record<Size, string> = {
  // [بند 7] الحد الأدنى 44px لكل الأحجام — بما فيها الزر الأيقوني
  sm: 'min-h-11 px-4 text-sm gap-1.5',
  md: 'min-h-11 px-5 text-sm gap-2',
  lg: 'min-h-12 px-7 text-base gap-2',
  icon: 'size-11 p-0',
};

export const BASE =
  'inline-flex items-center justify-center rounded-lg font-medium transition-all ' +
  'duration-fast focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60';

/**
 * أصناف الزر لعنصر لا يمكن أن يكون <Button> (زر إرسال بمحتوى متغير،
 * أو عنصر داخل مكوّن طرف ثالث) — كي لا تُكتب الأزرار يدويًا بأشكال متباينة.
 */
export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}


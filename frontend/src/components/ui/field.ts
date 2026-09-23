import { cn } from '@/lib/utils/cn';

/**
 * صنف موحّد لعناصر الإدخال في الموقع العام (input / select / textarea).
 *
 * - الحد بـ `border-strong` (3.3:1) لا `border` (1.25:1): حدّ الحقل هو ما
 *   يدل على أنه حقل، فيلزمه تباين 3:1 (WCAG 1.4.11).
 * - 16px على الهاتف: أصغر من ذلك يجعل iOS يكبّر الصفحة عند التركيز.
 * - الخطأ يغيّر الحد فقط؛ الرسالة نفسها نص بجوار الحقل.
 * - حلقة التركيز من القاعدة العامة `:focus-visible` في globals.css.
 */
export function fieldClass({
  invalid = false,
  multiline = false,
  className,
}: { invalid?: boolean; multiline?: boolean; className?: string } = {}) {
  return cn(
    'w-full rounded-lg border bg-background px-3 text-base text-foreground sm:text-sm',
    'placeholder:text-muted transition-colors duration-fast',
    'hover:border-foreground/60 disabled:cursor-not-allowed disabled:opacity-60',
    multiline ? 'min-h-28 py-2.5 leading-relaxed' : 'min-h-11',
    invalid ? 'border-danger' : 'border-border-strong',
    className,
  );
}

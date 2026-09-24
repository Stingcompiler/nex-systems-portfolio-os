import Image from 'next/image';

import type { SiteSettings } from '@/lib/api/types';
import { SITE_NAME_FALLBACK } from '@/lib/constants/site';
import { cn } from '@/lib/utils/cn';

/** شعار الهوية المضمّن: يظهر حين لا يُرفع شعار من اللوحة بدل أول حرف من الاسم. */
export const BRAND_MARK_SRC = '/brand/stingsystem-mark.svg';

/**
 * أبعاد العرض لا أبعاد الملف.
 *
 * تمرير أبعاد الأصل يجعل Next يبني مجموعة مصادر بمقاسات الشاشات كاملة —
 * حُمّل شعار بعرض 1920 بكسل ليُعرض بارتفاع 32. الاشتقاق من الارتفاع
 * المعروض يبقي الصورة في حدود ما يظهر فعلًا.
 */
function markSize(media: { width: number | null; height: number | null }, height: number) {
  const ratio = media.width && media.height ? media.width / media.height : 1;
  return { width: Math.max(1, Math.round(height * ratio)), height };
}

/**
 * علامة الموقع: الشعار المرفوع إن وُجد، وإلا شعار الهوية المضمّن.
 *
 * النسختان الفاتحة والداكنة تُرسمان معًا وتتبادلان الظهور بالـ CSS —
 * التخطيط عنصر خادم فلا يعرف السمة وقت التوليد، والتبديل بالصنف
 * يتجنّب وميض الشعار الخاطئ عند التحميل.
 *
 * `size` ارتفاع العلامة بالبكسل: 40 في الترويسة (حضور علامة)، وأصغر في
 * التذييل وصفحات الدخول.
 */
export function SiteMark({
  settings,
  size = 40,
  className,
}: {
  settings: SiteSettings | null;
  size?: number;
  className?: string;
}) {
  const name = settings?.site_name || SITE_NAME_FALLBACK;
  // إحدى النسختين تكفي: تُستخدم في الوضعين عند غياب الأخرى
  const light = settings?.logo_light ?? settings?.logo_dark;
  const dark = settings?.logo_dark ?? settings?.logo_light;
  const style = { height: size };
  const base = cn('w-auto shrink-0 object-contain', className);

  if (!light || !dark) {
    return (
      <Image
        src={BRAND_MARK_SRC}
        alt=""
        width={size}
        height={size}
        style={style}
        className={base}
      />
    );
  }

  // شعار واحد مرفوع: رسم نسختين متطابقتين يضاعف التحميل بلا فائدة
  if (light.url === dark.url) {
    return (
      <Image
        src={light.url}
        alt={light.alt || name}
        {...markSize(light, size)}
        style={style}
        className={base}
      />
    );
  }

  return (
    <>
      <Image
        src={light.url}
        alt={light.alt || name}
        {...markSize(light, size)}
        style={style}
        className={cn(base, 'dark:hidden')}
      />
      <Image
        src={dark.url}
        alt={dark.alt || name}
        {...markSize(dark, size)}
        style={style}
        className={cn(base, 'hidden dark:block')}
      />
    </>
  );
}

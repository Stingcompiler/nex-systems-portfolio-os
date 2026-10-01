'use client';

import { IndicatorTrack } from '@/components/ui/indicator-track';
import { Link, usePathname } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';

export interface NavLinkItem {
  href: string;
  label: string;
}

/**
 * هل الرابط يمثّل الصفحة الحالية؟
 *
 * التطابق يشمل الصفحات الفرعية: `/projects/x` يُبقي «المشاريع» نشطًا،
 * فالزائر يرى موقعه في القسم لا في الصفحة وحدها.
 */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * روابط الترويسة على الشاشات الكبيرة.
 *
 * عنصر عميل لأن إبراز الصفحة الحالية يحتاج المسار — الترويسة نفسها
 * تبقى عنصر خادم فلا يُرسل منها إلى المتصفح إلا هذه القائمة.
 */
export function NavLinks({ items }: { items: NavLinkItem[] }) {
  const pathname = usePathname();

  // خلفية الرابط النشط طبقة واحدة تنزلق من الصفحة السابقة إلى الجديدة:
  // الترويسة في التخطيط فلا يُعاد تركيبها عند التنقل، فيرى الزائر أين انتقل
  return (
    <IndicatorTrack indicatorClassName="rounded-lg bg-surface-hover">
      <ul className="flex items-center gap-1">
        {items.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                data-active={active}
                className={cn(
                  'relative z-10 inline-flex min-h-9 items-center rounded-lg px-3 text-sm font-medium',
                  'transition-colors duration-fast',
                  active
                    ? 'text-foreground'
                    : 'text-muted hover:bg-surface-hover/60 hover:text-foreground',
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </IndicatorTrack>
  );
}

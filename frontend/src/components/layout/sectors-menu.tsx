'use client';

import { ArrowRight, ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { isActivePath } from '@/components/layout/nav-links';
import { sectorIcon } from '@/lib/constants/sector-icons';
import { Link, usePathname } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';

export interface SectorLink {
  slug: string;
  sector: string;
  label: string;
}

/**
 * «حلول لقطاعك»: قائمة منسدلة بالقطاعات وأيقوناتها بدل رابط إلى صفحة قائمة.
 *
 * صاحب المدرسة أو الصيدلية يجد قطاعه بنقرة ويعرف من أول نظرة أن الموقع
 * يخدمه. تفتح بالتحويم (مؤشر) أو النقر/اللمس، وتُغلق بـ Esc والنقر خارجها
 * وخروج التركيز منها وتغيّر الصفحة.
 */
export function SectorsMenu({
  label,
  sectors,
  allLabel,
}: {
  label: string;
  sectors: SectorLink[];
  allLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelId = useId();
  const active = isActivePath(pathname, '/solutions');

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // مهلة قصيرة قبل الإغلاق: عبور الفجوة بين الزر واللوحة لا يغلقها
  const openNow = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const closeSoon = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };

  return (
    <div
      ref={rootRef}
      className="relative"
      onPointerEnter={(event) => event.pointerType === 'mouse' && openNow()}
      onPointerLeave={(event) => event.pointerType === 'mouse' && closeSoon()}
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'inline-flex min-h-9 items-center gap-1 rounded-lg px-3 text-sm font-medium transition-colors duration-fast',
          active || open
            ? 'bg-surface-hover text-foreground'
            : 'text-muted hover:bg-surface-hover/60 hover:text-foreground',
        )}
      >
        {label}
        <ChevronDown
          className={cn('size-4 transition-transform duration-fast', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          id={panelId}
          className="absolute start-1/2 top-full z-40 w-[36rem] -translate-x-1/2 pt-2 rtl:translate-x-1/2"
        >
          <div className="rounded-xl border border-border bg-surface p-3 shadow-elevated">
            <ul className="grid grid-cols-2 gap-1">
              {sectors.map((sector) => {
                const Icon = sectorIcon(sector.slug, sector.sector);
                const href = `/solutions/${sector.slug}`;
                return (
                  <li key={sector.slug}>
                    <Link
                      href={href}
                      aria-current={isActivePath(pathname, href) ? 'page' : undefined}
                      className="flex min-h-12 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
                        <Icon className="size-[1.1rem]" aria-hidden="true" />
                      </span>
                      {sector.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <Link
              href="/solutions"
              className="mt-2 flex min-h-11 items-center justify-between gap-2 rounded-lg border-t border-border px-3 pt-3 text-sm font-medium text-primary hover:underline"
            >
              {allLabel}
              <ArrowRight className="size-4 flip-rtl" aria-hidden="true" />
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

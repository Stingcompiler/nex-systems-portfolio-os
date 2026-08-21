'use client';

import { Menu, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { MemberMenu } from '@/components/layout/member-menu';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Link, usePathname } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';

interface Item {
  href: string;
  label: string;
}

export function MobileNav({ items, ctaLabel }: { items: Item[]; ctaLabel: string }) {
  const t = useTranslations('nav');
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // إغلاق القائمة عند الانتقال إلى صفحة أخرى
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Esc للإغلاق، ومنع تمرير الخلفية، وإعادة التركيز إلى الزر
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('a, button')?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? t('closeMenu') : t('openMenu')}
        className="inline-flex size-11 items-center justify-center rounded text-foreground hover:bg-surface-hover lg:hidden"
      >
        {open ? (
          <X className="size-5" aria-hidden="true" />
        ) : (
          <Menu className="size-5" aria-hidden="true" />
        )}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <div
        id="mobile-nav-panel"
        ref={panelRef}
        hidden={!open}
        className={cn(
          'fixed inset-x-0 top-16 z-50 border-b border-border bg-surface p-4 shadow-card lg:hidden',
        )}
      >
        <nav aria-label={t('menu')}>
          <ul className="flex flex-col gap-1">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex min-h-11 items-center rounded px-3 text-base font-medium hover:bg-surface-hover"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/request-quote"
            className="mt-3 flex min-h-11 items-center justify-center rounded bg-primary px-5 font-medium text-primary-foreground"
          >
            {ctaLabel}
          </Link>
        </nav>
        <div className="mt-3 flex items-center gap-1 border-t border-border pt-3 sm:hidden">
          <ThemeToggle />
          <LocaleSwitcher />
          <MemberMenu />
        </div>
      </div>
    </>
  );
}

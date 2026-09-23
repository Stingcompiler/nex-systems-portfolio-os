'use client';

import { ArrowLeft, ArrowRight, Menu, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { MemberMenu } from '@/components/layout/member-menu';
import { isActivePath, type NavLinkItem } from '@/components/layout/nav-links';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Link, usePathname } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';

export function MobileNav({
  items,
  secondaryItems = [],
  ctaLabel,
}: {
  items: NavLinkItem[];
  /** روابط التذييل الأهم — على الهاتف التذييل بعيد جدًا عن القائمة */
  secondaryItems?: NavLinkItem[];
  ctaLabel: string;
}) {
  const t = useTranslations('nav');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

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
        return;
      }

      // حصر التركيز داخل الدرج: Tab من آخر عنصر يعود إلى أوله والعكس،
      // فلا يتسرّب التركيز إلى صفحة مغطاة لا يراها المستخدم
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panelRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panelRef.current.contains(active))) {
        event.preventDefault();
        first.focus();
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

  // الدرج يفتح من جهة البداية، فالسهم يشير إلى الخارج بحسب الاتجاه
  const AwayArrow = locale === 'ar' ? ArrowLeft : ArrowRight;

  /*
    الدرج يُركَّب على <body> عبر portal ولا يبقى داخل الترويسة:
    الترويسة تحمل backdrop-blur، و backdrop-filter يجعل العنصر كتلة
    احتواء لأي سليل ثابت — فكان `inset-y-0` يُحسب على ارتفاع الترويسة
    (64px) لا على الشاشة، ويتقلّص الدرج إلى شريط.
  */
  const drawer = (
    <>
      <div
        className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm lg:hidden"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/*
        درج جانبي بارتفاع الشاشة بدل قائمة منسدلة من الأعلى: الروابط
        الرئيسية ثم الثانوية بمساحات لمس مريحة، والدرج يمرّر محتواه
        بينما تبقى الخلفية ثابتة.
      */}
      <div
        id="mobile-nav-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('menu')}
        className={cn(
          'fixed inset-y-0 start-0 z-50 flex w-[min(20rem,85vw)] flex-col',
          'border-e border-border bg-surface shadow-card lg:hidden',
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
          <span className="text-sm font-semibold text-muted">{t('menu')}</span>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              triggerRef.current?.focus();
            }}
            aria-label={t('closeMenu')}
            className="inline-flex size-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <nav aria-label={t('menu')} className="min-h-0 flex-1 overflow-y-auto p-3">
          <ul className="flex flex-col gap-0.5">
            {items.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex min-h-11 items-center justify-between gap-3 rounded-lg px-3',
                      'text-base font-medium transition-colors',
                      active
                        ? 'bg-primary-soft text-primary'
                        : 'text-foreground hover:bg-surface-hover',
                    )}
                  >
                    {item.label}
                    <AwayArrow
                      className={cn('size-4 shrink-0', active ? 'opacity-70' : 'opacity-0')}
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>

          {secondaryItems.length ? (
            <ul className="mt-3 flex flex-col gap-0.5 border-t border-border pt-3">
              {secondaryItems.map((item) => {
                const active = isActivePath(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex min-h-11 items-center rounded-lg px-3 text-sm transition-colors',
                        active
                          ? 'bg-primary-soft font-medium text-primary'
                          : 'text-muted hover:bg-surface-hover hover:text-foreground',
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </nav>

        <div className="shrink-0 border-t border-border p-3">
          <Link
            href="/request-quote"
            className="flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 font-medium text-primary-foreground shadow-brand"
          >
            {ctaLabel}
          </Link>
          <div className="mt-3 flex items-center justify-between gap-1 sm:hidden">
            <ThemeToggle />
            <div className="flex items-center gap-1">
              <LocaleSwitcher />
              <MemberMenu />
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? t('closeMenu') : t('openMenu')}
        className="inline-flex size-11 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-surface-hover lg:hidden"
      >
        {open ? (
          <X className="size-5" aria-hidden="true" />
        ) : (
          <Menu className="size-5" aria-hidden="true" />
        )}
      </button>

      {mounted && open ? createPortal(drawer, document.body) : null}
    </>
  );
}

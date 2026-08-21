import { getTranslations } from 'next-intl/server';

import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { MemberMenu } from '@/components/layout/member-menu';
import { MobileNav } from '@/components/layout/mobile-nav';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import type { SiteSettings } from '@/lib/api/types';
import { Link } from '@/lib/i18n/navigation';
import { MAIN_NAV } from '@/lib/constants/nav';

export async function Header({ settings }: { settings: SiteSettings | null }) {
  const t = await getTranslations('nav');
  const items = MAIN_NAV.map((item) => ({ href: item.href, label: t(item.key) }));

  return (
    <header className="sticky top-0 z-30 border-b border-border/40 bg-background/75 backdrop-blur-xl">
      <Container className="flex h-16 items-center gap-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 text-lg font-bold"
          aria-label={settings?.site_name || 'NEXA SYSTEMS'}
        >
          <span className="grid size-8 place-items-center rounded-lg bg-brand text-sm text-white shadow-[0_2px_10px_-2px_rgb(var(--primary)/0.5)]">
            {(settings?.site_name || 'N').charAt(0).toUpperCase()}
          </span>
          <span>{settings?.site_name || 'NEXA SYSTEMS'}</span>
        </Link>

        <nav aria-label={t('menu')} className="hidden flex-1 justify-center lg:flex">
          <ul className="flex items-center gap-0.5">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-flex min-h-9 items-center rounded-lg px-2.5 text-[0.8125rem] font-medium text-muted transition-colors duration-fast hover:bg-surface-hover hover:text-foreground"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ms-auto flex items-center gap-1">
          <div className="hidden sm:flex sm:items-center sm:gap-1">
            <ThemeToggle />
            <LocaleSwitcher />
            <MemberMenu />
          </div>
          <div
            aria-hidden="true"
            className="mx-2 hidden h-5 w-px bg-border/60 lg:block"
          />
          <ButtonLink
            href="/request-quote"
            size="sm"
            className="hidden shadow-[0_2px_12px_-3px_rgb(var(--primary)/0.4)] lg:inline-flex"
          >
            {t('requestQuote')}
          </ButtonLink>
          <MobileNav items={items} ctaLabel={t('requestQuote')} />
        </div>
      </Container>
    </header>
  );
}

import { getTranslations } from 'next-intl/server';

import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { MemberMenu } from '@/components/layout/member-menu';
import { MobileNav } from '@/components/layout/mobile-nav';
import { NavLinks } from '@/components/layout/nav-links';
import { SiteMark } from '@/components/layout/site-mark';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import type { SiteSettings } from '@/lib/api/types';
import { Link } from '@/lib/i18n/navigation';
import { MAIN_NAV, MOBILE_SECONDARY_NAV } from '@/lib/constants/nav';
import { SITE_NAME_FALLBACK } from '@/lib/constants/site';

export async function Header({ settings }: { settings: SiteSettings | null }) {
  const t = await getTranslations('nav');
  const items = MAIN_NAV.map((item) => ({ href: item.href, label: t(item.key) }));
  const secondaryItems = MOBILE_SECONDARY_NAV.map((item) => ({
    href: item.href,
    label: t(item.key),
  }));

  return (
    <header className="sticky top-0 z-30 border-b border-border/40 bg-background/75 backdrop-blur-xl">
      <Container className="flex h-16 items-center gap-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-3"
          aria-label={settings?.site_name || SITE_NAME_FALLBACK}
        >
          <SiteMark settings={settings} />
          {/* اسم الموقع بخط العناوين وبحجم يليق بعلامة لا برابط:
              كان بخط الجسم و18px فبدا بندًا في القائمة */}
          <span className="font-heading text-xl font-bold ltr:tracking-tight sm:text-[1.375rem]">
            {settings?.site_name || SITE_NAME_FALLBACK}
          </span>
        </Link>

        {/* أربعة روابط تتسع مع الشعار وزر الطلب من 1024px، والدرج يغطي ما دونها */}
        <nav aria-label={t('menu')} className="hidden min-w-0 flex-1 justify-center lg:flex">
          <NavLinks items={items} />
        </nav>

        <div className="ms-auto flex items-center gap-1">
          <div className="hidden sm:flex sm:items-center sm:gap-1">
            <ThemeToggle />
            <LocaleSwitcher />
            <MemberMenu />
          </div>
          <div
            aria-hidden="true"
            className="mx-2 hidden h-5 w-px bg-border/60 sm:block"
          />
          <ButtonLink
            href="/request-quote"
            size="sm"
            className="hidden shadow-brand sm:inline-flex"
          >
            {t('requestQuote')}
          </ButtonLink>
          <MobileNav items={items} secondaryItems={secondaryItems} ctaLabel={t('requestQuote')} />
        </div>
      </Container>
    </header>
  );
}

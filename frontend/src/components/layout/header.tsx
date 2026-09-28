import { MessageCircle } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { MemberMenu } from '@/components/layout/member-menu';
import { MobileNav } from '@/components/layout/mobile-nav';
import { NavLinks } from '@/components/layout/nav-links';
import { SectorsMenu } from '@/components/layout/sectors-menu';
import { SiteMark } from '@/components/layout/site-mark';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { getSolutions } from '@/lib/api/queries';
import type { SiteSettings } from '@/lib/api/types';
import type { Locale } from '@/lib/i18n/routing';
import { whatsappLink } from '@/lib/utils/format';
import { Link } from '@/lib/i18n/navigation';
import { MAIN_NAV, MOBILE_SECONDARY_NAV } from '@/lib/constants/nav';
import { SITE_NAME_FALLBACK } from '@/lib/constants/site';

export async function Header({ settings }: { settings: SiteSettings | null }) {
  const locale = (await getLocale()) as Locale;
  const [t, solutions] = await Promise.all([
    getTranslations('nav'),
    getSolutions(locale, { page_size: 6 }),
  ]);
  const sectors = solutions.results.map((solution) => ({
    slug: solution.slug,
    sector: solution.sector,
    label: solution.title,
  }));
  const whatsapp = settings?.whatsapp
    ? whatsappLink(settings.whatsapp, settings.whatsapp_default_message)
    : '';
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

        {/* «حلول لقطاعك» أولًا ثم ثلاثة روابط، من 1024px؛ الدرج يغطي ما دونها */}
        <nav aria-label={t('menu')} className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex">
          {sectors.length ? (
            <SectorsMenu label={t('sectorsMenu')} sectors={sectors} allLabel={t('allSolutions')} />
          ) : null}
          <NavLinks items={items} />
        </nav>

        {/* أدوات الزائر فقط: اللغة مختصرة، والحساب لمن سجّل دخوله. المظهر
            ودخول العملاء في التذييل والدرج — أيقونات بلا معنى للعميل الجديد */}
        <div className="ms-auto flex items-center gap-1">
          <div className="hidden sm:flex sm:items-center sm:gap-1">
            <LocaleSwitcher compact />
            <MemberMenu hideWhenLoggedOut />
          </div>
          {whatsapp ? (
            <>
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden min-h-9 items-center gap-1.5 rounded-lg border border-border-strong px-3 text-sm font-medium text-foreground transition-colors hover:border-success/50 hover:text-success md:inline-flex"
              >
                <MessageCircle className="size-4 text-success" aria-hidden="true" />
                {t('whatsapp')}
              </a>
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('whatsappAria')}
                title={t('whatsappAria')}
                className="inline-flex size-10 items-center justify-center rounded-lg text-success transition-colors hover:bg-success-soft md:hidden"
              >
                <MessageCircle className="size-5" aria-hidden="true" />
              </a>
            </>
          ) : null}
          <ButtonLink href="/request-quote" size="sm" className="hidden shadow-brand sm:inline-flex">
            {t('requestQuote')}
          </ButtonLink>
          {/* الجوال: زر «ابدأ» ظاهر دائمًا — الزائر المقتنع في منتصف الصفحة
              كان لا يجده إلا داخل القائمة */}
          <ButtonLink href="/request-quote" size="sm" className="shadow-brand sm:hidden">
            {t('requestQuoteShort')}
          </ButtonLink>
          <MobileNav
            items={items}
            secondaryItems={secondaryItems}
            sectors={sectors}
            ctaLabel={t('requestQuote')}
          />
        </div>
      </Container>
    </header>
  );
}

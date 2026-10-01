import { getLocale, getTranslations } from 'next-intl/server';

import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { MemberMenu } from '@/components/layout/member-menu';
import { MobileNav } from '@/components/layout/mobile-nav';
import { NavLinks } from '@/components/layout/nav-links';
import { ScrollHeader } from '@/components/layout/scroll-header';
import { SectorsMenu } from '@/components/layout/sectors-menu';
import { SiteMark } from '@/components/layout/site-mark';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { ButtonLink } from '@/components/ui/button';
import { WhatsAppIcon } from '@/components/ui/whatsapp-icon';
import { Container } from '@/components/ui/container';
import { getSolutions } from '@/lib/api/queries';
import type { SiteSettings } from '@/lib/api/types';
import type { Locale } from '@/lib/i18n/routing';
import { cn } from '@/lib/utils/cn';
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
    <ScrollHeader
      className={cn(
        'sticky top-0 z-30 border-b border-border/40 bg-background/75 backdrop-blur-xl',
        'transition-[background-color,border-color,box-shadow] duration-300 ease-out',
        'data-[scrolled=true]:border-border/70 data-[scrolled=true]:bg-background/90 data-[scrolled=true]:shadow-[0_6px_20px_-12px_rgb(15_23_42/0.25)]',
      )}
    >
      <Container className="flex h-16 items-center gap-3 sm:gap-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 sm:gap-3"
          aria-label={settings?.site_name || SITE_NAME_FALLBACK}
        >
          <SiteMark settings={settings} />
          {/* اسم الموقع بخط العناوين وبحجم يليق بعلامة لا برابط:
              كان بخط الجسم و18px فبدا بندًا في القائمة */}
          {/* الهاتف: شريط 360px يحمل الشعار وواتساب و«ابدأ» والقائمة — بخط أصغر
              قليلًا يتسع بلا تجاوز يهزّ الصفحة أفقيًا، ودون 360px تكفي العلامة */}
          <span className="font-heading text-lg font-bold max-[359px]:sr-only ltr:tracking-tight sm:text-[1.375rem]">
            {settings?.site_name || SITE_NAME_FALLBACK}
          </span>
        </Link>

        {/* «حلول لقطاعك» أولًا ثم ثلاثة روابط، من 1024px؛ الدرج يغطي ما دونها */}
        <nav
          aria-label={t('menu')}
          className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex"
        >
          {sectors.length ? (
            <SectorsMenu label={t('sectorsMenu')} sectors={sectors} allLabel={t('allSolutions')} />
          ) : null}
          <NavLinks items={items} />
        </nav>

        {/* أدوات الزائر: المظهر (بتلميح يسمّيه)، اللغة مختصرة، والحساب لمن سجّل
            دخوله. دخول العملاء في التذييل والدرج */}
        <div className="ms-auto flex items-center gap-1">
          <div className="hidden sm:flex sm:items-center sm:gap-1">
            <ThemeToggle />
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
                <WhatsAppIcon className="size-4 text-[#25D366]" />
                {t('whatsapp')}
              </a>
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('whatsappAria')}
                title={t('whatsappAria')}
                className="inline-flex size-10 items-center justify-center rounded-lg text-[#25D366] transition-colors hover:bg-success-soft md:hidden"
              >
                <WhatsAppIcon className="size-6" />
              </a>
            </>
          ) : null}
          <ButtonLink
            href="/request-quote"
            size="sm"
            className="hidden shadow-brand sm:inline-flex"
          >
            {t('requestQuote')}
          </ButtonLink>
          {/* الجوال: زر «ابدأ» ظاهر دائمًا — الزائر المقتنع في منتصف الصفحة
              كان لا يجده إلا داخل القائمة */}
          <ButtonLink href="/request-quote" size="sm" className="shadow-brand sm:hidden">
            {t('requestQuoteShort')}
          </ButtonLink>
          <MobileNav items={items} secondaryItems={secondaryItems} sectors={sectors} />
        </div>
      </Container>
    </ScrollHeader>
  );
}

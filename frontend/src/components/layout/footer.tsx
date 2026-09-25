import {
  Facebook,
  Github,
  Globe,
  Instagram,
  Linkedin,
  Mail,
  MessageCircle,
  Send,
  Twitter,
  Youtube,
  type LucideIcon,
} from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

import { SiteMark } from '@/components/layout/site-mark';
import { FooterTrackBox } from '@/features/track/track-box';
import { Container } from '@/components/ui/container';
import { getCaseStudies } from '@/lib/api/queries';
import type { SiteSettings } from '@/lib/api/types';
import { SITE_NAME_FALLBACK } from '@/lib/constants/site';
import { Link } from '@/lib/i18n/navigation';
import type { Locale } from '@/lib/i18n/routing';
import { whatsappLink } from '@/lib/utils/format';

/** أيقونات معروفة للمنصات بدل الحرف الأول من الاسم. */
const PLATFORM_ICONS: Record<string, LucideIcon> = {
  github: Github,
  linkedin: Linkedin,
  x: Twitter,
  facebook: Facebook,
  instagram: Instagram,
  youtube: Youtube,
  telegram: Send,
  whatsapp: MessageCircle,
  email: Mail,
};

const PLATFORM_LINKS = [
  { href: '/services', key: 'services' },
  { href: '/solutions', key: 'solutions' },
  { href: '/projects', key: 'projects' },
  { href: '/case-studies', key: 'caseStudies' },
  { href: '/about', key: 'about' },
] as const;

const KNOWLEDGE_LINKS = [
  { href: '/blog', key: 'blog' },
  { href: '/technologies', key: 'technologies' },
  { href: '/process', key: 'process' },
] as const;

export async function Footer({ settings }: { settings: SiteSettings | null }) {
  const locale = (await getLocale()) as Locale;
  const [t, tNav, tLegal, tCommon, caseStudies] = await Promise.all([
    getTranslations('footer'),
    getTranslations('nav'),
    getTranslations('legal'),
    getTranslations('common'),
    getCaseStudies(locale, { page_size: 1 }),
  ]);
  // لا رابط إلى قائمة فارغة: دراسات الحالة تظهر حين تُنشر واحدة على الأقل
  const platformLinks = PLATFORM_LINKS.filter(
    (item) => item.key !== 'caseStudies' || caseStudies.count > 0,
  );

  const year = new Date().getFullYear();
  const siteName = settings?.site_name || SITE_NAME_FALLBACK;
  // قناة بلا رابط لا تُعرض — رابط ناقص أسوأ من غيابه
  const socialLinks = (settings?.social_links ?? []).filter((link) => link.url);
  const waLink = settings?.whatsapp
    ? whatsappLink(settings.whatsapp, settings.whatsapp_default_message)
    : '';

  const linkClass = 'text-muted transition-colors hover:text-foreground';
  const headingClass = 'mb-4 text-sm font-semibold text-foreground';

  return (
    <footer className="mt-auto border-t border-border bg-surface/60">
      {/* مساحة محجوزة لزر واتساب العائم كي لا يغطي سطر الحقوق والروابط */}
      <Container className={waLink ? 'pb-24 pt-14' : 'py-14'}>
        <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
          {/* الهوية */}
          <div className="lg:pe-8">
            <div className="flex items-center gap-2">
              <SiteMark settings={settings} size={32} />
              <span className="text-lg font-bold">{siteName}</span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
              {settings?.tagline || t('tagline')}
            </p>

            {socialLinks.length ? (
              <ul className="mt-5 flex flex-wrap gap-2">
                {socialLinks.map((link) => {
                  const Icon = PLATFORM_ICONS[link.platform] ?? Globe;
                  return (
                    <li key={link.id}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer me"
                        title={link.label || link.platform_display}
                        className="inline-flex size-11 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:border-primary/40 hover:text-primary"
                        aria-label={link.label || link.platform_display}
                      >
                        <Icon className="size-[1.1rem]" aria-hidden="true" />
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          {/* المنصّة */}
          <nav aria-label={t('platform')}>
            <h2 className={headingClass}>{t('platform')}</h2>
            <ul className="flex flex-col gap-3 text-sm">
              {platformLinks.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={linkClass}>
                    {tNav(item.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* المعرفة */}
          <nav aria-label={t('knowledge')}>
            <h2 className={headingClass}>{t('knowledge')}</h2>
            <ul className="flex flex-col gap-3 text-sm">
              {KNOWLEDGE_LINKS.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={linkClass}>
                    {tNav(item.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* التواصل */}
          <nav aria-label={t('connect')}>
            <h2 className={headingClass}>{t('connect')}</h2>
            <ul className="flex flex-col gap-3 text-sm">
              <li>
                <Link href="/request-quote" className={linkClass}>
                  {tNav('requestQuote')}
                </Link>
              </li>
              <li>
                <Link href="/contact" className={linkClass}>
                  {t('messageMe')}
                </Link>
              </li>
              {waLink ? (
                <li>
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkClass}
                  >
                    {tCommon('whatsapp')}
                  </a>
                </li>
              ) : null}
              <li>
                <Link href="/privacy-policy" className={linkClass}>
                  {tLegal('privacyTitle')}
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <FooterTrackBox className="mt-12" />

        <div className="mt-12 flex flex-col gap-3 border-t border-border pt-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {siteName}. {t('rights')}
          </p>

          <Link href="/terms" className={linkClass}>
            {tLegal('termsTitle')}
          </Link>
        </div>
      </Container>
    </footer>
  );
}

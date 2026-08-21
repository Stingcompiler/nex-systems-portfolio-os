import { getTranslations } from 'next-intl/server';

import { Container } from '@/components/ui/container';
import type { SiteSettings } from '@/lib/api/types';
import { Link } from '@/lib/i18n/navigation';
import { whatsappLink } from '@/lib/utils/format';

const PLATFORM_LINKS = [
  { href: '/services', key: 'services' },
  { href: '/solutions', key: 'solutions' },
  { href: '/projects', key: 'projects' },
  { href: '/case-studies', key: 'caseStudies' },
] as const;

const KNOWLEDGE_LINKS = [
  { href: '/blog', key: 'blog' },
  { href: '/technologies', key: 'technologies' },
  { href: '/process', key: 'process' },
] as const;

export async function Footer({ settings }: { settings: SiteSettings | null }) {
  const [t, tNav, tLegal, tCommon] = await Promise.all([
    getTranslations('footer'),
    getTranslations('nav'),
    getTranslations('legal'),
    getTranslations('common'),
  ]);

  const year = new Date().getFullYear();
  const siteName = settings?.site_name || 'NEXA SYSTEMS';
  const socialLinks = settings?.social_links ?? [];
  const waLink = settings?.whatsapp
    ? whatsappLink(settings.whatsapp, settings.whatsapp_default_message)
    : '';

  const linkClass = 'text-muted transition-colors hover:text-foreground';
  const headingClass = 'mb-4 text-sm font-semibold text-foreground';

  return (
    <footer className="mt-auto border-t border-border bg-surface/60">
      <Container className="py-14">
        <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
          {/* الهوية */}
          <div className="lg:pe-8">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-brand text-sm font-bold text-white shadow-[0_2px_10px_-2px_rgb(var(--primary)/0.6)]">
                {siteName.charAt(0).toUpperCase()}
              </span>
              <span className="text-lg font-bold">{siteName}</span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
              {settings?.tagline || t('tagline')}
            </p>

            {socialLinks.length ? (
              <ul className="mt-5 flex flex-wrap gap-2">
                {socialLinks.map((link) => (
                  <li key={link.id}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer me"
                      className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:border-primary/40 hover:text-primary"
                      aria-label={link.label || link.platform_display}
                    >
                      {(link.label || link.platform_display).charAt(0)}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {/* المنصّة */}
          <nav aria-label={t('platform')}>
            <h2 className={headingClass}>{t('platform')}</h2>
            <ul className="flex flex-col gap-3 text-sm">
              {PLATFORM_LINKS.map((item) => (
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

        <div className="mt-12 flex flex-col gap-2 border-t border-border pt-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
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

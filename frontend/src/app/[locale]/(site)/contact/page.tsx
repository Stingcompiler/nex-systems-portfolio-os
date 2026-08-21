import { Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ButtonLink, ExternalButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { Breadcrumbs, Card, JsonLd } from '@/components/ui/misc';
import { ContactForm } from '@/features/contact/contact-form';
import { getSeoSettings, getSiteSettings } from '@/lib/api/queries';
import type { Locale } from '@/lib/i18n/routing';
import { breadcrumbJsonLd, professionalServiceJsonLd } from '@/lib/seo/json-ld';
import { buildMetadata } from '@/lib/seo/metadata';
import { whatsappLink } from '@/lib/utils/format';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const [t, settings, seoSettings] = await Promise.all([
    getTranslations({ locale, namespace: 'contact' }),
    getSiteSettings(locale as Locale),
    getSeoSettings(locale as Locale),
  ]);

  return buildMetadata({
    locale: locale as Locale,
    path: '/contact',
    title: t('title'),
    description: t('description'),
    settings,
    seoSettings,
  });
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  setRequestLocale(rawLocale);
  const locale = rawLocale as Locale;

  const [t, tNav, tCommon, settings] = await Promise.all([
    getTranslations('contact'),
    getTranslations('nav'),
    getTranslations('common'),
    getSiteSettings(locale),
  ]);

  const whatsapp = settings?.whatsapp
    ? whatsappLink(settings.whatsapp, settings.whatsapp_default_message)
    : '';

  const channels = [
    settings?.email
      ? { icon: Mail, label: tCommon('email'), value: settings.email, href: `mailto:${settings.email}` }
      : null,
    settings?.phone
      ? { icon: Phone, label: tCommon('phone'), value: settings.phone, href: `tel:${settings.phone}` }
      : null,
    settings?.city || settings?.address
      ? {
          icon: MapPin,
          label: tCommon('sector'),
          value: [settings?.address, settings?.city].filter(Boolean).join(' — '),
          href: null,
        }
      : null,
  ].filter(Boolean) as {
    icon: typeof Mail;
    label: string;
    value: string;
    href: string | null;
  }[];

  return (
    <>
      <JsonLd data={professionalServiceJsonLd(settings, locale)} />
      <JsonLd
        data={breadcrumbJsonLd(
          [
            { name: tNav('home'), path: '/' },
            { name: t('title'), path: '/contact' },
          ],
          locale,
        )}
      />

      <Container className="py-12 sm:py-16">
        <Breadcrumbs items={[{ name: tNav('home'), href: '/' }, { name: t('title') }]} label={tNav('breadcrumbs')} />

        <header className="mb-10 max-w-prose">
          <h1 className="text-h1 font-semibold">{t('title')}</h1>
          <p className="mt-3 text-muted">{t('description')}</p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <div className="flex flex-col gap-6">
            {whatsapp ? (
              <Card>
                <MessageCircle className="mb-3 size-8 text-success" aria-hidden="true" />
                <h2 className="text-h3 font-semibold">{tCommon('whatsapp')}</h2>
                <p className="mt-2 text-sm text-muted">{t('preferWhatsapp')}</p>
                <ExternalButtonLink href={whatsapp} className="mt-4 w-full">
                  {t('whatsappCta')}
                </ExternalButtonLink>
              </Card>
            ) : null}

            {channels.length ? (
              <Card>
                <h2 className="mb-4 text-h3 font-semibold">{t('channels')}</h2>
                <ul className="space-y-4">
                  {channels.map((channel) => (
                    <li key={channel.label} className="flex items-start gap-3">
                      <channel.icon
                        className="mt-0.5 size-5 shrink-0 text-muted"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="text-sm text-muted">{channel.label}</p>
                        {channel.href ? (
                          <a
                            href={channel.href}
                            dir={channel.href.startsWith('tel:') ? 'ltr' : undefined}
                            className="font-medium hover:text-primary"
                          >
                            {channel.value}
                          </a>
                        ) : (
                          <p className="font-medium">{channel.value}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            <Card className="bg-surface/60">
              <h2 className="text-h3 font-semibold">{t('startProjectTitle')}</h2>
              <p className="mt-2 text-sm text-muted">{t('startProjectBody')}</p>
              <ButtonLink href="/request-quote" variant="secondary" className="mt-4 w-full">
                {t('startProjectCta')}
              </ButtonLink>
            </Card>
          </div>

          <div>
            <h2 className="mb-4 text-h3 font-semibold">{t('formTitle')}</h2>
            <ContactForm />
          </div>
        </div>
      </Container>
    </>
  );
}

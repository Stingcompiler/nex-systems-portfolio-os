import { Check } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { Breadcrumbs, Card, JsonLd } from '@/components/ui/misc';
import { EmptyState } from '@/components/ui/states';
import {
  getFaqs,
  getProcessSteps,
  getSeoSettings,
  getSiteSettings,
} from '@/lib/api/queries';
import type { Locale } from '@/lib/i18n/routing';
import { breadcrumbJsonLd, faqJsonLd } from '@/lib/seo/json-ld';
import { buildMetadata } from '@/lib/seo/metadata';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const [t, settings, seoSettings] = await Promise.all([
    getTranslations({ locale, namespace: 'process' }),
    getSiteSettings(locale as Locale),
    getSeoSettings(locale as Locale),
  ]);

  return buildMetadata({
    locale: locale as Locale,
    path: '/process',
    title: t('title'),
    description: t('description'),
    settings,
    seoSettings,
  });
}

export default async function ProcessPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  setRequestLocale(rawLocale);
  const locale = rawLocale as Locale;

  const [t, tNav, tStates, steps, faqs] = await Promise.all([
    getTranslations('process'),
    getTranslations('nav'),
    getTranslations('states'),
    getProcessSteps(locale),
    getFaqs(locale, 'process'),
  ]);

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd(
          [
            { name: tNav('home'), path: '/' },
            { name: t('title'), path: '/process' },
          ],
          locale,
        )}
      />
      <JsonLd data={faqJsonLd(faqs)} />

      <Container className="py-12 sm:py-16">
        <Breadcrumbs items={[{ name: tNav('home'), href: '/' }, { name: t('title') }]} label={tNav('breadcrumbs')} />

        <header className="mb-10 max-w-prose">
          <h1 className="text-h1 font-semibold">{t('title')}</h1>
          <p className="mt-3 text-muted">{t('description')}</p>
        </header>

        {steps.length ? (
          <ol className="space-y-6">
            {steps.map((step, index) => (
              <li key={step.id}>
                <Card className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                    <span dir="ltr">{index + 1}</span>
                  </span>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="text-h3 font-semibold">{step.title}</h2>
                      {step.duration ? (
                        <span className="text-sm text-muted">
                          {t('duration')}: {step.duration}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-muted">{step.description}</p>

                    {step.deliverables?.length ? (
                      <>
                        <h3 className="mt-4 text-sm font-semibold">
                          {t('deliverables')}
                        </h3>
                        <ul className="mt-2 space-y-1">
                          {step.deliverables.map((item, itemIndex) => (
                            <li key={itemIndex} className="flex items-start gap-2 text-sm">
                              <Check
                                className="mt-1 size-3.5 shrink-0 text-success"
                                aria-hidden="true"
                              />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                  </div>
                </Card>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState title={tStates('emptyTitle')} body={tStates('emptyBody')} />
        )}

        {faqs.length ? (
          <section className="mt-16 max-w-prose">
            <h2 className="mb-4 text-h2 font-semibold">{tNav('process')}</h2>
            <div className="space-y-3">
              {faqs.map((faq) => (
                <details
                  key={faq.id}
                  className="rounded-lg border border-border bg-surface p-4"
                >
                  <summary className="cursor-pointer list-none font-medium">
                    {faq.question}
                  </summary>
                  <p className="mt-3 text-sm text-muted">{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>
        ) : null}

        <div className="mt-12">
          <ButtonLink href="/contact" size="lg">
            {tNav('requestQuote')}
          </ButtonLink>
        </div>
      </Container>
    </>
  );
}

import { ArrowRight, Check, MessageCircle } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { ProjectCard, ServiceCard, TechBadge } from '@/components/content/cards';
import { FaqList } from '@/components/content/faq-list';
import { ButtonLink, ExternalButtonLink } from '@/components/ui/button';
import { CardGrid } from '@/components/ui/card-grid';
import { Container } from '@/components/ui/container';
import { Badge, Breadcrumbs, Card, Prose } from '@/components/ui/misc';
import { Section, SectionHeader } from '@/components/ui/section';
import { EmptyState } from '@/components/ui/states';
import { Link } from '@/lib/i18n/navigation';
import type { ServiceDetail, ServiceListItem, SiteSettings } from '@/lib/api/types';
import type { Locale } from '@/lib/i18n/routing';
import { formatPrice, whatsappLink } from '@/lib/utils/format';

export type ServiceKind = 'services' | 'solutions';

/** فهرس الخدمات أو الحلول — نفس العرض لنوعين من نفس النموذج. */
export async function ServiceListView({
  items,
  kind,
  title,
  description,
}: {
  items: ServiceListItem[];
  kind: ServiceKind;
  title: string;
  description: string;
}) {
  const tStates = await getTranslations('states');
  const tNav = await getTranslations('nav');

  return (
    <Container className="py-12 sm:py-16">
      <Breadcrumbs items={[{ name: tNav('home'), href: '/' }, { name: title }]} label={tNav('breadcrumbs')} />

      <header className="mb-8 max-w-prose">
        <h1 className="text-h1 font-semibold">{title}</h1>
        <p className="mt-3 text-muted">{description}</p>
      </header>

      {/* مساران لنفس الحاجة: خدمات تطويرية، أو حلول جاهزة لقطاع بعينه.
          «الحلول» خرجت من الترويسة فصار الوصول إليها من هنا */}
      <nav aria-label={tNav('services')} className="mb-10">
        <ul className="inline-flex flex-wrap gap-1 rounded-xl border border-border bg-surface p-1">
          {(['services', 'solutions'] as const).map((path) => (
            <li key={path}>
              <Link
                href={`/${path}`}
                aria-current={kind === path ? 'page' : undefined}
                className={
                  kind === path
                    ? 'inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground'
                    : 'inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-medium text-muted hover:bg-surface-hover hover:text-foreground'
                }
              >
                {tNav(path)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {items.length ? (
        <CardGrid count={items.length}>
          {items.map((service) => (
            <ServiceCard key={service.id} service={service} basePath={`/${kind}`} />
          ))}
        </CardGrid>
      ) : (
        <EmptyState
          title={tStates('emptyServices')}
          body={tStates('emptyBody')}
          action={<ButtonLink href="/request-quote">{tNav('requestQuote')}</ButtonLink>}
        />
      )}
    </Container>
  );
}

/** صفحة الخدمة أو الحل الواحد. */
export async function ServiceDetailView({
  service,
  kind,
  locale,
  settings,
}: {
  service: ServiceDetail;
  kind: ServiceKind;
  locale: Locale;
  settings: SiteSettings | null;
}) {
  const [t, tNav, tCommon] = await Promise.all([
    getTranslations('services'),
    getTranslations('nav'),
    getTranslations('common'),
  ]);

  const indexLabel = kind === 'services' ? tNav('services') : tNav('solutions');
  const price = formatPrice(service.price_from, service.price_currency, locale);
  const waLink = settings?.whatsapp
    ? whatsappLink(settings.whatsapp, settings.whatsapp_default_message)
    : '';

  return (
    <>
      <Container className="py-12 sm:py-16">
        <Breadcrumbs
          label={tNav('breadcrumbs')}
          items={[
            { name: tNav('home'), href: '/' },
            { name: indexLabel, href: `/${kind}` },
            { name: service.title },
          ]}
        />

        <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
          <div>
            {/* شارة «مميّزة» تحكم الترتيب فقط، و«عام» هو القطاع الافتراضي */}
            {service.sector !== 'general' ? (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge>{service.sector_display}</Badge>
              </div>
            ) : null}

            <h1 className="text-h1 font-semibold">{service.title}</h1>
            <p className="mt-4 max-w-prose text-body-lg text-muted">
              {service.short_description}
            </p>

            <div className="mt-8">
              <Prose text={service.description} />
            </div>
          </div>

          {/* لوحة الطلب البارزة — السعر أولًا ثم التفاصيل ثم دعوتان */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Card className="glow-ring relative overflow-hidden">
              <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-brand" />

              {price ? (
                <div className="mb-5">
                  <p className="text-sm text-muted">{t('priceFrom')}</p>
                  <p className="mt-1 text-h1 font-bold leading-none">
                    <span className="code-inline inline">{price}</span>
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {service.price_note || t('forWholeProject')}
                  </p>
                </div>
              ) : null}

              <dl className="space-y-3 border-t border-border pt-5 text-sm">
                {service.duration_estimate ? (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted">{t('duration')}</dt>
                    <dd className="font-medium">{service.duration_estimate}</dd>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">{t('languages')}</dt>
                  <dd className="font-medium">{t('languagesValue')}</dd>
                </div>
                {service.sector !== 'general' ? (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted">{tCommon('sector')}</dt>
                    <dd className="font-medium">{service.sector_display}</dd>
                  </div>
                ) : null}
              </dl>

              <div className="mt-6 flex flex-col gap-2">
                <ButtonLink
                  href={`/request-quote?service=${encodeURIComponent(service.slug)}${kind === 'solutions' ? '&kind=solutions' : ''}`}
                  size="lg"
                  className="w-full"
                >
                  {t('requestThis')}
                  <ArrowRight className="size-4 flip-rtl" aria-hidden="true" />
                </ButtonLink>
                {waLink ? (
                  <ExternalButtonLink href={waLink} variant="secondary" className="w-full">
                    <MessageCircle className="size-4" aria-hidden="true" />
                    {t('whatsappCta')}
                  </ExternalButtonLink>
                ) : null}
              </div>

              <p className="mt-4 text-center text-xs text-muted">
                <Link href="/contact" className="hover:text-foreground hover:underline">
                  {t('notSureScope')}
                </Link>
              </p>
            </Card>

            {service.technologies.length ? (
              <div className="mt-6">
                <h2 className="mb-3 text-sm font-semibold">{tCommon('technologies')}</h2>
                <ul className="flex flex-wrap gap-2">
                  {service.technologies.map((technology) => (
                    <li key={technology.id}>
                      <TechBadge technology={technology} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>
        </div>
      </Container>

      {service.features.length ? (
        <Section tone="muted">
          <SectionHeader title={t('whatIncluded')} />
          <ul className="grid gap-4 sm:grid-cols-2">
            {service.features.map((feature, index) => (
              <li key={index}>
                <div className="flex h-full items-start gap-3 rounded-xl border border-border bg-surface p-5 shadow-subtle">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-success-soft text-success">
                    <Check className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-semibold">{feature.title}</h3>
                    {feature.description ? (
                      <p className="mt-1 text-sm text-muted">{feature.description}</p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {service.deliverables.length ? (
        <Section>
          <SectionHeader title={t('deliverables')} />
          <ul className="grid max-w-prose gap-3">
            {service.deliverables.map((item, index) => (
              <li key={index} className="flex items-start gap-3">
                <Check className="mt-1 size-4 shrink-0 text-success" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {service.related_projects.length ? (
        <Section tone="muted">
          <SectionHeader title={t('relatedProjects')} />
          <CardGrid count={service.related_projects.length}>
            {service.related_projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </CardGrid>
        </Section>
      ) : null}

      {service.faqs.length ? (
        <Section>
          <SectionHeader title={t('faq')} />
          <FaqList faqs={service.faqs} />
        </Section>
      ) : null}
    </>
  );
}

import { WifiOff } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';

export const metadata = { robots: { index: false, follow: false } };

export default async function OfflinePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('offline');

  return (
    <Container className="grid min-h-[60vh] place-items-center py-16 text-center">
      <div>
        <WifiOff className="mx-auto mb-4 size-12 text-muted" aria-hidden="true" />
        <h1 className="text-h1 font-semibold">{t('title')}</h1>
        <p className="mt-3 max-w-prose text-muted">{t('body')}</p>
        <ButtonLink href="/" className="mt-8">
          {t('retry')}
        </ButtonLink>
      </div>
    </Container>
  );
}

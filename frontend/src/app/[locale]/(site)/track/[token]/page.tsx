import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Container } from '@/components/ui/container';
import { TrackDetailView } from '@/features/track/track-detail';

/** صفحة شخصية برمز سري: لا فهرسة، ولا يُرسل عنوانها إلى مواقع أخرى. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'track' });
  return {
    title: t('title'),
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  };
}

export default async function TrackDetailPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('track');

  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-8 text-h1 font-semibold">{t('title')}</h1>
        <TrackDetailView token={token} />
      </div>
    </Container>
  );
}

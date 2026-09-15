import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AuthShell } from '@/features/member/auth-shell';
import { ConfirmView } from '@/features/newsletter/token-views';

// صفحات الرموز لا تُفهرَس — الرابط شخصي
export const metadata = { robots: { index: false, follow: false } };

export default async function NewsletterConfirmViewPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('newsletter');

  return (
    <AuthShell title={t('confirmTitle')}>
      <ConfirmView token={token} />
    </AuthShell>
  );
}

import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AuthShell } from '@/features/member/auth-shell';
import { VerifyEmailView } from '@/features/member/verify-email';

export const metadata = { robots: { index: false, follow: false } };

export default async function VerifyEmailPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('auth');

  return (
    <AuthShell title={t('verifyTitle')}>
      <VerifyEmailView token={token} />
    </AuthShell>
  );
}

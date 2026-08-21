import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AuthShell } from '@/features/member/auth-shell';
import { ResetPasswordForm } from '@/features/member/forms';

export const metadata = { robots: { index: false, follow: false } };

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('auth');

  return (
    <AuthShell title={t('resetTitle')} subtitle={t('resetSubtitle')}>
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}

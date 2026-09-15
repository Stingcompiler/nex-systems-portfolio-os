import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';

import { AuthShell } from '@/features/member/auth-shell';
import { UnsubscribeView } from '@/features/newsletter/token-views';

// صفحات الرموز لا تُفهرَس — الرابط شخصي
export const metadata = { robots: { index: false, follow: false } };

export default async function NewsletterUnsubscribeViewPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('newsletter');

  return (
    <AuthShell title={t('unsubscribeTitle')}>
      {/* useSearchParams يقرأ رمز الحملة (?c=) — يحتاج حدود Suspense */}
      <Suspense>
        <UnsubscribeView token={token} />
      </Suspense>
    </AuthShell>
  );
}

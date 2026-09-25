import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';

import { InstallAppButton } from '@/components/layout/install-app-button';
import { AuthShell } from '@/features/member/auth-shell';
import { LoginForm } from '@/features/member/forms';
import { getSeoSettings, getSiteSettings } from '@/lib/api/queries';
import { Link } from '@/lib/i18n/navigation';
import type { Locale } from '@/lib/i18n/routing';
import { buildMetadata } from '@/lib/seo/metadata';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  // الإعدادات تحمل اسم الموقع بلغة الصفحة؛ بدونها يُلحق بالعنوان الاسم
  // الاحتياطي الإنجليزي حتى في الصفحة العربية
  const [t, settings, seoSettings] = await Promise.all([
    getTranslations({ locale, namespace: 'auth' }),
    getSiteSettings(locale as Locale),
    getSeoSettings(locale as Locale),
  ]);
  return buildMetadata({
    locale: locale as Locale,
    path: '/login',
    title: t('loginTitle'),
    noIndex: true,
    settings,
    seoSettings,
  });
}

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('auth');

  return (
    <AuthShell
      title={t('loginTitle')}
      subtitle={t('loginSubtitle')}
      footer={
        <>
          {t('noAccount')}{' '}
          <Link href="/register" className="text-primary hover:underline">
            {t('registerLink')}
          </Link>
        </>
      }
    >
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
      <InstallAppButton className="mt-6" />
    </AuthShell>
  );
}

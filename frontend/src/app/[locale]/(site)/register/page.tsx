import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AuthShell } from '@/features/member/auth-shell';
import { RegisterForm } from '@/features/member/forms';
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
    path: '/register',
    title: t('registerTitle'),
    noIndex: true,
    settings,
    seoSettings,
  });
}

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('auth');

  return (
    <AuthShell
      title={t('registerTitle')}
      subtitle={t('registerSubtitle')}
      footer={
        <>
          {t('haveAccount')}{' '}
          <Link href="/login" className="text-primary hover:underline">
            {t('loginLink')}
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}

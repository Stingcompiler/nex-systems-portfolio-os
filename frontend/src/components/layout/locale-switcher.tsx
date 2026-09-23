'use client';

import { Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useTransition } from 'react';

import { usePathname, useRouter } from '@/lib/i18n/navigation';
import type { Locale } from '@/lib/i18n/routing';

/**
 * يبدّل اللغة مع البقاء في نفس الصفحة ونفس المعاملات.
 * التخزين يتولاه next-intl عبر كوكي NEXT_LOCALE.
 */
export function LocaleSwitcher() {
  const t = useTranslations('common');
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const target: Locale = locale === 'ar' ? 'en' : 'ar';

  function switchLocale() {
    startTransition(() => {
      router.replace(
        // @ts-expect-error المعاملات الديناميكية تُمرَّر كما هي
        { pathname, params },
        { locale: target },
      );
    });
  }

  // اسم اللغة الهدف بلغتها — الأيقونة وحدها لا تقول إلى أي لغة سيتحوّل الموقع
  const targetName = target === 'ar' ? 'العربية' : 'English';

  return (
    <button
      type="button"
      onClick={switchLocale}
      disabled={isPending}
      lang={target}
      aria-label={`${t('language')}: ${targetName}`}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted transition-colors duration-fast hover:bg-surface-hover hover:text-foreground disabled:opacity-60"
    >
      <Languages className="size-4" aria-hidden="true" />
      {targetName}
    </button>
  );
}

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

  return (
    <button
      type="button"
      onClick={switchLocale}
      disabled={isPending}
      lang={target}
      aria-label={t('language')}
      className="flex size-9 items-center justify-center rounded-full text-muted transition-colors duration-fast hover:bg-surface-hover hover:text-foreground disabled:opacity-60"
    >
      <Languages className="size-[1.1rem]" aria-hidden="true" />
    </button>
  );
}

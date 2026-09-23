'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { ErrorState } from '@/components/ui/states';

export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('states');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    console.error('[site] خطأ غير متوقع:', error);
  }, [error]);

  return (
    <Container className="py-20">
      <ErrorState
        title={t('errorTitle')}
        body={t('errorBody')}
        action={
          // الخطأ غالبًا من جلب في مكوّن خادم: reset وحده يعيد رسم العميل
          // بالبيانات نفسها، و refresh يطلب الصفحة من الخادم مجددًا
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(() => {
                router.refresh();
                reset();
              })
            }
          >
            {tCommon('retry')}
          </Button>
        }
      />
    </Container>
  );
}

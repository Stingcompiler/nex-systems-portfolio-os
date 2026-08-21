'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

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

  useEffect(() => {
    console.error('[site] خطأ غير متوقع:', error);
  }, [error]);

  return (
    <Container className="py-20">
      <ErrorState
        title={t('errorTitle')}
        body={t('errorBody')}
        action={<Button onClick={reset}>{tCommon('retry')}</Button>}
      />
    </Container>
  );
}

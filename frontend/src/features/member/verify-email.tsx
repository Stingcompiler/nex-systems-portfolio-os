'use client';

import { CircleCheck, CircleX, LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { useMember } from '@/contexts/MemberContext';
import { api } from '@/lib/api/client';
import { Link } from '@/lib/i18n/navigation';

export function VerifyEmailView({ token }: { token: string }) {
  const t = useTranslations('auth');
  const { refresh } = useMember();
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    api
      .post('/auth/verify-email/', { token })
      .then(() => {
        setState('ok');
        refresh(); // تحديث حالة العضو (is_email_verified)
      })
      .catch(() => setState('error'));
  }, [token, refresh]);

  if (state === 'loading') {
    return (
      <div className="grid place-items-center gap-3 py-6 text-muted" role="status">
        <LoaderCircle className="size-6 animate-spin" aria-hidden="true" />
        <span>{t('verifying')}</span>
      </div>
    );
  }

  if (state === 'ok') {
    return (
      <div className="text-center">
        <CircleCheck className="mx-auto mb-3 size-10 text-success" aria-hidden="true" />
        <p className="mb-6">{t('verifySuccess')}</p>
        <Link
          href="/member"
          className="inline-flex min-h-11 items-center rounded bg-primary px-5 font-medium text-primary-foreground"
        >
          {t('goToAccount')}
        </Link>
      </div>
    );
  }

  return (
    <div className="text-center">
      <CircleX className="mx-auto mb-3 size-10 text-danger" aria-hidden="true" />
      <p className="mb-6">{t('verifyError')}</p>
      <Link href="/member" className="text-primary hover:underline">
        {t('goToAccount')}
      </Link>
    </div>
  );
}

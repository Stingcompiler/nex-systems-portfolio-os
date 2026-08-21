'use client';

import { LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { useMember } from '@/contexts/MemberContext';
import { useToast } from '@/contexts/ToastContext';
import { api, toApiError } from '@/lib/api/client';

export default function MemberOverviewPage() {
  const t = useTranslations('member');
  const { member, refresh } = useMember();
  const toast = useToast();

  const [fullName, setFullName] = useState(member?.full_name ?? '');
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      await api.patch('/auth/me/', { full_name: fullName });
      await refresh();
      toast.success(t('profileSaved'));
    } catch (error) {
      toast.error(toApiError(error).detail);
    } finally {
      setPending(false);
    }
  }

  async function resendVerification() {
    setResending(true);
    try {
      await api.post('/auth/resend-verification/', {});
      toast.success(t('verificationResent'));
    } catch (error) {
      toast.error(toApiError(error).detail);
    } finally {
      setResending(false);
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-h2 font-semibold">{t('tabs.overview')}</h1>

      {!member?.is_email_verified ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4">
          <p className="text-sm">{t('verifyPrompt')}</p>
          <button
            type="button"
            onClick={resendVerification}
            disabled={resending}
            className="inline-flex min-h-10 items-center gap-2 rounded border border-warning/50 px-4 text-sm font-medium disabled:opacity-60"
          >
            {resending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
            {t('resendVerification')}
          </button>
        </div>
      ) : null}

      <form onSubmit={saveProfile} className="max-w-md rounded-lg border border-border bg-surface p-6">
        <h2 className="mb-4 text-h3 font-semibold">{t('profile')}</h2>
        <div className="mb-4">
          <label htmlFor="full_name" className="mb-1.5 block text-sm font-medium">
            {t('fullName')}
          </label>
          <input
            id="full_name"
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="min-h-11 w-full rounded border border-border bg-background px-3 text-sm"
          />
        </div>
        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium">{t('email')}</label>
          <p className="min-h-11 rounded border border-border bg-surface-hover px-3 py-2.5 text-sm text-muted" dir="ltr">
            {member?.email}
          </p>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center gap-2 rounded bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
          {t('save')}
        </button>
      </form>
    </div>
  );
}

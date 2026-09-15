'use client';

import { useQuery } from '@tanstack/react-query';
import { CircleCheck, CircleX, LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { InterestPicker } from '@/features/newsletter/interest-picker';
import {
  confirmSubscription,
  fetchInterests,
  fetchPreferences,
  unsubscribe,
  updatePreferences,
  type SubscriptionPreferences,
} from '@/features/newsletter/newsletter-api';
import { toApiError } from '@/lib/api/client';
import { Link } from '@/lib/i18n/navigation';
import { useLocale } from 'next-intl';

type State = 'loading' | 'ok' | 'error';

function Pending({ text }: { text: string }) {
  return (
    <div className="grid place-items-center gap-3 py-6 text-muted" role="status">
      <LoaderCircle className="size-6 animate-spin" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}

const PRIMARY_LINK =
  'inline-flex min-h-11 items-center rounded bg-primary px-5 font-medium text-primary-foreground';

/** صفحة التأكيد: تستهلك الرمز مرة واحدة عند التحميل. */
export function ConfirmView({ token }: { token: string }) {
  const t = useTranslations('newsletter');
  const [state, setState] = useState<State>('loading');
  const [prefsToken, setPrefsToken] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    confirmSubscription(token)
      .then((data) => {
        setPrefsToken(data.preferences_token);
        setState('ok');
      })
      .catch(() => setState('error'));
  }, [token]);

  if (state === 'loading') return <Pending text={t('confirming')} />;

  if (state === 'ok') {
    return (
      <div className="text-center">
        <CircleCheck className="mx-auto mb-3 size-10 text-success" aria-hidden="true" />
        <p className="mb-6">{t('confirmSuccess')}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/" className={PRIMARY_LINK}>
            {t('backHome')}
          </Link>
          {prefsToken ? (
            <Link
              href={`/newsletter/preferences/${prefsToken}`}
              className="inline-flex min-h-11 items-center rounded border border-border px-5 font-medium"
            >
              {t('managePreferences')}
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <CircleX className="mx-auto mb-3 size-10 text-danger" aria-hidden="true" />
      <p className="mb-6">{t('confirmError')}</p>
      <Link href="/#newsletter" className={PRIMARY_LINK}>
        {t('resubscribe')}
      </Link>
    </div>
  );
}

/** إلغاء بنقرة واحدة: الرابط نفسه هو الإثبات، فلا طلب دخول ولا زر إضافي. */
export function UnsubscribeView({ token }: { token: string }) {
  const t = useTranslations('newsletter');
  const params = useSearchParams();
  const campaignToken = params.get('c') ?? undefined;
  const [state, setState] = useState<State>('loading');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    unsubscribe(token, campaignToken)
      .then(() => setState('ok'))
      .catch(() => setState('error'));
  }, [token, campaignToken]);

  if (state === 'loading') return <Pending text={t('unsubscribing')} />;

  if (state === 'ok') {
    return (
      <div className="text-center">
        <CircleCheck className="mx-auto mb-3 size-10 text-success" aria-hidden="true" />
        <p className="mb-6">{t('unsubscribeSuccess')}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/" className={PRIMARY_LINK}>
            {t('backHome')}
          </Link>
          <Link
            href={`/newsletter/preferences/${token}`}
            className="inline-flex min-h-11 items-center rounded border border-border px-5 font-medium"
          >
            {t('resubscribe')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <CircleX className="mx-auto mb-3 size-10 text-danger" aria-hidden="true" />
      <p className="mb-6">{t('unsubscribeError')}</p>
      <Link href="/" className="text-primary hover:underline">
        {t('backHome')}
      </Link>
    </div>
  );
}

/** نموذج التفضيلات المشترك بين رابط البريد وصفحة العضو. */
export function PreferencesForm({
  initial,
  onSave,
  onUnsubscribe,
}: {
  initial: SubscriptionPreferences;
  onSave: (payload: {
    name?: string;
    language: 'ar' | 'en';
    interests: string[];
    resubscribe?: boolean;
  }) => Promise<SubscriptionPreferences>;
  onUnsubscribe?: () => Promise<void>;
}) {
  const t = useTranslations('newsletter');
  const locale = useLocale();
  const [name, setName] = useState(initial.name);
  const [language, setLanguage] = useState<'ar' | 'en'>(initial.language);
  const [interests, setInterests] = useState<string[]>(initial.interests);
  const [status, setStatus] = useState(initial.status);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const interestsQuery = useQuery({
    queryKey: ['interests', locale],
    queryFn: () => fetchInterests(locale),
    staleTime: 60 * 60_000,
  });

  const statusText = {
    active: t('statusActive'),
    pending: t('statusPending'),
    unsubscribed: t('statusUnsubscribed'),
    bounced: t('statusUnsubscribed'),
    complained: t('statusUnsubscribed'),
    none: t('statusNone'),
  }[status];

  async function submit(event: FormEvent, resubscribe = false) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      const saved = await onSave({ name, language, interests, resubscribe });
      setStatus(saved.status);
      setMessage({ tone: 'ok', text: resubscribe ? t('sent') : t('saved') });
    } catch (err) {
      setMessage({ tone: 'error', text: toApiError(err).detail });
    } finally {
      setPending(false);
    }
  }

  async function cancel() {
    if (!onUnsubscribe) return;
    setPending(true);
    try {
      await onUnsubscribe();
      setStatus('unsubscribed');
      setMessage({ tone: 'ok', text: t('unsubscribeSuccess') });
    } catch (err) {
      setMessage({ tone: 'error', text: toApiError(err).detail });
    } finally {
      setPending(false);
    }
  }

  const canResubscribe = status === 'unsubscribed' || status === 'none';

  return (
    <form onSubmit={(event) => submit(event, canResubscribe)} className="text-start">
      <p className="mb-4 flex items-center gap-2 text-sm">
        <span
          className={
            status === 'active'
              ? 'size-2 rounded-full bg-success'
              : status === 'pending'
                ? 'size-2 rounded-full bg-warning'
                : 'size-2 rounded-full bg-muted'
          }
          aria-hidden="true"
        />
        <span className="font-medium">{statusText}</span>
        <span className="text-muted" dir="ltr">
          {initial.email}
        </span>
      </p>

      {initial.status !== 'none' ? (
        <div className="mb-4">
          <label htmlFor="pref-name" className="mb-1.5 block text-sm font-medium">
            {t('name')}
          </label>
          <input
            id="pref-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="min-h-11 w-full rounded border border-border bg-background px-3 text-sm"
          />
        </div>
      ) : null}

      <div className="mb-4">
        <label htmlFor="pref-language" className="mb-1.5 block text-sm font-medium">
          {t('language')}
        </label>
        <select
          id="pref-language"
          value={language}
          onChange={(event) => setLanguage(event.target.value as 'ar' | 'en')}
          className="min-h-11 w-full rounded border border-border bg-background px-3 text-sm"
        >
          <option value="ar">العربية</option>
          <option value="en">English</option>
        </select>
      </div>

      <div className="mb-6">
        <InterestPicker
          interests={interestsQuery.data ?? []}
          selected={interests}
          onChange={setInterests}
          label={t('interests')}
        />
      </div>

      {message ? (
        <p
          role={message.tone === 'error' ? 'alert' : 'status'}
          className={
            message.tone === 'error'
              ? 'mb-4 rounded border border-danger/40 bg-danger/10 p-3 text-sm'
              : 'mb-4 rounded border border-success/40 bg-success/10 p-3 text-sm'
          }
        >
          {message.text}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={PRIMARY_LINK + ' disabled:opacity-60'}>
          {pending ? <LoaderCircle className="me-2 size-4 animate-spin" aria-hidden="true" /> : null}
          {canResubscribe ? t('resubscribe') : t('save')}
        </button>
        {onUnsubscribe && status === 'active' ? (
          <button
            type="button"
            onClick={cancel}
            disabled={pending}
            className="inline-flex min-h-11 items-center rounded border border-border px-4 text-sm text-muted hover:text-danger"
          >
            {t('unsubscribe')}
          </button>
        ) : null}
      </div>
    </form>
  );
}

/** صفحة التفضيلات عبر الرمز الموقّع من البريد. */
export function PreferencesView({ token }: { token: string }) {
  const t = useTranslations('newsletter');
  const query = useQuery({
    queryKey: ['newsletter-preferences', token],
    queryFn: () => fetchPreferences(token),
    retry: false,
  });

  if (query.isLoading) return <Pending text="…" />;
  if (query.isError || !query.data) {
    return (
      <div className="text-center">
        <CircleX className="mx-auto mb-3 size-10 text-danger" aria-hidden="true" />
        <p className="mb-6">{t('unsubscribeError')}</p>
        <Link href="/" className="text-primary hover:underline">
          {t('backHome')}
        </Link>
      </div>
    );
  }

  return (
    <PreferencesForm
      initial={query.data}
      onSave={(payload) => updatePreferences(token, payload)}
      onUnsubscribe={async () => {
        await unsubscribe(token);
      }}
    />
  );
}

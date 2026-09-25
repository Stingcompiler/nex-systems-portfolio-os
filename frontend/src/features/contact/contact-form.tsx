'use client';

import { Check, LoaderCircle, Send } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useState, type FormEvent, type ReactNode } from 'react';

import { buttonClass } from '@/components/ui/button-styles';
import { fieldClass } from '@/components/ui/field';
import { api, toApiError, type ApiErrorPayload } from '@/lib/api/client';
import { Link } from '@/lib/i18n/navigation';
import type { Locale } from '@/lib/i18n/routing';
import { cn } from '@/lib/utils/cn';

export function ContactForm() {
  const t = useTranslations('contact');
  const tTrack = useTranslations('track');
  const locale = useLocale() as Locale;

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
    website: '', // honeypot
  });
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState<{ reference_code?: string; tracking_token?: string } | null>(
    null,
  );
  const [error, setError] = useState<ApiErrorPayload | null>(null);
  const [errors, setErrors] = useState<Partial<Record<'message' | 'contact' | 'email', string>>>(
    {},
  );

  function set(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === 'message') setErrors(({ message: _m, ...rest }) => rest);
    if (key === 'email' || key === 'phone') setErrors(({ contact: _c, email: _e, ...rest }) => rest);
  }

  /** الرسالة يجب أن تكون قابلة للرد: نصّ ووسيلة تواصل — القاعدة نفسها في الخادم. */
  function validate() {
    const found: typeof errors = {};
    if (!form.message.trim()) found.message = t('errors.message');
    if (!form.email.trim() && !form.phone.trim()) found.contact = t('errors.contact');
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      found.email = t('errors.email');
    }
    return found;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    setError(null);
    try {
      const { data } = await api.post<{ reference_code?: string; tracking_token?: string }>(
        '/contact-messages/submit/',
        { ...form, language: locale },
      );
      setSent(data ?? {});
    } catch (caught) {
      const payload = toApiError(caught);
      const server = payload.errors ?? {};
      setErrors({
        ...(server.message ? { message: t('errors.message') } : {}),
        ...(server.contact ? { contact: t('errors.contact') } : {}),
        ...(server.email ? { email: t('errors.email') } : {}),
      });
      setError(payload);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-lg border border-success/40 bg-success/5 p-6 text-center">
        <Check className="mx-auto mb-2 size-8 text-success" aria-hidden="true" />
        <p className="font-medium">{t('sentTitle')}</p>
        <p className="mt-1 text-sm text-muted">{t('sentBody')}</p>
        {sent.reference_code ? (
          <p className="mt-4 inline-block rounded-lg bg-surface-hover px-4 py-2 text-sm">
            {tTrack('referenceLabel')}:{' '}
            <strong dir="ltr" className="font-mono">{sent.reference_code}</strong>
          </p>
        ) : null}
        {sent.tracking_token ? (
          <div className="mt-4">
            <Link href={`/track/${sent.tracking_token}`} className={buttonClass('primary', 'sm')}>
              {tTrack('trackMessageLink')}
            </Link>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="rounded-lg border border-border bg-surface p-6">
      <p className="mb-5 text-sm text-muted">{t('formHelp')}</p>

      {error && !Object.keys(error.errors ?? {}).length ? (
        <div role="alert" className="mb-4 rounded border border-danger/40 bg-danger-soft p-3 text-sm">
          {t('errors.network')}
        </div>
      ) : null}

      {errors.contact ? (
        <p role="alert" className="mb-4 rounded border border-danger/40 bg-danger-soft p-3 text-sm text-danger">
          {errors.contact}
        </p>
      ) : null}

      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={form.website}
        onChange={(event) => set('website', event.target.value)}
        className="sr-only"
        aria-hidden="true"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('nameField')} optional={t('optional')}>
          {(control) => (
            <input
              {...control}
              type="text"
              value={form.name}
              onChange={(event) => set('name', event.target.value)}
              className={fieldClass()}
            />
          )}
        </Field>
        <Field label={t('emailField')} error={errors.email} invalid={Boolean(errors.contact)}>
          {(control) => (
            <input
              {...control}
              type="email"
              dir="ltr"
              value={form.email}
              onChange={(event) => set('email', event.target.value)}
              className={fieldClass({ className: 'text-start' })}
            />
          )}
        </Field>
        <Field label={t('phoneField')} invalid={Boolean(errors.contact)}>
          {(control) => (
            <input
              {...control}
              type="tel"
              dir="ltr"
              value={form.phone}
              onChange={(event) => set('phone', event.target.value)}
              className={fieldClass({ className: 'text-start' })}
            />
          )}
        </Field>
        <Field label={t('subjectField')} optional={t('optional')}>
          {(control) => (
            <input
              {...control}
              type="text"
              value={form.subject}
              onChange={(event) => set('subject', event.target.value)}
              className={fieldClass()}
            />
          )}
        </Field>
      </div>

      <div className="mt-4">
        <Field required label={t('messageField')} error={errors.message}>
          {(control) => (
            <textarea
              {...control}
              rows={5}
              value={form.message}
              onChange={(event) => set('message', event.target.value)}
              className={fieldClass({ multiline: true })}
            />
          )}
        </Field>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className={buttonClass('primary', 'md', 'mt-6')}
      >
        {submitting ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Send className="size-4 flip-rtl" aria-hidden="true" />
        )}
        {t('sendButton')}
      </button>
    </form>
  );
}

function Field({
  label,
  required,
  optional,
  error,
  invalid,
  children,
}: {
  label: string;
  required?: boolean;
  /** نص «اختياري» يُلحق بالتسمية */
  optional?: string;
  error?: string;
  /** تمييز الحقل دون رسالة خاصة (خطأ مشترك بين البريد والهاتف) */
  invalid?: boolean;
  /** يستلم id وسمات الوصف والخطأ ليضعها على الحقل نفسه */
  children: (control: {
    id: string;
    required?: boolean;
    'aria-required'?: boolean;
    'aria-invalid'?: boolean;
    'aria-describedby'?: string;
  }) => ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
        {required ? <span className="text-danger" aria-hidden="true"> *</span> : null}
        {optional ? <span className="font-normal text-muted"> ({optional})</span> : null}
      </label>
      <div
        className={cn(
          (error || invalid) && '[&_input]:border-danger [&_textarea]:border-danger',
        )}
      >
        {children({
          id,
          required,
          'aria-required': required || undefined,
          'aria-invalid': error || invalid ? true : undefined,
          'aria-describedby': error ? errorId : undefined,
        })}
      </div>
      {error ? (
        <p id={errorId} className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

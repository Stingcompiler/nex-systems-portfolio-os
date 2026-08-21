'use client';

import { Check, LoaderCircle, Send } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { api, fieldError, toApiError, type ApiErrorPayload } from '@/lib/api/client';
import type { Locale } from '@/lib/i18n/routing';
import { cn } from '@/lib/utils/cn';

export function ContactForm() {
  const t = useTranslations('contact');
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
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<ApiErrorPayload | null>(null);

  function set(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/contact-messages/submit/', { ...form, language: locale });
      setSent(true);
    } catch (caught) {
      setError(toApiError(caught));
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
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="rounded-lg border border-border bg-surface p-6">
      {error && !Object.keys(error.errors).length ? (
        <div role="alert" className="mb-4 rounded border border-danger/40 bg-danger/10 p-3 text-sm">
          {error.detail}
        </div>
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
        <Field label={t('nameField')} error={error ? fieldError(error, 'name') : undefined}>
          <input
            type="text"
            value={form.name}
            onChange={(event) => set('name', event.target.value)}
            className="min-h-11 w-full rounded border border-border bg-background px-3 text-sm"
          />
        </Field>
        <Field label={t('emailField')} error={error ? fieldError(error, 'email') : undefined}>
          <input
            type="email"
            dir="ltr"
            value={form.email}
            onChange={(event) => set('email', event.target.value)}
            className="min-h-11 w-full rounded border border-border bg-background px-3 text-start text-sm"
          />
        </Field>
        <Field label={t('phoneField')}>
          <input
            type="tel"
            dir="ltr"
            value={form.phone}
            onChange={(event) => set('phone', event.target.value)}
            className="min-h-11 w-full rounded border border-border bg-background px-3 text-start text-sm"
          />
        </Field>
        <Field label={t('subjectField')}>
          <input
            type="text"
            value={form.subject}
            onChange={(event) => set('subject', event.target.value)}
            className="min-h-11 w-full rounded border border-border bg-background px-3 text-sm"
          />
        </Field>
      </div>

      <div className="mt-4">
        <Field label={t('messageField')} error={error ? fieldError(error, 'message') : undefined}>
          <textarea
            rows={5}
            value={form.message}
            onChange={(event) => set('message', event.target.value)}
            className="min-h-28 w-full rounded border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="mt-6 inline-flex min-h-11 items-center gap-2 rounded bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-60"
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
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </label>
      <div className={cn(error && '[&_input]:border-danger [&_textarea]:border-danger')}>
        {children}
      </div>
      {error ? <p className="mt-1 text-sm text-danger">{error}</p> : null}
    </div>
  );
}

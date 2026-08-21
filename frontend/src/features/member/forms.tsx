'use client';

import { LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { useMember } from '@/contexts/MemberContext';
import { api, fieldError, toApiError, type ApiErrorPayload } from '@/lib/api/client';
import { Link, useRouter } from '@/lib/i18n/navigation';

function Field({
  id,
  label,
  type = 'text',
  value,
  onChange,
  error,
  autoComplete,
  dir,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoComplete?: string;
  dir?: 'ltr' | 'rtl';
}) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type={type}
        dir={dir}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        className="min-h-11 w-full rounded border border-border bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
      />
      {error ? <p className="mt-1 text-sm text-danger">{error}</p> : null}
    </div>
  );
}

function SubmitButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded bg-primary px-5 font-medium text-primary-foreground disabled:opacity-60"
    >
      {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
      {label}
    </button>
  );
}

function ErrorBanner({ error }: { error: ApiErrorPayload | null }) {
  if (!error || Object.keys(error.errors).length) return null;
  return (
    <div role="alert" className="mb-4 rounded border border-danger/40 bg-danger/10 p-3 text-sm">
      {error.detail}
    </div>
  );
}

// --------------------------------------------------------------- تسجيل الدخول

export function LoginForm() {
  const t = useTranslations('auth');
  const { login } = useMember();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/member';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiErrorPayload | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await login(email, password);
      router.replace(next);
    } catch (caught) {
      setError(toApiError(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <ErrorBanner error={error} />
      <Field id="email" label={t('email')} type="email" dir="ltr" autoComplete="username"
        value={email} onChange={setEmail} error={error ? fieldError(error, 'email') : undefined} />
      <Field id="password" label={t('password')} type="password" autoComplete="current-password"
        value={password} onChange={setPassword} />
      <div className="mb-4 text-end">
        <Link href="/forgot-password" className="text-sm text-primary hover:underline">
          {t('forgotPassword')}
        </Link>
      </div>
      <SubmitButton pending={pending} label={t('loginButton')} />
    </form>
  );
}

// --------------------------------------------------------------- التسجيل

export function RegisterForm() {
  const t = useTranslations('auth');
  const { setMember } = useMember();
  const router = useRouter();

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    password_confirm: '',
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiErrorPayload | null>(null);

  function set(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const { data } = await api.post<{ user: unknown }>('/auth/register/', form);
      // التسجيل يفتح جلسة فورًا؛ نحمّل بيانات العضو
      setMember(data.user as never);
      router.replace('/member?welcome=1');
    } catch (caught) {
      setError(toApiError(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <ErrorBanner error={error} />
      <Field id="full_name" label={t('fullName')} autoComplete="name"
        value={form.full_name} onChange={(v) => set('full_name', v)}
        error={error ? fieldError(error, 'full_name') : undefined} />
      <Field id="email" label={t('email')} type="email" dir="ltr" autoComplete="username"
        value={form.email} onChange={(v) => set('email', v)}
        error={error ? fieldError(error, 'email') : undefined} />
      <Field id="password" label={t('password')} type="password" autoComplete="new-password"
        value={form.password} onChange={(v) => set('password', v)}
        error={error ? fieldError(error, 'password') : undefined} />
      <Field id="password_confirm" label={t('passwordConfirm')} type="password"
        autoComplete="new-password" value={form.password_confirm}
        onChange={(v) => set('password_confirm', v)}
        error={error ? fieldError(error, 'password_confirm') : undefined} />
      <SubmitButton pending={pending} label={t('registerButton')} />
    </form>
  );
}

// --------------------------------------------------------------- استعادة كلمة المرور

export function ForgotPasswordForm() {
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      await api.post('/auth/password/forgot/', { email });
      setSent(true);
    } catch {
      setSent(true); // استجابة موحّدة منعًا لتعداد الحسابات
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-lg border border-success/40 bg-success/5 p-4 text-sm">
        {t('forgotSent')}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <Field id="email" label={t('email')} type="email" dir="ltr" autoComplete="username"
        value={email} onChange={setEmail} />
      <SubmitButton pending={pending} label={t('forgotButton')} />
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const [form, setForm] = useState({ new_password: '', new_password_confirm: '' });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiErrorPayload | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api.post('/auth/password/reset/', { token, ...form });
      setDone(true);
      setTimeout(() => router.replace('/login'), 2000);
    } catch (caught) {
      setError(toApiError(caught));
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-lg border border-success/40 bg-success/5 p-4 text-sm">
        {t('resetDone')}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <ErrorBanner error={error} />
      <Field id="new_password" label={t('newPassword')} type="password" autoComplete="new-password"
        value={form.new_password} onChange={(v) => setForm((c) => ({ ...c, new_password: v }))}
        error={error ? fieldError(error, 'new_password') : undefined} />
      <Field id="new_password_confirm" label={t('passwordConfirm')} type="password"
        autoComplete="new-password" value={form.new_password_confirm}
        onChange={(v) => setForm((c) => ({ ...c, new_password_confirm: v }))}
        error={error ? fieldError(error, 'new_password_confirm') : undefined} />
      <SubmitButton pending={pending} label={t('resetButton')} />
    </form>
  );
}

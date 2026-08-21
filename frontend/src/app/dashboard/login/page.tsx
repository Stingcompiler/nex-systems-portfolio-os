'use client';

import { LoaderCircle, LogIn } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { fieldError, toApiError, type ApiErrorPayload } from '@/lib/api/client';

function LoginForm() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiErrorPayload | null>(null);

  // جلسة قائمة بالفعل — لا داعي لإظهار النموذج
  useEffect(() => {
    if (!loading && user?.is_dashboard_user) {
      router.replace(next);
    }
  }, [loading, user, next, router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const account = await login(email, password);
      if (!account.is_dashboard_user) {
        setError({
          detail: 'هذا الحساب لا يملك صلاحية دخول لوحة التحكم',
          code: 'not_dashboard_user',
          errors: {},
        });
        return;
      }
      router.replace(next);
    } catch (caught) {
      setError(toApiError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="hero-surface grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-3 grid size-12 place-items-center rounded-xl bg-brand text-lg font-bold text-white shadow-[0_4px_16px_-4px_rgb(var(--primary)/0.6)]">
            S
          </span>
          <h1 className="text-h2 font-semibold">لوحة التحكم</h1>
          <p className="mt-1 text-sm text-muted">سجّل الدخول للمتابعة</p>
        </div>

        <form
          onSubmit={onSubmit}
          noValidate
          className="rounded-xl border border-border bg-surface/80 p-6 shadow-elevated backdrop-blur"
        >
          {error ? (
            <div
              role="alert"
              className="mb-4 rounded border border-danger/40 bg-danger/10 p-3 text-sm"
            >
              {error.detail}
            </div>
          ) : null}

          <div className="mb-4">
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
              البريد الإلكتروني
            </label>
            <input
              id="email"
              name="email"
              type="email"
              dir="ltr"
              required
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(fieldError(error ?? { detail: '', code: '', errors: {} }, 'email'))}
              aria-describedby={error ? 'email-error' : undefined}
              className="min-h-11 w-full rounded border border-border bg-background px-3 text-start focus-visible:ring-2 focus-visible:ring-ring"
            />
            {error && fieldError(error, 'email') ? (
              <p id="email-error" className="mt-1 text-sm text-danger">
                {fieldError(error, 'email')}
              </p>
            ) : null}
          </div>

          <div className="mb-6">
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
              كلمة المرور
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="min-h-11 w-full rounded border border-border bg-background px-3 focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 font-medium text-primary-foreground shadow-[0_4px_16px_-6px_rgb(var(--primary)/0.6)] transition-all hover:bg-primary/90 hover:shadow-[0_8px_24px_-8px_rgb(var(--primary)/0.7)] disabled:opacity-60"
          >
            {submitting ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <LogIn className="size-4 flip-rtl" aria-hidden="true" />
            )}
            {submitting ? 'جارٍ الدخول…' : 'تسجيل الدخول'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          <a href="/ar" className="hover:text-foreground">
            العودة إلى الموقع
          </a>
        </p>
      </div>
    </main>
  );
}

export default function DashboardLoginPage() {
  return (
    <Suspense fallback={<main className="grid min-h-dvh place-items-center">…</main>}>
      <LoginForm />
    </Suspense>
  );
}

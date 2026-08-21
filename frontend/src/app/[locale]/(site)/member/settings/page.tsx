'use client';

import { LoaderCircle, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';

import { useMember } from '@/contexts/MemberContext';
import { useToast } from '@/contexts/ToastContext';
import { api, fieldError, toApiError, type ApiErrorPayload } from '@/lib/api/client';
import { useRouter } from '@/lib/i18n/navigation';

export default function MemberSettingsPage() {
  const t = useTranslations('member');
  const { logout } = useMember();
  const router = useRouter();
  const toast = useToast();

  // تغيير كلمة المرور
  const [pw, setPw] = useState({ current_password: '', new_password: '', new_password_confirm: '' });
  const [pwPending, setPwPending] = useState(false);
  const [pwError, setPwError] = useState<ApiErrorPayload | null>(null);

  // حذف الحساب
  const [deletePassword, setDeletePassword] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePending, setDeletePending] = useState(false);

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setPwPending(true);
    setPwError(null);
    try {
      await api.post('/auth/password/change/', pw);
      setPw({ current_password: '', new_password: '', new_password_confirm: '' });
      toast.success(t('passwordChanged'));
    } catch (error) {
      setPwError(toApiError(error));
    } finally {
      setPwPending(false);
    }
  }

  async function deleteAccount() {
    setDeletePending(true);
    try {
      await api.delete('/auth/me/', { data: { password: deletePassword, confirm: true } });
      toast.success(t('accountDeleted'));
      await logout();
      router.replace('/');
    } catch (error) {
      toast.error(toApiError(error).detail);
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="mb-6 text-h2 font-semibold">{t('tabs.settings')}</h1>

      {/* تغيير كلمة المرور */}
      <form onSubmit={changePassword} className="mb-8 rounded-lg border border-border bg-surface p-6">
        <h2 className="mb-4 text-h3 font-semibold">{t('changePassword')}</h2>
        {pwError && !Object.keys(pwError.errors).length ? (
          <div role="alert" className="mb-4 rounded border border-danger/40 bg-danger/10 p-3 text-sm">
            {pwError.detail}
          </div>
        ) : null}
        {(
          [
            ['current_password', t('currentPassword')],
            ['new_password', t('newPassword')],
            ['new_password_confirm', t('confirmPassword')],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="mb-4">
            <label htmlFor={key} className="mb-1.5 block text-sm font-medium">
              {label}
            </label>
            <input
              id={key}
              type="password"
              autoComplete={key === 'current_password' ? 'current-password' : 'new-password'}
              value={pw[key]}
              onChange={(event) => setPw((c) => ({ ...c, [key]: event.target.value }))}
              className="min-h-11 w-full rounded border border-border bg-background px-3 text-sm"
            />
            {pwError && fieldError(pwError, key) ? (
              <p className="mt-1 text-xs text-danger">{fieldError(pwError, key)}</p>
            ) : null}
          </div>
        ))}
        <button
          type="submit"
          disabled={pwPending}
          className="inline-flex min-h-11 items-center gap-2 rounded bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {pwPending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
          {t('updatePassword')}
        </button>
      </form>

      {/* حذف الحساب */}
      <div className="rounded-lg border border-danger/30 bg-danger/5 p-6">
        <h2 className="mb-1 flex items-center gap-2 text-h3 font-semibold text-danger">
          <TriangleAlert className="size-5" aria-hidden="true" />
          {t('deleteAccount')}
        </h2>
        <p className="mb-4 text-sm text-muted">{t('deleteWarning')}</p>

        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="inline-flex min-h-11 items-center rounded border border-danger/50 px-4 text-sm font-medium text-danger hover:bg-danger/10"
          >
            {t('deleteAccount')}
          </button>
        ) : (
          <div>
            <label htmlFor="del_pw" className="mb-1.5 block text-sm font-medium">
              {t('confirmWithPassword')}
            </label>
            <input
              id="del_pw"
              type="password"
              value={deletePassword}
              onChange={(event) => setDeletePassword(event.target.value)}
              className="mb-3 min-h-11 w-full rounded border border-border bg-background px-3 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={deleteAccount}
                disabled={deletePending || !deletePassword}
                className="inline-flex min-h-11 items-center gap-2 rounded bg-danger px-4 text-sm font-medium text-white disabled:opacity-60"
              >
                {deletePending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
                {t('confirmDelete')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmDelete(false);
                  setDeletePassword('');
                }}
                className="min-h-11 px-4 text-sm text-muted hover:text-foreground"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

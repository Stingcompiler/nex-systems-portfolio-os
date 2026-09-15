'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, LoaderCircle, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import {
  SUBSCRIBER_STATUSES,
  fmtDate,
  toneClass,
  type InterestOption,
  type SubscriberRow,
  type SubscriberStats,
} from '@/features/dashboard/marketing/shared';
import { api, toApiError } from '@/lib/api/client';
import type { Paginated } from '@/lib/api/types';
import { cn } from '@/lib/utils/cn';

const INPUT = 'min-h-11 rounded border border-border bg-background px-3 text-sm';

export default function SubscribersPage() {
  const { can } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [language, setLanguage] = useState('');
  const [interest, setInterest] = useState('');
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<SubscriberRow | null>(null);

  useEffect(() => setPage(1), [search, status, language, interest]);

  const canEdit = can('newsletter.change_subscriber');
  const canExport = can('newsletter.export_subscribers');

  const stats = useQuery({
    queryKey: ['subscribers', 'stats'],
    queryFn: async () => (await api.get<SubscriberStats>('/subscribers/stats/')).data,
  });
  const interests = useQuery({
    queryKey: ['interests', 'ar'],
    queryFn: async () => (await api.get<InterestOption[]>('/interests/', { params: { lang: 'ar' } })).data,
    staleTime: 60 * 60_000,
  });
  const list = useQuery({
    queryKey: ['subscribers', 'list', { search, status, language, interest, page }],
    queryFn: async () => {
      const { data } = await api.get<Paginated<SubscriberRow>>('/subscribers/', {
        params: {
          page, page_size: 25,
          ...(search ? { search } : {}),
          ...(status ? { status } : {}),
          ...(language ? { language } : {}),
          ...(interest ? { interest } : {}),
        },
      });
      return data;
    },
    placeholderData: (previous) => previous,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['subscribers'] });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/subscribers/${id}/`),
    onSuccess: () => {
      toast.success('حُذف المشترك');
      setConfirmDelete(null);
      invalidate();
    },
    onError: (error) => toast.error(toApiError(error).detail),
  });

  const setSubscriberStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.patch(`/subscribers/${id}/`, { status }),
    onSuccess: () => {
      toast.success('حُدّثت الحالة');
      invalidate();
    },
    onError: (error) => toast.error(toApiError(error).detail),
  });

  async function exportCsv() {
    try {
      const response = await api.get('/subscribers/export/', {
        responseType: 'blob',
        params: { ...(status ? { status } : {}), ...(language ? { language } : {}), ...(interest ? { interest } : {}) },
      });
      const url = URL.createObjectURL(response.data as Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'subscribers.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(toApiError(error).detail);
    }
  }

  const s = stats.data;

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h2 font-semibold">المشتركون</h1>
          <p className="mt-1 text-sm text-muted">
            كل مشترك هنا أكّد بريده بنفسه (Double Opt-in) أو أضافه المدير يدويًا.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canExport ? (
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex min-h-11 items-center gap-2 rounded border border-border px-4 text-sm hover:bg-surface-hover"
            >
              <Download className="size-4" aria-hidden="true" />
              تصدير CSV
            </button>
          ) : null}
          {canEdit ? (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex min-h-11 items-center gap-2 rounded bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              <Plus className="size-4" aria-hidden="true" />
              إضافة يدوية
            </button>
          ) : null}
        </div>
      </header>

      {/* بطاقات الإحصائيات */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="نشطون" value={s?.active} tone="text-success" />
        <StatCard label="بانتظار التأكيد" value={s?.pending} tone="text-warning" />
        <StatCard label="جدد خلال 30 يومًا" value={s?.confirmed_last_30_days} tone="text-primary" />
        <StatCard label="ألغوا الاشتراك" value={s?.unsubscribed} tone="text-muted" />
      </div>

      {s?.by_interest?.length ? (
        <div className="mb-6 rounded-lg border border-border bg-surface p-4">
          <p className="mb-3 text-sm font-medium">النشطون حسب الاهتمام</p>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {s.by_interest.map((row) => {
              const max = Math.max(1, ...s.by_interest.map((r) => r.n));
              return (
                <li key={row.key}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span>{row.name_ar}</span>
                    <span dir="ltr" className="text-muted">{row.n}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-hover">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(row.n / max) * 100}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {/* المرشحات */}
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="بحث بالبريد أو الاسم"
            aria-label="بحث في المشتركين"
            className={cn(INPUT, 'w-full ps-9')}
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="الحالة" className={INPUT}>
          <option value="">كل الحالات</option>
          {SUBSCRIBER_STATUSES.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
        <select value={language} onChange={(e) => setLanguage(e.target.value)} aria-label="اللغة" className={INPUT}>
          <option value="">كل اللغات</option>
          <option value="ar">العربية</option>
          <option value="en">الإنجليزية</option>
        </select>
        <select value={interest} onChange={(e) => setInterest(e.target.value)} aria-label="الاهتمام" className={INPUT}>
          <option value="">كل الاهتمامات</option>
          {interests.data?.map((item) => (
            <option key={item.key} value={item.key}>{item.name}</option>
          ))}
        </select>
      </div>

      {list.isLoading ? (
        <div className="grid place-items-center py-16 text-muted" role="status">
          <LoaderCircle className="size-6 animate-spin" aria-hidden="true" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[48rem] text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th scope="col" className="px-4 py-3 text-start font-medium">البريد</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">الحالة</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">اللغة</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">الاهتمامات</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">المصدر</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">التأكيد</th>
                {canEdit ? <th scope="col" className="px-4 py-3 text-start font-medium"><span className="sr-only">إجراءات</span></th> : null}
              </tr>
            </thead>
            <tbody>
              {list.data?.results.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium" dir="ltr">{row.email}</p>
                    {row.name ? <p className="text-xs text-muted">{row.name}</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs', toneClass(SUBSCRIBER_STATUSES, row.status))}>
                      {row.status_display}
                    </span>
                  </td>
                  <td className="px-4 py-3">{row.language === 'ar' ? 'العربية' : 'الإنجليزية'}</td>
                  <td className="px-4 py-3 text-xs text-muted">{row.interest_names.join('، ') || '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted">{row.source_display}</td>
                  <td className="px-4 py-3 text-xs text-muted">{fmtDate(row.confirmed_at)}</td>
                  {canEdit ? (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {row.status === 'active' ? (
                          <button
                            type="button"
                            onClick={() => setSubscriberStatus.mutate({ id: row.id, status: 'unsubscribed' })}
                            className="rounded px-2 py-1 text-xs text-muted hover:bg-surface-hover hover:text-foreground"
                          >
                            إيقاف
                          </button>
                        ) : row.status === 'unsubscribed' ? (
                          <button
                            type="button"
                            onClick={() => setSubscriberStatus.mutate({ id: row.id, status: 'active' })}
                            className="rounded px-2 py-1 text-xs text-muted hover:bg-surface-hover hover:text-foreground"
                          >
                            تفعيل
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(row)}
                          aria-label={`حذف ${row.email}`}
                          className="rounded p-1.5 text-muted hover:bg-danger/10 hover:text-danger"
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
              {!list.data?.results.length ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">لا مشتركين يطابقون المرشحات.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      {list.data && list.data.total_pages > 1 ? (
        <nav aria-label="الصفحات" className="mt-4 flex items-center justify-between text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="min-h-10 rounded border border-border px-3 disabled:opacity-40">السابق</button>
          <span className="text-muted" dir="ltr">{page} / {list.data.total_pages}</span>
          <button type="button" disabled={page >= list.data.total_pages} onClick={() => setPage((p) => p + 1)} className="min-h-10 rounded border border-border px-3 disabled:opacity-40">التالي</button>
        </nav>
      ) : null}

      {adding ? (
        <AddSubscriberDialog
          interests={interests.data ?? []}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            invalidate();
          }}
        />
      ) : null}

      {confirmDelete ? (
        <Dialog title="حذف المشترك" onClose={() => setConfirmDelete(null)}>
          <p className="mb-4 text-sm text-muted">
            سيُحذف <span dir="ltr">{confirmDelete.email}</span> نهائيًا مع سجل موافقته. لإيقاف الرسائل فقط استخدم «إيقاف».
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setConfirmDelete(null)} className="min-h-11 rounded border border-border px-4 text-sm">إلغاء</button>
            <button type="button" onClick={() => remove.mutate(confirmDelete.id)} className="min-h-11 rounded bg-danger px-4 text-sm font-medium text-white">حذف</button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value?: number; tone: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={cn('mt-1 text-2xl font-semibold', tone)} dir="ltr">
        {value ?? '—'}
      </p>
    </div>
  );
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-elevated"
      >
        <h2 className="mb-3 text-h3 font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function AddSubscriberDialog({
  interests,
  onClose,
  onSaved,
}: {
  interests: InterestOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({ email: '', name: '', language: 'ar', interests: [] as string[] });
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      await api.post('/subscribers/', form);
      toast.success('أُضيف المشترك كنشط');
      onSaved();
    } catch (error) {
      const payload = toApiError(error);
      toast.error(payload.errors?.email?.[0] ?? payload.detail);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog title="إضافة مشترك يدويًا" onClose={onClose}>
      <form onSubmit={submit}>
        <p className="mb-4 text-xs text-muted">
          الإضافة اليدوية تُفعَّل مباشرة بلا رسالة تأكيد — استخدمها فقط لمن أعطاك موافقته صراحة.
        </p>
        <label htmlFor="new-email" className="mb-1.5 block text-sm font-medium">البريد</label>
        <input id="new-email" type="email" required dir="ltr" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={cn(INPUT, 'mb-3 w-full')} />
        <label htmlFor="new-name" className="mb-1.5 block text-sm font-medium">الاسم</label>
        <input id="new-name" type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={cn(INPUT, 'mb-3 w-full')} />
        <label htmlFor="new-lang" className="mb-1.5 block text-sm font-medium">اللغة</label>
        <select id="new-lang" value={form.language} onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))} className={cn(INPUT, 'mb-3 w-full')}>
          <option value="ar">العربية</option>
          <option value="en">الإنجليزية</option>
        </select>
        <fieldset className="mb-4">
          <legend className="mb-1.5 text-sm font-medium">الاهتمامات</legend>
          <div className="flex flex-wrap gap-2">
            {interests.map((item) => {
              const active = form.interests.includes(item.key);
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setForm((f) => ({
                    ...f,
                    interests: active ? f.interests.filter((k) => k !== item.key) : [...f.interests, item.key],
                  }))}
                  className={cn('min-h-9 rounded-full border px-3 text-xs', active ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted')}
                >
                  {item.name}
                </button>
              );
            })}
          </div>
        </fieldset>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="min-h-11 rounded border border-border px-4 text-sm">إلغاء</button>
          <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60">
            {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
            إضافة
          </button>
        </div>
      </form>
    </Dialog>
  );
}

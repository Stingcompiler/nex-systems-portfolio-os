'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, CheckCheck, ChevronRight, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { ListSkeleton } from '@/features/dashboard/list-skeleton';
import { useToast } from '@/contexts/ToastContext';
import { PushToggle } from '@/features/dashboard/push-toggle';
import { api, toApiError } from '@/lib/api/client';
import type { Paginated } from '@/lib/api/types';
import { cn } from '@/lib/utils/cn';

interface NotificationItem {
  id: number;
  type: string;
  type_display: string;
  title: string;
  message: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

const RELATIVE = new Intl.RelativeTimeFormat('ar', { numeric: 'auto' });

/** «قبل 7 أيام» و«أمس» بصيغها الصحيحة — النصوص الثابتة كانت تكتب «قبل 7 يوم». */
function relativeTime(iso: string): string {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 1) return 'الآن';
  if (Math.abs(minutes) < 60) return RELATIVE.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return RELATIVE.format(hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return RELATIVE.format(days, 'day');
  return new Date(iso).toLocaleDateString('ar', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** مجموعة الإشعار بحسب يومه بالتوقيت المحلي. */
function groupOf(iso: string): string {
  const day = new Date(iso);
  day.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  if (diff <= 0) return 'اليوم';
  if (diff === 1) return 'أمس';
  if (diff < 7) return 'هذا الأسبوع';
  return 'أقدم';
}

type Filter = 'all' | 'unread';

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [filter, setFilter] = useState<Filter>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'list', filter],
    queryFn: async () => {
      // اللوحة عربية: لغة المتصفح (الإنجليزية مثلًا) كانت تعيد العناوين بالإنجليزية
      const { data: list } = await api.get<Paginated<NotificationItem>>('/notifications/', {
        params: { lang: 'ar', ...(filter === 'unread' ? { is_read: false } : {}) },
      });
      return list;
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['notifications'] });

  const markRead = useMutation({
    mutationFn: (id: number) => api.post(`/notifications/${id}/read/`),
    onSuccess: invalidate,
  });

  const readAll = useMutation({
    mutationFn: () => api.post('/notifications/read-all/'),
    onSuccess: () => {
      invalidate();
      toast.success('عُلّمت كلها كمقروءة');
    },
    onError: (error) => toast.error(toApiError(error).detail),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/notifications/${id}/`),
    onSuccess: invalidate,
  });

  const { data: unread = 0 } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const { data: count } = await api.get<{ unread: number }>('/notifications/unread-count/');
      return count.unread;
    },
  });

  const items = data?.results ?? [];
  const groups: { label: string; items: NotificationItem[] }[] = [];
  for (const item of items) {
    const label = groupOf(item.created_at);
    const last = groups.at(-1);
    if (last?.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }

  function row(item: NotificationItem) {
    return (
      <li key={item.id} className={cn('flex flex-wrap items-start gap-x-3 gap-y-2 px-4 py-3 sm:flex-nowrap', !item.is_read && 'bg-primary/[0.03]')}>
        <span
          className={cn('mt-2 size-2 shrink-0 rounded-full', item.is_read ? 'bg-transparent' : 'bg-primary')}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className={cn('text-sm', !item.is_read && 'font-semibold')}>
            {item.title}
            {!item.is_read ? <span className="sr-only"> (غير مقروء)</span> : null}
          </p>
          {item.message ? <p className="mt-0.5 line-clamp-2 text-sm text-muted">{item.message}</p> : null}
          <p className="mt-1 text-xs text-muted">
            {item.type_display} · <time dateTime={item.created_at}>{relativeTime(item.created_at)}</time>
          </p>
        </div>
        <div className="ms-5 flex w-full shrink-0 items-center gap-1 sm:ms-0 sm:w-auto">
          {item.link ? (
            <Link
              href={item.link}
              onClick={() => !item.is_read && markRead.mutate(item.id)}
              className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-primary-soft px-3 text-sm font-medium text-primary hover:bg-primary-soft/70"
            >
              عرض
              <ChevronRight className="size-4 flip-rtl" aria-hidden="true" />
            </Link>
          ) : null}
          {!item.is_read ? (
            <button
              type="button"
              onClick={() => markRead.mutate(item.id)}
              aria-label="تعليم كمقروء"
              title="تعليم كمقروء"
              className="rounded p-2 text-muted hover:bg-surface-hover hover:text-foreground"
            >
              <Check className="size-4" aria-hidden="true" />
            </button>
          ) : null}
          <span className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />
          <button
            type="button"
            onClick={() => remove.mutate(item.id)}
            aria-label="حذف الإشعار"
            title="حذف"
            className="rounded p-2 text-muted/70 hover:bg-surface-hover hover:text-danger"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        </div>
      </li>
    );
  }

  return (
    <div>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h2 font-semibold">الإشعارات</h1>
        {unread > 0 ? (
          <button
            type="button"
            onClick={() => readAll.mutate()}
            disabled={readAll.isPending}
            className="inline-flex min-h-11 items-center gap-2 rounded border border-border px-4 text-sm hover:bg-surface-hover disabled:opacity-60"
          >
            <CheckCheck className="size-4" aria-hidden="true" />
            تعليم الكل كمقروء
          </button>
        ) : null}
      </header>

      <div className="mb-4 flex gap-1 border-b border-border" role="tablist" aria-label="تصفية الإشعارات">
        {(['all', 'unread'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            onClick={() => setFilter(value)}
            className={cn(
              '-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm',
              filter === value ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted hover:text-foreground',
            )}
          >
            {value === 'all' ? 'الكل' : 'غير المقروءة'}
            {value === 'unread' && unread > 0 ? (
              <span className="code-inline rounded-full bg-primary-soft px-1.5 text-xs text-primary">{unread}</span>
            ) : null}
          </button>
        ))}
      </div>

      {isLoading ? (
        <ListSkeleton />
      ) : items.length ? (
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <section key={group.label} aria-label={group.label}>
              <h2 className="mb-2 text-xs font-semibold text-muted">{group.label}</h2>
              <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
                {group.items.map(row)}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <Bell className="mx-auto mb-3 size-8 text-muted" aria-hidden="true" />
          <p className="text-muted">{filter === 'unread' ? 'لا إشعارات غير مقروءة.' : 'لا توجد إشعارات.'}</p>
        </div>
      )}

      <PushToggle compact className="mt-8" />
    </div>
  );
}

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, CheckCheck, LoaderCircle, Trash2 } from 'lucide-react';
import Link from 'next/link';

import { useToast } from '@/contexts/ToastContext';
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

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'الآن';
  if (minutes < 60) return `قبل ${minutes} دقيقة`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `قبل ${hours} ساعة`;
  const days = Math.round(hours / 24);
  return `قبل ${days} يوم`;
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: async () => {
      const { data: list } = await api.get<Paginated<NotificationItem>>('/notifications/');
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

  const items = data?.results ?? [];
  const hasUnread = items.some((item) => !item.is_read);

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h2 font-semibold">الإشعارات</h1>
        {hasUnread ? (
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

      {isLoading ? (
        <div className="grid place-items-center py-16 text-muted" role="status">
          <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
        </div>
      ) : items.length ? (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {items.map((item) => {
            const body = (
              <div className="flex items-start gap-3 p-4">
                <span
                  className={cn(
                    'mt-1 size-2 shrink-0 rounded-full',
                    item.is_read ? 'bg-transparent' : 'bg-primary',
                  )}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-surface-hover px-2 py-0.5 text-xs text-muted">
                      {item.type_display}
                    </span>
                    <time className="text-xs text-muted">{relativeTime(item.created_at)}</time>
                  </div>
                  <p className={cn('mt-1 text-sm', !item.is_read && 'font-medium')}>
                    {item.title}
                  </p>
                  {item.message ? (
                    <p className="mt-0.5 text-sm text-muted">{item.message}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!item.is_read ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        markRead.mutate(item.id);
                      }}
                      aria-label="تعليم كمقروء"
                      className="rounded p-2 text-muted hover:bg-surface-hover hover:text-foreground"
                    >
                      <Check className="size-4" aria-hidden="true" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      remove.mutate(item.id);
                    }}
                    aria-label="حذف الإشعار"
                    className="rounded p-2 text-muted hover:bg-surface-hover hover:text-danger"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );

            return (
              <li key={item.id} className={cn(!item.is_read && 'bg-primary/[0.03]')}>
                {item.link ? (
                  <Link
                    href={item.link}
                    onClick={() => !item.is_read && markRead.mutate(item.id)}
                    className="block hover:bg-surface-hover/50"
                  >
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <Bell className="mx-auto mb-3 size-8 text-muted" aria-hidden="true" />
          <p className="text-muted">لا توجد إشعارات.</p>
        </div>
      )}
    </div>
  );
}

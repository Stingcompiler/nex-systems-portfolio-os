'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, Mail, TriangleAlert } from 'lucide-react';
import { useState } from 'react';

import { useToast } from '@/contexts/ToastContext';
import { CONTACT_STATUSES, crmDateTime } from '@/features/dashboard/crm/shared';
import { api, toApiError } from '@/lib/api/client';
import type { Paginated } from '@/lib/api/types';
import { cn } from '@/lib/utils/cn';

interface Message {
  id: number;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: string;
  status_display: string;
  created_at: string;
}

export default function MessagesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['contact-messages', statusFilter],
    queryFn: async () => {
      const { data: list } = await api.get<Paginated<Message>>('/contact-messages/', {
        params: { page_size: 50, ...(statusFilter ? { status: statusFilter } : {}) },
      });
      return list;
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.patch(`/contact-messages/${id}/`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contact-messages'] }),
    onError: (error) => toast.error(toApiError(error).detail),
  });

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h2 font-semibold">رسائل التواصل</h1>
          <p className="mt-1 text-sm text-muted">الرسائل الواردة من نموذج التواصل.</p>
        </div>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="تصفية بالحالة"
          className="min-h-11 rounded border border-border bg-background px-3 text-sm"
        >
          <option value="">كل الحالات</option>
          {CONTACT_STATUSES.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
      </header>

      {isLoading ? (
        <div className="grid place-items-center py-16 text-muted" role="status">
          <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
        </div>
      ) : isError ? (
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft p-8 text-center">
          <TriangleAlert className="mx-auto mb-3 size-8 text-danger" aria-hidden="true" />
          <p className="mb-4">{toApiError(error).detail}</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm hover:bg-surface-hover"
          >
            إعادة المحاولة
          </button>
        </div>
      ) : data?.results.length ? (
        <ul className="space-y-3">
          {data.results.map((message) => (
            <li
              key={message.id}
              className={cn(
                'rounded-lg border border-border bg-surface p-4',
                message.status === 'new' && 'border-primary/30 bg-primary/[0.03]',
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {message.name}
                    <span className="ms-2 text-sm font-normal text-muted" dir="ltr">
                      {message.email}
                    </span>
                  </p>
                  {message.subject ? (
                    <p className="mt-0.5 text-sm text-muted">{message.subject}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <time className="text-xs text-muted">{crmDateTime(message.created_at)}</time>
                  <select
                    value={message.status}
                    onChange={(event) =>
                      updateStatus.mutate({ id: message.id, status: event.target.value })
                    }
                    aria-label="الحالة"
                    className="min-h-9 rounded border border-border bg-background px-2 text-xs"
                  >
                    {CONTACT_STATUSES.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm">{message.message}</p>
              <div className="mt-3 flex gap-3 text-sm">
                <a href={`mailto:${message.email}`} className="text-primary hover:underline">
                  الرد بالبريد
                </a>
                {message.phone ? (
                  <a
                    href={`tel:${message.phone}`}
                    dir="ltr"
                    className="text-muted hover:text-foreground"
                  >
                    {message.phone}
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <Mail className="mx-auto mb-3 size-8 text-muted" aria-hidden="true" />
          <p className="text-muted">لا رسائل بعد.</p>
        </div>
      )}
    </div>
  );
}

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Flag, LoaderCircle } from 'lucide-react';
import { useState } from 'react';

import { useToast } from '@/contexts/ToastContext';
import { crmDateTime } from '@/features/dashboard/crm/shared';
import { api, toApiError } from '@/lib/api/client';
import type { Paginated } from '@/lib/api/types';
import { cn } from '@/lib/utils/cn';

interface Report {
  id: number;
  comment: number;
  comment_content: string;
  reason_display: string;
  note: string;
  status: string;
  created_at: string;
}

const FILTERS = [
  { value: 'open', label: 'مفتوح' },
  { value: 'resolved', label: 'معالَج' },
  { value: 'dismissed', label: 'مرفوض' },
];

export default function ReportsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [status, setStatus] = useState('open');

  const { data, isLoading } = useQuery({
    queryKey: ['comment-reports', status],
    queryFn: async () => {
      const { data: list } = await api.get<Paginated<Report>>('/comment-reports/', {
        params: { status, page_size: 50 },
      });
      return list;
    },
  });

  const resolve = useMutation({
    mutationFn: ({ id, next }: { id: number; next: string }) =>
      api.patch(`/comment-reports/${id}/`, { status: next }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comment-reports'] }),
    onError: (error) => toast.error(toApiError(error).detail),
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-h2 font-semibold">بلاغات التعليقات</h1>
      </header>

      <div className="mb-4 flex flex-wrap gap-1">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setStatus(option.value)}
            aria-pressed={status === option.value}
            className={cn(
              'min-h-10 rounded-full border px-4 text-sm',
              status === option.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted hover:bg-surface-hover',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16 text-muted" role="status">
          <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
        </div>
      ) : data && data.results.length ? (
        <ul className="space-y-3">
          {data.results.map((report) => (
            <li key={report.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-danger">
                  <Flag className="size-4" aria-hidden="true" />
                  {report.reason_display}
                </span>
                <time className="text-xs text-muted">{crmDateTime(report.created_at)}</time>
              </div>
              <p className="mb-3 rounded border border-border bg-background p-2 text-sm text-muted">
                {report.comment_content}
              </p>
              {report.status === 'open' ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => resolve.mutate({ id: report.id, next: 'resolved' })}
                    className="inline-flex min-h-9 items-center rounded bg-primary px-3 text-xs font-medium text-primary-foreground"
                  >
                    معالجة
                  </button>
                  <button
                    type="button"
                    onClick={() => resolve.mutate({ id: report.id, next: 'dismissed' })}
                    className="inline-flex min-h-9 items-center rounded border border-border px-3 text-xs"
                  >
                    تجاهل
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-lg border border-dashed border-border py-16 text-center text-muted">
          لا بلاغات في هذه الحالة.
        </div>
      )}
    </div>
  );
}

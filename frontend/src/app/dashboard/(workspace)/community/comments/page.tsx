'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Check, LoaderCircle, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { useToast } from '@/contexts/ToastContext';
import { crmDateTime } from '@/features/dashboard/crm/shared';
import { api, toApiError } from '@/lib/api/client';
import type { Paginated } from '@/lib/api/types';
import { cn } from '@/lib/utils/cn';

interface ModComment {
  id: number;
  post_title: string;
  post_slug: string;
  author_name: string;
  author_email: string;
  content: string;
  status: string;
  status_display: string;
  report_count: number;
  created_at: string;
}

const STATUSES = [
  { value: 'pending', label: 'قيد المراجعة' },
  { value: 'approved', label: 'معتمد' },
  { value: 'rejected', label: 'مرفوض' },
  { value: 'spam', label: 'سبام' },
];

export default function CommentModerationPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(searchParams.get('status') || 'pending');

  const { data, isLoading } = useQuery({
    queryKey: ['moderation-comments', status],
    queryFn: async () => {
      const { data: list } = await api.get<Paginated<ModComment>>(
        '/comments/moderation/',
        { params: { status, page_size: 50 } },
      );
      return list;
    },
  });

  const act = useMutation({
    mutationFn: ({ id, action, body }: { id: number; action: string; body?: object }) =>
      api.post(`/comments/moderation/${id}/${action}/`, body ?? {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation-comments'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error) => toast.error(toApiError(error).detail),
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-h2 font-semibold">التعليقات</h1>
        <p className="mt-1 text-sm text-muted">راجع التعليقات — لا يظهر أي تعليق قبل اعتماده.</p>
      </header>

      <div className="mb-4 flex flex-wrap gap-1">
        {STATUSES.map((option) => (
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
          {data.results.map((comment) => (
            <li key={comment.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                <div>
                  <span className="font-medium">{comment.author_name}</span>
                  <span className="ms-2 text-xs text-muted" dir="ltr">
                    {comment.author_email}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted">
                  {comment.report_count > 0 ? (
                    <span className="rounded-full bg-danger/10 px-2 py-0.5 text-danger">
                      {comment.report_count} بلاغ
                    </span>
                  ) : null}
                  <time>{crmDateTime(comment.created_at)}</time>
                </div>
              </div>

              <p className="mb-2 text-sm">{comment.content}</p>
              <p className="mb-3 text-xs text-muted">على: {comment.post_title}</p>

              {comment.status === 'pending' || comment.status === 'spam' ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => act.mutate({ id: comment.id, action: 'approve' })}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded bg-success px-3 text-xs font-medium text-white"
                  >
                    <Check className="size-3.5" aria-hidden="true" /> اعتماد
                  </button>
                  <button
                    type="button"
                    onClick={() => act.mutate({ id: comment.id, action: 'reject' })}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded border border-border px-3 text-xs"
                  >
                    <X className="size-3.5" aria-hidden="true" /> رفض
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      act.mutate({ id: comment.id, action: 'spam', body: { block_email: true } })
                    }
                    className="inline-flex min-h-9 items-center gap-1.5 rounded border border-danger/40 px-3 text-xs text-danger"
                  >
                    <Ban className="size-3.5" aria-hidden="true" /> سبام وحظر
                  </button>
                </div>
              ) : (
                <span className="text-xs text-muted">{comment.status_display}</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-lg border border-dashed border-border py-16 text-center text-muted">
          لا تعليقات في هذه الحالة.
        </div>
      )}
    </div>
  );
}

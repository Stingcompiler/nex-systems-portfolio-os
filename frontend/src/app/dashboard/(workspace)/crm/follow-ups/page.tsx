'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Check, LoaderCircle } from 'lucide-react';
import { useState } from 'react';

import { useToast } from '@/contexts/ToastContext';
import { crmDateTime } from '@/features/dashboard/crm/shared';
import { api, toApiError } from '@/lib/api/client';
import type { Paginated } from '@/lib/api/types';
import { cn } from '@/lib/utils/cn';

interface FollowUp {
  id: number;
  lead: number | null;
  client: number | null;
  title: string;
  due_at: string;
  status: string;
  status_display: string;
  is_overdue: boolean;
  target_name: string;
}

const FILTERS = [
  { value: '', label: 'الكل' },
  { value: 'today', label: 'اليوم' },
  { value: 'week', label: 'هذا الأسبوع' },
  { value: 'overdue', label: 'متأخرة' },
];

export default function FollowUpsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [filter, setFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['follow-ups', filter],
    queryFn: async () => {
      const { data: list } = await api.get<Paginated<FollowUp>>('/crm/follow-ups/', {
        params: { page_size: 100, ...(filter ? { due: filter } : {}) },
      });
      return list;
    },
  });

  const complete = useMutation({
    mutationFn: (id: number) => api.patch(`/crm/follow-ups/${id}/`, { status: 'done' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-ups'] });
      toast.success('اكتملت المتابعة');
    },
    onError: (error) => toast.error(toApiError(error).detail),
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-h2 font-semibold">المتابعات</h1>
        <p className="mt-1 text-sm text-muted">
          مواعيد المتابعة القادمة والمتأخرة. تصلك تذكيرات قبل الموعد بيوم.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap gap-1">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            aria-pressed={filter === option.value}
            className={cn(
              'min-h-10 rounded-full border px-4 text-sm',
              filter === option.value
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
      ) : data?.results.length ? (
        <ul className="space-y-2">
          {data.results.map((followUp) => (
            <li
              key={followUp.id}
              className={cn(
                'flex items-center gap-3 rounded-lg border bg-surface p-3',
                followUp.is_overdue ? 'border-danger/40' : 'border-border',
              )}
            >
              <CalendarClock
                className={cn(
                  'size-5 shrink-0',
                  followUp.is_overdue ? 'text-danger' : 'text-muted',
                )}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{followUp.title}</p>
                <p className="text-xs text-muted">
                  {followUp.target_name} — {crmDateTime(followUp.due_at)}
                  {followUp.is_overdue ? (
                    <span className="ms-2 text-danger">متأخرة</span>
                  ) : null}
                </p>
              </div>
              {followUp.status === 'pending' ? (
                <button
                  type="button"
                  onClick={() => complete.mutate(followUp.id)}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded border border-border px-3 text-sm hover:bg-surface-hover"
                >
                  <Check className="size-4" aria-hidden="true" />
                  إنجاز
                </button>
              ) : (
                <span className="text-xs text-muted">{followUp.status_display}</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <CalendarClock className="mx-auto mb-3 size-8 text-muted" aria-hidden="true" />
          <p className="text-muted">لا مواعيد متابعة في هذا النطاق.</p>
        </div>
      )}
    </div>
  );
}

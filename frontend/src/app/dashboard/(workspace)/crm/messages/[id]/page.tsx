'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { ArrowRight, LoaderCircle, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { useToast } from '@/contexts/ToastContext';
import { ClientReplies, type ClientReply } from '@/features/dashboard/crm/client-replies';
import { CONTACT_STATUSES, crmDateTime } from '@/features/dashboard/crm/shared';
import { api, toApiError } from '@/lib/api/client';

interface MessageDetail {
  id: number;
  reference_code: string | null;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  language: string;
  status: string;
  status_display: string;
  created_at: string;
  tracking_token: string | null;
  replies: ClientReply[];
}

/**
 * رسالة تواصل واحدة — وجهة رابط إشعار «رسالة جديدة» (كان يؤدي إلى 404).
 * فتح رسالة جديدة يعلّمها «مقروءة»، فتنتقل صاحبها في صفحة المتابعة إلى «قُرئت».
 */
export default function MessageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const toast = useToast();
  const markedRead = useRef(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['contact-message', id],
    queryFn: async () => {
      const { data: message } = await api.get<MessageDetail>(`/contact-messages/${id}/`);
      return message;
    },
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => api.patch(`/contact-messages/${id}/`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-message', id] });
      queryClient.invalidateQueries({ queryKey: ['contact-messages'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
    onError: (caught) => toast.error(toApiError(caught).detail),
  });

  useEffect(() => {
    if (data?.status === 'new' && !markedRead.current) {
      markedRead.current = true;
      updateStatus.mutate('read');
    }
  }, [data?.status, updateStatus]);

  const backLink = (
    <Link
      href="/dashboard/crm/messages"
      className="inline-flex min-h-11 items-center gap-2 text-sm text-muted hover:text-foreground"
    >
      <ArrowRight className="size-4 flip-rtl" aria-hidden="true" />
      رسائل التواصل
    </Link>
  );

  if (isLoading) {
    return (
      <div className="grid place-items-center py-24 text-muted" role="status">
        <LoaderCircle className="size-6 animate-spin" aria-hidden="true" />
        <span className="sr-only">جارٍ التحميل…</span>
      </div>
    );
  }

  if (isError || !data) {
    const notFound = axios.isAxiosError(error) && error.response?.status === 404;
    return (
      <div>
        <div className="mb-6">{backLink}</div>
        <div className="rounded-xl border border-danger/30 bg-danger-soft p-8 text-center">
          <TriangleAlert className="mx-auto mb-3 size-8 text-danger" aria-hidden="true" />
          <p className="mb-4">
            {notFound ? 'هذه الرسالة غير موجودة أو حُذفت.' : toApiError(error).detail}
          </p>
          {!notFound ? (
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm hover:bg-surface-hover"
            >
              إعادة المحاولة
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">{backLink}</div>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-h2 font-semibold">
            {data.subject || `رسالة من ${data.name || 'زائر'}`}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {data.reference_code ? (
              <>
                <span dir="ltr" className="font-mono">
                  {data.reference_code}
                </span>
                {' · '}
              </>
            ) : null}
            وصلت {crmDateTime(data.created_at)}
          </p>
        </div>

        <label className="flex flex-col gap-1 text-xs text-muted">
          الحالة
          <select
            value={data.status}
            onChange={(event) => updateStatus.mutate(event.target.value)}
            disabled={updateStatus.isPending}
            className="min-h-11 min-w-40 rounded-lg border border-border-strong bg-background px-3 text-sm text-foreground"
          >
            {CONTACT_STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-6">
          <section className="rounded-xl border border-border bg-surface p-5 shadow-subtle">
            <h2 className="mb-3 text-sm font-semibold">الرسالة</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{data.message}</p>
          </section>

          <ClientReplies
            endpoint={`/contact-messages/${data.id}`}
            replies={data.replies ?? []}
            trackingToken={data.tracking_token}
            language={data.language}
            hasEmail={Boolean(data.email)}
            invalidate={[['contact-message', id], ['contact-messages'], ['dashboard-summary']]}
          />
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-xl border border-border bg-surface p-5 shadow-subtle">
            <h2 className="mb-4 text-sm font-semibold">المرسل</h2>
            <dl className="grid gap-4 text-sm">
              <div>
                <dt className="text-xs text-muted">الاسم</dt>
                <dd className="mt-0.5 font-medium">{data.name || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">البريد</dt>
                <dd className="mt-0.5 font-medium" dir="ltr">
                  {data.email || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">الهاتف</dt>
                <dd className="mt-0.5 font-medium" dir="ltr">
                  {data.phone || '—'}
                </dd>
              </div>
            </dl>
            <div className="mt-5 flex flex-col gap-2">
              {data.email ? (
                <a
                  href={`mailto:${data.email}`}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 text-sm hover:bg-surface-hover"
                >
                  مراسلة بالبريد
                </a>
              ) : null}
              {data.phone ? (
                <a
                  href={`tel:${data.phone.replace(/\s+/g, '')}`}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 text-sm hover:bg-surface-hover"
                >
                  اتصال هاتفي
                </a>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  ArrowRight,
  Download,
  LoaderCircle,
  TriangleAlert,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { Badge } from '@/components/ui/misc';
import { useToast } from '@/contexts/ToastContext';
import { formatBytes } from '@/features/dashboard/media/media-picker';
import { crmDateTime, REQUEST_STATUSES } from '@/features/dashboard/crm/shared';
import { api, toApiError } from '@/lib/api/client';
import type { BadgeTone } from '@/features/dashboard/resource/types';

interface Attachment {
  id: number;
  file_url: string;
  original_name: string;
  size: number;
  mime_type: string;
  created_at: string;
}

interface ProjectRequestDetail {
  id: number;
  reference_code: string;
  project_type: string;
  project_type_display: string;
  sector: string;
  requirements: Record<string, unknown>;
  description: string;
  budget_range: string;
  budget_display: string;
  timeline: string;
  timeline_display: string;
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  company: string;
  country: string;
  city: string;
  preferred_language: string;
  status: string;
  status_display: string;
  source: string;
  lead_id: number | null;
  attachments: Attachment[];
  created_at: string;
}

const STATUS_TONE: Record<string, BadgeTone> = {
  new: 'primary',
  reviewed: 'accent',
  contacted: 'accent',
  meeting_scheduled: 'warning',
  proposal_sent: 'primary',
  accepted: 'success',
  in_progress: 'success',
  completed: 'default',
  rejected: 'danger',
};

function Field({ label, value, dir }: { label: string; value?: string | null; dir?: 'ltr' | 'rtl' }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium" dir={dir}>
        {value || '—'}
      </dd>
    </div>
  );
}

export default function RequestDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['project-request', id],
    queryFn: async () => {
      const { data } = await api.get<ProjectRequestDetail>(`/project-requests/${id}/`);
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => api.patch(`/project-requests/${id}/`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-request', id] });
      queryClient.invalidateQueries({ queryKey: ['project-requests'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      toast.success('حُدّثت الحالة');
    },
    onError: (caught) => toast.error(toApiError(caught).detail),
  });

  const backLink = (
    <Link
      href="/dashboard/crm/requests"
      className="inline-flex min-h-11 items-center gap-2 text-sm text-muted hover:text-foreground"
    >
      <ArrowRight className="size-4 flip-rtl" aria-hidden="true" />
      طلبات المشاريع
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
            {notFound ? 'هذا الطلب غير موجود أو حُذف.' : toApiError(error).detail}
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

  const activeRequirements = Object.entries(data.requirements ?? {})
    .filter(([, value]) => value === true)
    .map(([key]) => key);

  return (
    <div>
      <div className="mb-4">{backLink}</div>

      {/* الترويسة: الرمز + الحالة + محدّد الحالة */}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-h2 font-semibold" dir="ltr">
              {data.reference_code}
            </h1>
            <Badge tone={STATUS_TONE[data.status] ?? 'default'}>{data.status_display}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">
            {data.project_type_display} · وصل {crmDateTime(data.created_at)}
          </p>
        </div>

        <label className="flex flex-col gap-1 text-xs text-muted">
          تغيير الحالة
          <select
            value={data.status}
            onChange={(event) => updateStatus.mutate(event.target.value)}
            disabled={updateStatus.isPending}
            aria-label="حالة الطلب"
            className="min-h-11 min-w-44 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
          >
            {REQUEST_STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* تفاصيل المشروع */}
        <div className="flex flex-col gap-6">
          <section className="rounded-xl border border-border bg-surface p-5 shadow-subtle">
            <h2 className="mb-4 text-sm font-semibold">تفاصيل المشروع</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Field label="النوع" value={data.project_type_display} />
              <Field label="القطاع" value={data.sector} />
              <Field label="الميزانية" value={data.budget_display} />
              <Field label="المدة المتوقعة" value={data.timeline_display} />
            </dl>

            {data.description ? (
              <div className="mt-5">
                <p className="mb-1 text-xs text-muted">وصف المشروع</p>
                <p className="rounded-lg border border-border bg-background p-3 text-sm leading-relaxed">
                  {data.description}
                </p>
              </div>
            ) : null}

            {activeRequirements.length ? (
              <div className="mt-5">
                <p className="mb-2 text-xs text-muted">المتطلبات المحددة</p>
                <ul className="flex flex-wrap gap-1.5">
                  {activeRequirements.map((key) => (
                    <li key={key}>
                      <Badge tone="primary">{key}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          {data.attachments.length ? (
            <section className="rounded-xl border border-border bg-surface p-5 shadow-subtle">
              <h2 className="mb-4 text-sm font-semibold">المرفقات</h2>
              <ul className="flex flex-col divide-y divide-border">
                {data.attachments.map((file) => (
                  <li key={file.id} className="flex items-center gap-3 py-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
                      <Download className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate-line text-sm font-medium">{file.original_name}</p>
                      <p className="code-inline text-xs text-muted">{formatBytes(file.size)}</p>
                    </div>
                    <a
                      href={file.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-sm hover:bg-surface-hover"
                    >
                      تحميل
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        {/* بيانات مقدّم الطلب */}
        <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-xl border border-border bg-surface p-5 shadow-subtle">
            <h2 className="mb-4 text-sm font-semibold">مقدّم الطلب</h2>
            <dl className="grid gap-4 text-sm">
              <Field label="الاسم" value={data.name} />
              <Field label="البريد" value={data.email} dir="ltr" />
              <Field label="الهاتف" value={data.phone} dir="ltr" />
              <Field label="واتساب" value={data.whatsapp} dir="ltr" />
              <Field label="الشركة" value={data.company} />
              <Field
                label="الموقع"
                value={[data.city, data.country].filter(Boolean).join('، ')}
              />
            </dl>

            <div className="mt-5 flex flex-col gap-2">
              {data.email ? (
                <a
                  href={`mailto:${data.email}`}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  مراسلة بالبريد
                </a>
              ) : null}
              {data.lead_id ? (
                <Link
                  href={`/dashboard/crm/leads?open=${data.lead_id}`}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm hover:bg-surface-hover"
                >
                  العميل المحتمل المرتبط
                  <ArrowRight className="size-4 flip-rtl" aria-hidden="true" />
                </Link>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

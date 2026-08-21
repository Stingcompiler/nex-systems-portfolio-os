'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, Search, X } from 'lucide-react';
import { useState } from 'react';

import { useToast } from '@/contexts/ToastContext';
import { crmDateTime, REQUEST_STATUSES } from '@/features/dashboard/crm/shared';
import { api, toApiError } from '@/lib/api/client';
import type { Paginated } from '@/lib/api/types';

interface ProjectRequest {
  id: number;
  reference_code: string;
  project_type_display: string;
  sector: string;
  status: string;
  status_display: string;
  budget_display: string;
  timeline_display: string;
  description: string;
  requirements: Record<string, unknown>;
  name: string;
  email: string;
  phone: string;
  company: string;
  lead_id: number | null;
  created_at: string;
}

export default function RequestsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<ProjectRequest | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['project-requests', search, statusFilter],
    queryFn: async () => {
      const { data: list } = await api.get<Paginated<ProjectRequest>>('/project-requests/', {
        params: {
          page_size: 50,
          ...(search ? { search } : {}),
          ...(statusFilter ? { status: statusFilter } : {}),
        },
      });
      return list;
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.patch(`/project-requests/${id}/`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-requests'] });
      toast.success('حُدّثت الحالة');
    },
    onError: (error) => toast.error(toApiError(error).detail),
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-h2 font-semibold">طلبات المشاريع</h1>
        <p className="mt-1 text-sm text-muted">
          كل طلب يُنشئ عميلًا محتملًا تلقائيًا، وتصل صاحبه رسالة تأكيد.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-56 flex-1">
          <Search
            className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="بحث بالرمز أو الاسم أو البريد"
            aria-label="بحث في الطلبات"
            className="min-h-11 w-full rounded border border-border bg-background ps-9 pe-3 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="تصفية بالحالة"
          className="min-h-11 rounded border border-border bg-background px-3 text-sm"
        >
          <option value="">كل الحالات</option>
          {REQUEST_STATUSES.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16 text-muted" role="status">
          <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th scope="col" className="px-4 py-3 text-start font-medium">الرمز</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">النوع</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">مقدّم الطلب</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">الميزانية</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">الحالة</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {data?.results.map((request) => (
                <tr
                  key={request.id}
                  onClick={() => setSelected(request)}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-surface-hover/50"
                >
                  <td className="px-4 py-3 font-medium" dir="ltr">
                    {request.reference_code}
                  </td>
                  <td className="px-4 py-3">{request.project_type_display}</td>
                  <td className="px-4 py-3">
                    <p>{request.name}</p>
                    <p className="text-xs text-muted" dir="ltr">{request.email}</p>
                  </td>
                  <td className="px-4 py-3 text-muted">{request.budget_display || '—'}</td>
                  <td className="px-4 py-3">{request.status_display}</td>
                  <td className="px-4 py-3 text-muted">{crmDateTime(request.created_at)}</td>
                </tr>
              ))}
              {data && !data.results.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted">
                    لا طلبات بعد. ستصل هنا عند إرسالها من صفحة «اطلب مشروعك».
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      {selected ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="تفاصيل الطلب"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelected(null);
          }}
        >
          <div className="flex h-dvh w-full max-w-lg flex-col border-s border-border bg-surface">
            <div className="flex items-center gap-3 border-b border-border p-4">
              <h2 className="flex-1 text-h3 font-semibold" dir="ltr">
                {selected.reference_code}
              </h2>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="إغلاق"
                className="inline-flex size-9 items-center justify-center rounded text-muted hover:bg-surface-hover"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
              <select
                value={selected.status}
                onChange={(event) => {
                  updateStatus.mutate({ id: selected.id, status: event.target.value });
                  setSelected({ ...selected, status: event.target.value });
                }}
                aria-label="حالة الطلب"
                className="min-h-11 w-full rounded border border-border bg-background px-3"
              >
                {REQUEST_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>

              <dl className="grid grid-cols-2 gap-3">
                <Row label="النوع" value={selected.project_type_display} />
                <Row label="الميزانية" value={selected.budget_display} />
                <Row label="المدة" value={selected.timeline_display} />
                <Row label="مقدّم الطلب" value={selected.name} />
                <Row label="البريد" value={selected.email} dir="ltr" />
                <Row label="الهاتف" value={selected.phone} dir="ltr" />
                <Row label="الشركة" value={selected.company} />
              </dl>

              {selected.description ? (
                <div>
                  <p className="mb-1 text-muted">وصف المشروع</p>
                  <p className="rounded border border-border p-3">{selected.description}</p>
                </div>
              ) : null}

              {Object.keys(selected.requirements ?? {}).length ? (
                <div>
                  <p className="mb-1 text-muted">المتطلبات المحددة</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {Object.entries(selected.requirements)
                      .filter(([, value]) => value === true)
                      .map(([key]) => (
                        <li
                          key={key}
                          className="rounded-full bg-surface-hover px-2 py-0.5 text-xs"
                        >
                          {key}
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}

              {selected.lead_id ? (
                <a
                  href={`/dashboard/crm/leads?open=${selected.lead_id}`}
                  className="inline-block text-primary hover:underline"
                >
                  العميل المحتمل المرتبط ←
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value, dir }: { label: string; value: string; dir?: 'ltr' | 'rtl' }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd dir={dir}>{value || '—'}</dd>
    </div>
  );
}

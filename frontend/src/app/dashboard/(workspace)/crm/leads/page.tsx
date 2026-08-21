'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, KanbanSquare, List, LoaderCircle, Search } from 'lucide-react';
import { useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { LeadDetailDrawer } from '@/features/dashboard/crm/lead-detail';
import {
  crmDate,
  LEAD_STATUSES,
  statusLabel,
  statusTone,
} from '@/features/dashboard/crm/shared';
import { api, toApiError } from '@/lib/api/client';
import type { Paginated } from '@/lib/api/types';
import { cn } from '@/lib/utils/cn';

interface Lead {
  id: number;
  name: string;
  company: string;
  email: string;
  phone: string;
  status: string;
  status_display: string;
  priority_display: string;
  source_display: string;
  expected_budget: string;
  next_follow_up_at: string | null;
  has_client: boolean;
  created_at: string;
}

interface KanbanColumn {
  status: string;
  status_display: string;
  count: number;
  leads: Lead[];
}

export default function LeadsPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [view, setView] = useState<'kanban' | 'table'>('kanban');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const canExport = can('crm.export_leads');

  const tableQuery = useQuery({
    queryKey: ['leads', 'table', search, statusFilter],
    enabled: view === 'table',
    queryFn: async () => {
      const { data } = await api.get<Paginated<Lead>>('/leads/', {
        params: {
          page_size: 100,
          ...(search ? { search } : {}),
          ...(statusFilter ? { status: statusFilter } : {}),
        },
      });
      return data;
    },
  });

  const kanbanQuery = useQuery({
    queryKey: ['leads', 'kanban', search],
    enabled: view === 'kanban',
    queryFn: async () => {
      const { data } = await api.get<KanbanColumn[]>('/leads/kanban/', {
        params: search ? { search } : {},
      });
      return data;
    },
  });

  const moveStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.patch(`/leads/${id}/`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
    onError: (error) => toast.error(toApiError(error).detail),
  });

  async function exportCsv() {
    try {
      const response = await api.get('/leads/export/', { responseType: 'blob' });
      const url = URL.createObjectURL(response.data as Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'leads.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(toApiError(error).detail);
    }
  }

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h2 font-semibold">العملاء المحتملون</h1>
          <p className="mt-1 text-sm text-muted">تابع كل فرصة من أول تواصل حتى التعاقد.</p>
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
          <div className="inline-flex rounded border border-border p-0.5">
            <button
              type="button"
              onClick={() => setView('kanban')}
              aria-pressed={view === 'kanban'}
              className={cn(
                'inline-flex min-h-10 items-center gap-1.5 rounded px-3 text-sm',
                view === 'kanban' ? 'bg-primary text-primary-foreground' : 'text-muted',
              )}
            >
              <KanbanSquare className="size-4" aria-hidden="true" />
              لوحة
            </button>
            <button
              type="button"
              onClick={() => setView('table')}
              aria-pressed={view === 'table'}
              className={cn(
                'inline-flex min-h-10 items-center gap-1.5 rounded px-3 text-sm',
                view === 'table' ? 'bg-primary text-primary-foreground' : 'text-muted',
              )}
            >
              <List className="size-4" aria-hidden="true" />
              جدول
            </button>
          </div>
        </div>
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
            placeholder="بحث بالاسم أو البريد أو الهاتف"
            aria-label="بحث في العملاء المحتملين"
            className="min-h-11 w-full rounded border border-border bg-background ps-9 pe-3 text-sm"
          />
        </div>
        {view === 'table' ? (
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="تصفية بالحالة"
            className="min-h-11 rounded border border-border bg-background px-3 text-sm"
          >
            <option value="">كل الحالات</option>
            {LEAD_STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {view === 'kanban' ? (
        kanbanQuery.isLoading ? (
          <Loading />
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-4">
            {kanbanQuery.data?.map((column) => (
              <div
                key={column.status}
                className="flex w-72 shrink-0 flex-col rounded-lg border border-border bg-surface/60"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  const id = Number(event.dataTransfer.getData('text/plain'));
                  if (id) moveStatus.mutate({ id, status: column.status });
                }}
              >
                <div className="flex items-center justify-between border-b border-border p-3">
                  <span className="text-sm font-medium">{column.status_display}</span>
                  <span className="rounded-full bg-surface-hover px-2 text-xs text-muted">
                    <span dir="ltr">{column.count}</span>
                  </span>
                </div>
                <div className="flex flex-col gap-2 p-2">
                  {column.leads.map((lead) => (
                    <button
                      key={lead.id}
                      type="button"
                      draggable
                      onDragStart={(event) =>
                        event.dataTransfer.setData('text/plain', String(lead.id))
                      }
                      onClick={() => setSelectedId(lead.id)}
                      className="cursor-grab rounded border border-border bg-surface p-3 text-start hover:border-primary/50"
                    >
                      <p className="text-sm font-medium">{lead.name}</p>
                      {lead.company ? (
                        <p className="text-xs text-muted">{lead.company}</p>
                      ) : null}
                      <div className="mt-2 flex items-center justify-between text-xs text-muted">
                        <span>{lead.priority_display}</span>
                        <span>{lead.expected_budget}</span>
                      </div>
                    </button>
                  ))}
                  {!column.leads.length ? (
                    <p className="p-2 text-center text-xs text-muted">—</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )
      ) : tableQuery.isLoading ? (
        <Loading />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th scope="col" className="px-4 py-3 text-start font-medium">الاسم</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">الحالة</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">المصدر</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">الأولوية</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">متابعة</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">تاريخ</th>
              </tr>
            </thead>
            <tbody>
              {tableQuery.data?.results.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => setSelectedId(lead.id)}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-surface-hover/50"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium">{lead.name}</p>
                    <p className="text-xs text-muted">{lead.company || lead.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs',
                        statusTone(lead.status),
                      )}
                    >
                      {statusLabel(lead.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">{lead.source_display}</td>
                  <td className="px-4 py-3 text-muted">{lead.priority_display}</td>
                  <td className="px-4 py-3 text-muted">{crmDate(lead.next_follow_up_at)}</td>
                  <td className="px-4 py-3 text-muted">{crmDate(lead.created_at)}</td>
                </tr>
              ))}
              {tableQuery.data && !tableQuery.data.results.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted">
                    لا عملاء محتملون بعد. سيظهرون هنا تلقائيًا عند وصول طلبات المشاريع.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      {selectedId ? (
        <LeadDetailDrawer leadId={selectedId} onClose={() => setSelectedId(null)} />
      ) : null}
    </div>
  );
}

function Loading() {
  return (
    <div className="grid place-items-center py-16 text-muted" role="status">
      <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
    </div>
  );
}

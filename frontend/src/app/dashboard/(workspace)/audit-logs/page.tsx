'use client';

import { useQuery } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';

import { api } from '@/lib/api/client';
import type { Paginated } from '@/lib/api/types';

interface AuditEntry {
  id: number;
  user_name: string;
  action: string;
  action_display: string;
  model_name: string;
  object_repr: string;
  ip_address: string | null;
  created_at: string;
}

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page],
    queryFn: async () => {
      const { data: logs } = await api.get<Paginated<AuditEntry>>('/audit-logs/', {
        params: { page, page_size: 50 },
      });
      return logs;
    },
    placeholderData: (previous) => previous,
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-h2 font-semibold">سجل التدقيق</h1>
        <p className="mt-1 text-sm text-muted">كل عملية كتابة وحدث أمني، للقراءة فقط.</p>
      </header>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[44rem] text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted">
              <th scope="col" className="px-4 py-3 text-start font-medium">التاريخ</th>
              <th scope="col" className="px-4 py-3 text-start font-medium">المستخدم</th>
              <th scope="col" className="px-4 py-3 text-start font-medium">الإجراء</th>
              <th scope="col" className="px-4 py-3 text-start font-medium">العنصر</th>
              <th scope="col" className="px-4 py-3 text-start font-medium">IP</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted">
                  <LoaderCircle className="mx-auto size-5 animate-spin" aria-hidden="true" />
                </td>
              </tr>
            ) : (
              data?.results.map((entry) => (
                <tr key={entry.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <time dir="ltr" className="text-muted">
                      {new Intl.DateTimeFormat('ar', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                        numberingSystem: 'latn',
                      }).format(new Date(entry.created_at))}
                    </time>
                  </td>
                  <td className="px-4 py-3">{entry.user_name || '—'}</td>
                  <td className="px-4 py-3">{entry.action_display}</td>
                  <td className="max-w-64 px-4 py-3">
                    <span className="line-clamp-1" title={entry.object_repr}>
                      {entry.model_name} — {entry.object_repr || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span dir="ltr" className="text-muted">{entry.ip_address || '—'}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.total_pages > 1 ? (
        <nav aria-label="ترقيم الصفحات" className="mt-4 flex items-center justify-between text-sm">
          <p className="text-muted">
            صفحة <span dir="ltr">{data.current_page}</span> من{' '}
            <span dir="ltr">{data.total_pages}</span>
          </p>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
              className="min-h-11 rounded border border-border px-4 disabled:opacity-40"
            >
              السابق
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => current + 1)}
              disabled={!data.next}
              className="min-h-11 rounded border border-border px-4 disabled:opacity-40"
            >
              التالي
            </button>
          </div>
        </nav>
      ) : null}
    </div>
  );
}

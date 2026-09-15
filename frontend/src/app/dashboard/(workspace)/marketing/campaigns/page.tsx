'use client';

import { useQuery } from '@tanstack/react-query';
import { LoaderCircle, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import {
  CAMPAIGN_STATUSES,
  fmtDateTime,
  toneClass,
  type CampaignListItem,
} from '@/features/dashboard/marketing/shared';
import { api } from '@/lib/api/client';
import type { Paginated } from '@/lib/api/types';
import { cn } from '@/lib/utils/cn';

export default function CampaignsPage() {
  const { can } = useAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [search, status]);

  const list = useQuery({
    queryKey: ['campaigns', 'list', { search, status, page }],
    queryFn: async () => {
      const { data } = await api.get<Paginated<CampaignListItem>>('/campaigns/', {
        params: { page, page_size: 25, ...(search ? { search } : {}), ...(status ? { status } : {}) },
      });
      return data;
    },
    placeholderData: (previous) => previous,
    // حملة قيد الإرسال تتغيّر أرقامها — نحدّث القائمة ما دامت واحدة تُرسل
    refetchInterval: (query) =>
      query.state.data?.results.some((c) => c.status === 'sending') ? 5000 : false,
  });

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h2 font-semibold">الحملات</h1>
          <p className="mt-1 text-sm text-muted">رسائل تُرسل على دفعات إلى المشتركين النشطين حسب اللغة والاهتمام.</p>
        </div>
        {can('newsletter.add_campaign') ? (
          <Link
            href="/dashboard/marketing/campaigns/new"
            className="inline-flex min-h-11 items-center gap-2 rounded bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            <Plus className="size-4" aria-hidden="true" />
            حملة جديدة
          </Link>
        ) : null}
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="بحث بالاسم أو الموضوع"
            aria-label="بحث في الحملات"
            className="min-h-11 w-full rounded border border-border bg-background ps-9 pe-3 text-sm"
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="الحالة" className="min-h-11 rounded border border-border bg-background px-3 text-sm">
          <option value="">كل الحالات</option>
          {CAMPAIGN_STATUSES.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
      </div>

      {list.isLoading ? (
        <div className="grid place-items-center py-16 text-muted" role="status">
          <LoaderCircle className="size-6 animate-spin" aria-hidden="true" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th scope="col" className="px-4 py-3 text-start font-medium">الحملة</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">الحالة</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">المستلمون</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">فتح</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">نقر</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {list.data?.results.map((c) => {
                const rate = (n: number) => (c.sent_count ? `${Math.round((n / c.sent_count) * 100)}%` : '—');
                return (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-surface-hover/50">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/marketing/campaigns/${c.id}`} className="font-medium hover:text-primary">
                        {c.name}
                      </Link>
                      <p className="text-xs text-muted">{c.subject_ar || c.subject_en}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs', toneClass(CAMPAIGN_STATUSES, c.status))}>
                        {c.status_display}
                      </span>
                    </td>
                    <td className="px-4 py-3" dir="ltr">
                      {c.total_recipients ? `${c.sent_count} / ${c.total_recipients}` : '—'}
                      {c.failed_count ? <span className="ms-1 text-xs text-danger">({c.failed_count} فشل)</span> : null}
                    </td>
                    <td className="px-4 py-3" dir="ltr">{rate(c.open_count)}</td>
                    <td className="px-4 py-3" dir="ltr">{rate(c.click_count)}</td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {c.status === 'scheduled' ? `مجدولة: ${fmtDateTime(c.scheduled_at)}` : fmtDateTime(c.sent_at ?? c.created_at)}
                    </td>
                  </tr>
                );
              })}
              {!list.data?.results.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted">لا حملات بعد.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      {list.data && list.data.total_pages > 1 ? (
        <nav aria-label="الصفحات" className="mt-4 flex items-center justify-between text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="min-h-10 rounded border border-border px-3 disabled:opacity-40">السابق</button>
          <span className="text-muted" dir="ltr">{page} / {list.data.total_pages}</span>
          <button type="button" disabled={page >= list.data.total_pages} onClick={() => setPage((p) => p + 1)} className="min-h-10 rounded border border-border px-3 disabled:opacity-40">التالي</button>
        </nav>
      ) : null}
    </div>
  );
}

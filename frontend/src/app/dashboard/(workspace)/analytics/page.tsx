'use client';

import { useQuery } from '@tanstack/react-query';
import { Eye, FileText, MessageSquare, TrendingUp, Users } from 'lucide-react';
import { useState } from 'react';

import { api } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';

interface Overview {
  range_days: number;
  page_views: number;
  unique_visitors: number;
  members: number;
  leads: number;
  requests: number;
  published_posts: number;
}

const RANGES = [
  { value: '7d', label: '٧ أيام' },
  { value: '30d', label: '٣٠ يومًا' },
  { value: '90d', label: '٩٠ يومًا' },
];

function useAnalytics<T>(endpoint: string, range: string) {
  return useQuery({
    queryKey: ['analytics', endpoint, range],
    queryFn: async () => {
      const { data } = await api.get<T>(`/analytics/${endpoint}/`, { params: { range } });
      return data;
    },
  });
}

export default function AnalyticsPage() {
  const [range, setRange] = useState('30d');

  const overview = useAnalytics<Overview>('overview', range);
  const traffic = useAnalytics<{ date: string; views: number; visitors: number }[]>(
    'traffic',
    range,
  );
  const sources = useAnalytics<{ source: string; views: number }[]>('sources', range);
  const devices = useAnalytics<{ device_type: string; views: number }[]>('devices', range);
  const top = useAnalytics<{ content_type: string; object_slug: string; views: number }[]>(
    'top-content',
    range,
  );

  const o = overview.data;

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-h2 font-semibold">التحليلات</h1>
          <p className="mt-1 text-sm text-muted">
            إحصائيات داخلية تحترم الخصوصية — بلا تتبّع أو كوكيز.
          </p>
        </div>
        <div className="inline-flex rounded border border-border p-0.5">
          {RANGES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setRange(option.value)}
              aria-pressed={range === option.value}
              className={cn(
                'min-h-9 rounded px-3 text-sm',
                range === option.value ? 'bg-primary text-primary-foreground' : 'text-muted',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile icon={Eye} label="المشاهدات" value={o?.page_views} />
        <Tile icon={Users} label="زوّار فريدون" value={o?.unique_visitors} />
        <Tile icon={TrendingUp} label="طلبات المشاريع" value={o?.requests} />
        <Tile icon={MessageSquare} label="عملاء محتملون" value={o?.leads} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="الزيارات عبر الزمن">
          <TrafficChart data={traffic.data ?? []} />
        </Panel>

        <Panel title="مصادر الزيارات">
          <BarList
            rows={(sources.data ?? []).map((r) => ({ label: r.source, value: r.views }))}
            empty="لا مصادر بعد"
          />
        </Panel>

        <Panel title="الأجهزة">
          <BarList
            rows={(devices.data ?? []).map((r) => ({
              label: DEVICE_LABELS[r.device_type] ?? r.device_type,
              value: r.views,
            }))}
            empty="لا بيانات بعد"
          />
        </Panel>

        <Panel title="المحتوى الأكثر مشاهدة">
          <BarList
            rows={(top.data ?? []).map((r) => ({
              label: `${TYPE_LABELS[r.content_type] ?? r.content_type} — ${r.object_slug}`,
              value: r.views,
            }))}
            empty="لا مشاهدات بعد"
          />
        </Panel>
      </div>
    </div>
  );
}

const DEVICE_LABELS: Record<string, string> = {
  mobile: 'هاتف',
  tablet: 'لوحي',
  desktop: 'سطح مكتب',
};
const TYPE_LABELS: Record<string, string> = {
  blog: 'مقال',
  projects: 'مشروع',
  services: 'خدمة',
  solutions: 'حل',
  'case-studies': 'دراسة',
};

function Tile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye;
  label: string;
  value?: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <Icon className="mb-2 size-5 text-muted" aria-hidden="true" />
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-h2 font-bold" dir="ltr">
        {value ?? '—'}
      </p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <h2 className="mb-4 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function BarList({ rows, empty }: { rows: { label: string; value: number }[]; empty: string }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-2.5">
      {rows.map((row, index) => (
        <li key={index}>
          <div className="mb-1 flex items-center justify-between gap-2 text-sm">
            <span className="line-clamp-1" title={row.label}>{row.label}</span>
            <span className="shrink-0 text-muted" dir="ltr">{row.value}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-hover">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${(row.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function TrafficChart({ data }: { data: { date: string; views: number; visitors: number }[] }) {
  if (!data.length) {
    return <p className="py-6 text-center text-sm text-muted">لا زيارات بعد.</p>;
  }
  const max = Math.max(...data.map((d) => d.views), 1);
  return (
    <div className="flex h-40 items-end gap-1" role="img" aria-label="رسم الزيارات اليومية">
      {data.map((day) => (
        <div key={day.date} className="group flex flex-1 flex-col items-center justify-end gap-1">
          <div
            className="w-full rounded-t bg-primary/70 transition-colors group-hover:bg-primary"
            style={{ height: `${(day.views / max) * 100}%` }}
            title={`${day.date}: ${day.views}`}
          />
        </div>
      ))}
    </div>
  );
}

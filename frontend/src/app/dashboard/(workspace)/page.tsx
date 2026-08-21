'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Check,
  CircleDashed,
  Clock3,
  FileText,
  LoaderCircle,
  MessageSquare,
  TriangleAlert,
  UserCheck,
} from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/misc';
import { api, toApiError } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';

interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  hint: string;
}

interface Activity {
  new_requests: number;
  new_requests_delta_pct: number;
  active_clients: number;
  new_clients_month: number;
  unanswered_messages: number;
  unanswered_oldest_days: number;
  pending_comments: number;
  reported_comments: number;
  weekly_requests: { date: string; value: number }[];
  follow_ups_today: { id: number; title: string; target: string; due_at: string | null }[];
}

interface Summary {
  content: Record<string, number>;
  people: Record<string, number>;
  system: Record<string, number>;
  activity: Activity;
  checklist: ChecklistItem[];
  completion: number;
}

function useSummary() {
  return useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => {
      const { data } = await api.get<Summary>('/dashboard/summary/');
      return data;
    },
  });
}

type Tone = 'success' | 'warning' | 'danger' | 'default';

const CARD =
  'flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-subtle ' +
  'transition-all duration-normal hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card';

function ActivityCard({
  label,
  value,
  delta,
  tone,
  icon: Icon,
  href,
}: {
  label: string;
  value: number;
  delta: string;
  tone: Tone;
  icon: typeof FileText;
  href: string;
}) {
  return (
    <Link href={href} className={CARD}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted">{label}</span>
        <span className="grid size-9 place-items-center rounded-lg bg-primary-soft text-primary">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <p className="text-h1 font-bold leading-none">
        <span className="code-inline inline">{value}</span>
      </p>
      <Badge tone={tone} className="self-start">
        {delta}
      </Badge>
    </Link>
  );
}

/** رسم بياني بسيط بالأعمدة للطلبات الأسبوعية — CSS خالص، مدرك للاتجاه. */
function WeeklyChart({ series }: { series: Activity['weekly_requests'] }) {
  const max = Math.max(1, ...series.map((point) => point.value));
  const dayFmt = new Intl.DateTimeFormat('ar', { weekday: 'short' });

  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-subtle">
      <h2 className="mb-4 text-sm font-semibold">الطلبات الواردة أسبوعيًا</h2>
      <div className="flex h-40 items-end justify-between gap-2">
        {series.map((point) => {
          const height = Math.round((point.value / max) * 100);
          const day = dayFmt.format(new Date(point.date));
          return (
            <div key={point.date} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t-md bg-brand transition-all duration-slow"
                  style={{ height: `${Math.max(height, 4)}%` }}
                  role="img"
                  aria-label={`${day}: ${point.value} طلب`}
                  title={`${day}: ${point.value}`}
                />
              </div>
              <span className="text-xs text-muted">{day}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FollowUpsToday({ items }: { items: Activity['follow_ups_today'] }) {
  const timeFmt = new Intl.DateTimeFormat('ar', {
    hour: '2-digit',
    minute: '2-digit',
    numberingSystem: 'latn',
  });

  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-subtle">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">متابعات اليوم</h2>
        <Link href="/dashboard/crm/follow-ups" className="text-xs text-primary hover:underline">
          الكل
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <span className="grid size-11 place-items-center rounded-2xl bg-success-soft text-success">
            <Check className="size-5" aria-hidden="true" />
          </span>
          <p className="text-sm text-muted">لا متابعات مستحقّة اليوم.</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-warning-soft text-warning">
                <Clock3 className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate-line text-sm font-medium">{item.title || 'متابعة'}</p>
                {item.target ? (
                  <p className="truncate-line text-xs text-muted">{item.target}</p>
                ) : null}
              </div>
              {item.due_at ? (
                <span className="code-inline shrink-0 text-xs text-muted">
                  {timeFmt.format(new Date(item.due_at))}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function DashboardHomePage() {
  const { data, isLoading, isError, error, refetch } = useSummary();

  if (isLoading) {
    return (
      <div className="grid place-items-center py-24 text-muted" role="status">
        <LoaderCircle className="size-6 animate-spin" aria-hidden="true" />
        <span className="sr-only">جارٍ التحميل…</span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft p-8 text-center">
        <TriangleAlert className="mx-auto mb-3 size-8 text-danger" aria-hidden="true" />
        <p className="mb-4">{toApiError(error).detail}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm hover:bg-surface-hover"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  const { content, activity, checklist, completion } = data;

  const requestsDelta =
    activity.new_requests_delta_pct >= 0
      ? `+${activity.new_requests_delta_pct}% عن الشهر الماضي`
      : `${activity.new_requests_delta_pct}% عن الشهر الماضي`;

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-h2 font-semibold">نظرة عامة</h1>
        <p className="mt-1 text-sm text-muted">آخر 30 يومًا — نشاط المنصّة.</p>
      </header>

      {/* بطاقات النشاط */}
      <section aria-label="مؤشرات النشاط" className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ActivityCard
          label="طلبات جديدة"
          value={activity.new_requests}
          delta={requestsDelta}
          tone={activity.new_requests_delta_pct >= 0 ? 'success' : 'danger'}
          icon={FileText}
          href="/dashboard/crm/requests"
        />
        <ActivityCard
          label="عملاء نشطون"
          value={activity.active_clients}
          delta={`+${activity.new_clients_month} هذا الشهر`}
          tone="success"
          icon={UserCheck}
          href="/dashboard/crm/clients"
        />
        <ActivityCard
          label="رسائل بلا ردّ"
          value={activity.unanswered_messages}
          delta={
            activity.unanswered_messages
              ? `أقدمها قبل ${activity.unanswered_oldest_days} يومًا`
              : 'لا متأخرات'
          }
          tone={activity.unanswered_messages ? 'warning' : 'default'}
          icon={MessageSquare}
          href="/dashboard/crm/messages"
        />
        <ActivityCard
          label="تعليقات بانتظار الإشراف"
          value={activity.pending_comments}
          delta={
            activity.reported_comments
              ? `مبلّغ عنها: ${activity.reported_comments}`
              : activity.pending_comments
                ? 'بانتظار مراجعتك'
                : 'لا جديد'
          }
          tone={activity.reported_comments ? 'danger' : 'default'}
          icon={MessageSquare}
          href="/dashboard/community/comments"
        />
      </section>

      {/* الرسم البياني + متابعات اليوم */}
      <div className="mb-8 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <WeeklyChart series={activity.weekly_requests} />
        <FollowUpsToday items={activity.follow_ups_today} />
      </div>

      {/* اكتمال الموقع — قسم ثانوي */}
      <section aria-labelledby="checklist-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="checklist-heading" className="text-sm font-semibold text-muted">
            اكتمال الموقع
          </h2>
          <span className="code-inline text-sm font-medium">{completion}%</span>
        </div>

        <div
          className="mb-4 h-2 overflow-hidden rounded-full bg-surface-hover"
          role="progressbar"
          aria-valuenow={completion}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="نسبة اكتمال الموقع"
        >
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${completion}%` }}
          />
        </div>

        <ul className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
          {checklist.map((entry) => (
            <li key={entry.key} className="flex items-start gap-3 bg-surface p-3">
              {entry.done ? (
                <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
              ) : (
                <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
              )}
              <div className="min-w-0">
                <p className={cn('text-sm', entry.done && 'text-muted line-through')}>
                  {entry.label}
                </p>
                {!entry.done && entry.hint ? (
                  <p className="mt-0.5 text-xs text-muted">{entry.hint}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-3 text-xs text-muted">
          <span className="code-inline">{content.media_files}</span> ملف في مكتبة الوسائط.
        </p>
      </section>
    </div>
  );
}

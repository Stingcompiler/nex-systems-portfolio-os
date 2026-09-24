'use client';

import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  CalendarClock,
  Check,
  CircleDashed,
  Clock3,
  FileText,
  LoaderCircle,
  Mail,
  MessageSquare,
  PenLine,
  Send,
  TriangleAlert,
  UserCheck,
  UserMinus,
} from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/misc';
import { useAuth } from '@/contexts/AuthContext';
import { api, toApiError } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';

interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  hint: string;
}

interface CrmBlock {
  new_requests: number;
  new_requests_delta_pct: number;
  pending_requests: number;
  active_clients: number;
  new_clients_month: number;
  unanswered_messages: number;
  unanswered_oldest_days: number;
  weekly_requests: { date: string; value: number }[];
  follow_ups_today: { id: number; title: string; target: string; due_at: string | null }[];
}

interface MyPostsBlock {
  drafts: number;
  in_review: number;
  scheduled: number;
  published: number;
  recent: {
    id: number;
    slug: string;
    title: string;
    status: string;
    status_display: string;
    updated_at: string;
  }[];
}

interface MarketingBlock {
  active: number;
  pending: number;
  new_month: number;
  unsubscribed_month: number;
  drafts: number;
  scheduled: number;
  last_campaign: {
    id: number;
    subject_ar: string;
    sent_at: string | null;
    sent_count: number;
    open_count: number;
    click_count: number;
  } | null;
}

/**
 * الأقسام تصل بحسب صلاحيات المستخدم: الغائب منها لا يملك صاحبه صلاحيته،
 * فلا تُرسم بطاقة تقود إلى صفحة مرفوضة ولا يُعرض رقم لا يخصه.
 */
interface Summary {
  role: string;
  role_display: string;
  sections: string[];
  crm?: CrmBlock;
  community?: { pending_comments: number; reported_comments: number };
  my_posts?: MyPostsBlock;
  marketing?: MarketingBlock;
  analytics?: { views_month: number; visitors_month: number; views_delta_pct: number };
  site?: {
    services_published: number;
    projects_published: number;
    case_studies_published: number;
    media_files: number;
    checklist: ChecklistItem[];
    completion: number;
  };
  system?: {
    members: number;
    staff: number;
    unverified: number;
    unread_notifications: number;
    audit_events_today: number;
  };
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
  delta?: string;
  tone?: Tone;
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
      {delta ? (
        <Badge tone={tone ?? 'default'} className="self-start">
          {delta}
        </Badge>
      ) : null}
    </Link>
  );
}

/** رسم بياني بسيط بالأعمدة للطلبات الأسبوعية — CSS خالص، مدرك للاتجاه. */
function WeeklyChart({ series }: { series: CrmBlock['weekly_requests'] }) {
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

function FollowUpsToday({ items }: { items: CrmBlock['follow_ups_today'] }) {
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

const GRID = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-4';

function SectionTitle({ children, action }: { children: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold text-muted">{children}</h2>
      {action}
    </div>
  );
}

function signed(value: number, suffix: string) {
  return `${value >= 0 ? '+' : ''}${value}% ${suffix}`;
}

function CrmSection({ crm }: { crm: CrmBlock }) {
  return (
    <section aria-label="العملاء والطلبات" className="mb-8">
      <SectionTitle>العملاء والطلبات — آخر 30 يومًا</SectionTitle>
      <div className={cn(GRID, 'mb-4 lg:grid-cols-3')}>
        <ActivityCard
          label="طلبات جديدة"
          value={crm.new_requests}
          delta={
            crm.pending_requests
              ? `${crm.pending_requests} بانتظار المراجعة`
              : signed(crm.new_requests_delta_pct, 'عن الشهر الماضي')
          }
          tone={crm.pending_requests ? 'warning' : crm.new_requests_delta_pct >= 0 ? 'success' : 'danger'}
          icon={FileText}
          href="/dashboard/crm/requests"
        />
        <ActivityCard
          label="عملاء نشطون"
          value={crm.active_clients}
          delta={`+${crm.new_clients_month} هذا الشهر`}
          tone="success"
          icon={UserCheck}
          href="/dashboard/crm/clients"
        />
        <ActivityCard
          label="رسائل بلا ردّ"
          value={crm.unanswered_messages}
          delta={
            crm.unanswered_messages ? `أقدمها قبل ${crm.unanswered_oldest_days} يومًا` : 'لا متأخرات'
          }
          tone={crm.unanswered_messages ? 'warning' : 'default'}
          icon={MessageSquare}
          href="/dashboard/crm/messages"
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <WeeklyChart series={crm.weekly_requests} />
        <FollowUpsToday items={crm.follow_ups_today} />
      </div>
    </section>
  );
}

function MyPostsSection({ posts }: { posts: MyPostsBlock }) {
  const dateFmt = new Intl.DateTimeFormat('ar', { day: 'numeric', month: 'short', numberingSystem: 'latn' });
  return (
    <section aria-label="مقالاتي" className="mb-8">
      <SectionTitle
        action={
          <Link href="/dashboard/blog/posts" className="text-xs text-primary hover:underline">
            كل المقالات
          </Link>
        }
      >
        مقالاتي
      </SectionTitle>
      <div className={cn(GRID, 'mb-4')}>
        <ActivityCard label="مسودات" value={posts.drafts} icon={PenLine} href="/dashboard/blog/posts" />
        <ActivityCard
          label="قيد المراجعة"
          value={posts.in_review}
          tone="warning"
          delta={posts.in_review ? 'بانتظار الاعتماد' : undefined}
          icon={Clock3}
          href="/dashboard/blog/posts"
        />
        <ActivityCard label="مجدولة" value={posts.scheduled} icon={CalendarClock} href="/dashboard/blog/posts" />
        <ActivityCard label="منشورة" value={posts.published} icon={Check} href="/dashboard/blog/posts" />
      </div>
      <div className="rounded-xl border border-border bg-surface p-5 shadow-subtle">
        <h3 className="mb-3 text-sm font-semibold">آخر ما عملت عليه</h3>
        {posts.recent.length ? (
          <ul className="flex flex-col divide-y divide-border">
            {posts.recent.map((post) => (
              <li key={post.id} className="flex items-center justify-between gap-3 py-3">
                <span className="truncate-line min-w-0 text-sm font-medium">{post.title}</span>
                <span className="flex shrink-0 items-center gap-3">
                  <Badge tone={post.status === 'published' ? 'success' : post.status === 'in_review' ? 'warning' : 'default'}>
                    {post.status_display}
                  </Badge>
                  <span className="code-inline text-xs text-muted">
                    {dateFmt.format(new Date(post.updated_at))}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-muted">
            لم تكتب مقالًا بعد.{' '}
            <Link href="/dashboard/blog/posts" className="text-primary hover:underline">
              ابدأ أول مقال
            </Link>
          </p>
        )}
      </div>
    </section>
  );
}

function MarketingSection({
  marketing,
  analytics,
}: {
  marketing?: MarketingBlock;
  analytics?: Summary['analytics'];
}) {
  const last = marketing?.last_campaign;
  const rate = (part: number) => (last && last.sent_count ? `${Math.round((part * 100) / last.sent_count)}%` : '—');
  return (
    <section aria-label="التسويق والزيارات" className="mb-8">
      <SectionTitle>التسويق والزيارات — آخر 30 يومًا</SectionTitle>
      <div className={cn(GRID, 'mb-4')}>
        {marketing ? (
          <>
            <ActivityCard
              label="مشتركون نشطون"
              value={marketing.active}
              delta={`+${marketing.new_month} هذا الشهر`}
              tone="success"
              icon={Mail}
              href="/dashboard/marketing/subscribers"
            />
            <ActivityCard
              label="ألغوا الاشتراك"
              value={marketing.unsubscribed_month}
              delta={marketing.pending ? `${marketing.pending} بانتظار التأكيد` : undefined}
              icon={UserMinus}
              href="/dashboard/marketing/subscribers"
            />
            <ActivityCard
              label="حملات جاهزة للإرسال"
              value={marketing.drafts + marketing.scheduled}
              delta={marketing.scheduled ? `${marketing.scheduled} مجدولة` : undefined}
              icon={Send}
              href="/dashboard/marketing/campaigns"
            />
          </>
        ) : null}
        {analytics ? (
          <ActivityCard
            label="مشاهدات الصفحات"
            value={analytics.views_month}
            delta={`${analytics.visitors_month} زائر · ${signed(analytics.views_delta_pct, 'عن الشهر الماضي')}`}
            tone={analytics.views_delta_pct >= 0 ? 'success' : 'danger'}
            icon={BarChart3}
            href="/dashboard/analytics"
          />
        ) : null}
      </div>
      {marketing ? (
        <div className="rounded-xl border border-border bg-surface p-5 shadow-subtle">
          <h3 className="mb-3 text-sm font-semibold">آخر حملة مُرسلة</h3>
          {last ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Link
                href={`/dashboard/marketing/campaigns/${last.id}`}
                className="min-w-0 font-medium hover:text-primary hover:underline"
              >
                {last.subject_ar || 'بلا عنوان'}
              </Link>
              <dl className="flex gap-6 text-sm">
                <div>
                  <dt className="text-xs text-muted">أُرسلت إلى</dt>
                  <dd className="code-inline font-medium">{last.sent_count}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">فتح</dt>
                  <dd className="code-inline font-medium">{rate(last.open_count)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">نقر</dt>
                  <dd className="code-inline font-medium">{rate(last.click_count)}</dd>
                </div>
              </dl>
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-muted">
              لم تُرسل أي حملة بعد.{' '}
              <Link href="/dashboard/marketing/campaigns/new" className="text-primary hover:underline">
                أنشئ أول حملة
              </Link>
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}

function SiteSection({ site }: { site: NonNullable<Summary['site']> }) {
  return (
    <section aria-labelledby="checklist-heading" className="mb-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="checklist-heading" className="text-sm font-semibold text-muted">
          اكتمال الموقع
        </h2>
        <span className="code-inline text-sm font-medium">{site.completion}%</span>
      </div>

      <div
        className="mb-4 h-2 overflow-hidden rounded-full bg-surface-hover"
        role="progressbar"
        aria-valuenow={site.completion}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="نسبة اكتمال الموقع"
      >
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${site.completion}%` }} />
      </div>

      <ul className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
        {site.checklist.map((entry) => (
          <li key={entry.key} className="flex items-start gap-3 bg-surface p-3">
            {entry.done ? (
              <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
            ) : (
              <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
            )}
            <div className="min-w-0">
              <p className={cn('text-sm', entry.done && 'text-muted line-through')}>{entry.label}</p>
              {!entry.done && entry.hint ? <p className="mt-0.5 text-xs text-muted">{entry.hint}</p> : null}
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-muted">
        منشور: <span className="code-inline">{site.services_published}</span> خدمة وحل،{' '}
        <span className="code-inline">{site.projects_published}</span> مشروع،{' '}
        <span className="code-inline">{site.case_studies_published}</span> دراسة حالة ·{' '}
        <span className="code-inline">{site.media_files}</span> ملف في مكتبة الوسائط.
      </p>
    </section>
  );
}

function SystemSection({ system }: { system: NonNullable<Summary['system']> }) {
  const items = [
    { label: 'أعضاء', value: system.members, href: '/dashboard/users' },
    { label: 'فريق اللوحة', value: system.staff, href: '/dashboard/users' },
    { label: 'بريد غير مؤكد', value: system.unverified, href: '/dashboard/users' },
    { label: 'إشعارات غير مقروءة', value: system.unread_notifications, href: '/dashboard/notifications' },
    { label: 'أحداث التدقيق اليوم', value: system.audit_events_today, href: '/dashboard/audit-logs' },
  ];
  return (
    <section aria-label="النظام" className="mb-8">
      <SectionTitle>النظام</SectionTitle>
      <ul className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3 lg:grid-cols-5">
        {items.map((item) => (
          <li key={item.label} className="bg-surface">
            <Link href={item.href} className="flex flex-col gap-1 p-4 hover:bg-surface-hover">
              <span className="text-xs text-muted">{item.label}</span>
              <span className="code-inline text-h3 font-semibold">{item.value}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** سطر يصف ما تعرضه الصفحة لهذا الدور — الصفحة نفسها تختلف من دور لآخر. */
const ROLE_INTRO: Record<string, string> = {
  super_admin: 'كل أقسام المنصّة في مكان واحد.',
  content_manager: 'محتوى الموقع ومقالاتك والتعليقات بانتظار الإشراف.',
  editor: 'مقالاتك وحالتها.',
  crm_manager: 'الطلبات والعملاء والرسائل ومتابعات اليوم.',
  marketing_manager: 'المشتركون والحملات وزيارات الموقع.',
};

export default function DashboardHomePage() {
  const { data, isLoading, isError, error, refetch } = useSummary();
  const { user } = useAuth();

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

  const intro = ROLE_INTRO[data.role] ?? ROLE_INTRO.super_admin;

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-h2 font-semibold">
          {user?.full_name ? `مرحبًا، ${user.full_name}` : 'نظرة عامة'}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {data.role_display ? <Badge className="me-2">{data.role_display}</Badge> : null}
          {intro}
        </p>
      </header>

      {data.crm ? <CrmSection crm={data.crm} /> : null}

      {data.community && (data.community.pending_comments || data.community.reported_comments) ? (
        <section aria-label="المجتمع" className="mb-8">
          <SectionTitle>المجتمع</SectionTitle>
          <div className={GRID}>
            <ActivityCard
              label="تعليقات بانتظار الإشراف"
              value={data.community.pending_comments}
              delta={data.community.reported_comments ? `مبلّغ عنها: ${data.community.reported_comments}` : 'بانتظار مراجعتك'}
              tone={data.community.reported_comments ? 'danger' : 'warning'}
              icon={MessageSquare}
              href="/dashboard/community/comments"
            />
          </div>
        </section>
      ) : null}

      {data.my_posts ? <MyPostsSection posts={data.my_posts} /> : null}

      {data.marketing || data.analytics ? (
        <MarketingSection marketing={data.marketing} analytics={data.analytics} />
      ) : null}

      {data.site ? <SiteSection site={data.site} /> : null}

      {data.system ? <SystemSection system={data.system} /> : null}

      {data.sections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center">
          <p className="font-medium">لا توجد أقسام مرتبطة بدورك بعد.</p>
          <p className="mt-2 text-sm text-muted">
            تواصل مع المدير العام لمنحك الصلاحيات التي يحتاجها عملك.
          </p>
        </div>
      ) : null}
    </div>
  );
}

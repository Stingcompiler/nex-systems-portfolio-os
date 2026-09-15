'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  CalendarClock,
  Copy,
  FlaskConical,
  LoaderCircle,
  Send,
  Users,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import {
  CAMPAIGN_STATUSES,
  TARGET_LANGUAGES,
  fmtDateTime,
  toneClass,
  type Campaign,
  type CampaignStats,
  type InterestOption,
} from '@/features/dashboard/marketing/shared';
import { ResourceField } from '@/features/dashboard/resource/fields';
import { api, toApiError, type ApiErrorPayload } from '@/lib/api/client';
import type { Paginated } from '@/lib/api/types';
import { cn } from '@/lib/utils/cn';

const INPUT =
  'min-h-11 w-full rounded border border-border bg-background px-3 text-sm ' +
  'focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60';

type Draft = Pick<
  Campaign,
  | 'name' | 'subject_ar' | 'subject_en' | 'content_ar' | 'content_en' | 'image'
  | 'cta_label_ar' | 'cta_label_en' | 'cta_url' | 'template'
  | 'target_language' | 'target_interests'
>;

const EMPTY: Draft = {
  name: '',
  subject_ar: '',
  subject_en: '',
  content_ar: '',
  content_en: '',
  image: null,
  cta_label_ar: '',
  cta_label_en: '',
  cta_url: '',
  template: null,
  target_language: 'all',
  target_interests: [],
};

function toDraft(campaign: Campaign): Draft {
  return {
    name: campaign.name,
    subject_ar: campaign.subject_ar,
    subject_en: campaign.subject_en,
    content_ar: campaign.content_ar,
    content_en: campaign.content_en,
    image: campaign.image,
    cta_label_ar: campaign.cta_label_ar,
    cta_label_en: campaign.cta_label_en,
    cta_url: campaign.cta_url,
    template: campaign.template,
    target_language: campaign.target_language,
    target_interests: campaign.target_interests,
  };
}

interface TemplateOption {
  id: number;
  name: string;
  is_active: boolean;
}

/**
 * منشئ الحملات: نموذج المحتوى والجمهور على اليمين، وشريط الإجراءات
 * (معاينة العدد، اختبار، إرسال، جدولة) على اليسار.
 *
 * بلا `id` يعمل كصفحة إنشاء ويحوّل إلى صفحة الحملة بعد الحفظ الأول.
 */
export function CampaignEditor({ id }: { id?: number }) {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { can, user } = useAuth();

  const canSend = can('newsletter.send_campaign');
  const canEdit = can('newsletter.change_campaign');

  const campaignQuery = useQuery({
    queryKey: ['campaigns', 'detail', id],
    enabled: Boolean(id),
    queryFn: async () => (await api.get<Campaign>(`/campaigns/${id}/`)).data,
    refetchInterval: (query) => (query.state.data?.status === 'sending' ? 4000 : false),
  });
  const campaign = campaignQuery.data;

  const interests = useQuery({
    queryKey: ['interests', 'ar'],
    queryFn: async () => (await api.get<InterestOption[]>('/interests/', { params: { lang: 'ar' } })).data,
    staleTime: 60 * 60_000,
  });
  const templates = useQuery({
    queryKey: ['email-templates', 'options'],
    queryFn: async () =>
      (await api.get<Paginated<TemplateOption>>('/email-templates/', { params: { page_size: 100 } })).data.results,
    staleTime: 5 * 60_000,
  });

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  // تعبئة النموذج من الخادم مرة واحدة (أو بعد الحفظ) ما لم يكن المستخدم يعدّل
  useEffect(() => {
    if (campaign && !dirty) setDraft(toDraft(campaign));
  }, [campaign, dirty]);

  const editable = !campaign || campaign.status === 'draft' || campaign.status === 'scheduled';
  const locked = !editable || !canEdit;

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (id) return (await api.patch<Campaign>(`/campaigns/${id}/`, draft)).data;
      return (await api.post<Campaign>('/campaigns/', draft)).data;
    },
    onSuccess: (saved) => {
      setErrors({});
      setDirty(false);
      toast.success('حُفظت الحملة');
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      if (!id) router.replace(`/dashboard/marketing/campaigns/${saved.id}`);
    },
    onError: (error) => {
      const payload = toApiError(error);
      setErrors(payload.errors ?? {});
      toast.error(payload.detail);
    },
  });

  // ---------------------------------------------------------- الإجراءات

  const action = useMutation({
    mutationFn: async ({ path, body }: { path: string; body?: unknown }) =>
      (await api.post<Campaign & { detail?: string }>(`/campaigns/${id}/${path}/`, body ?? {})).data,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      if (variables.path === 'duplicate') {
        toast.success('أُنشئت نسخة كمسودة');
        router.push(`/dashboard/marketing/campaigns/${data.id}`);
        return;
      }
      if (data.detail) toast.success(data.detail);
      else toast.success({ send: 'بدأ الإرسال', schedule: 'جُدولت الحملة', cancel: 'أُلغيت الحملة' }[variables.path] ?? 'تم');
    },
    onError: (error) => toast.error(toApiError(error).detail),
  });

  const audience = useQuery({
    queryKey: ['campaigns', 'audience', id, campaign?.target_language, campaign?.target_interests],
    enabled: Boolean(id) && Boolean(campaign),
    queryFn: async () =>
      (await api.get<{ total: number; ar: number; en: number }>(`/campaigns/${id}/preview-audience/`)).data,
  });

  const stats = useQuery({
    queryKey: ['campaigns', 'stats', id],
    enabled: Boolean(campaign) && ['sending', 'sent', 'failed'].includes(campaign?.status ?? ''),
    queryFn: async () => (await api.get<CampaignStats>(`/campaigns/${id}/stats/`)).data,
    refetchInterval: campaign?.status === 'sending' ? 4000 : false,
  });

  const [scheduleAt, setScheduleAt] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [testLanguage, setTestLanguage] = useState<'ar' | 'en'>('ar');
  const [confirmSend, setConfirmSend] = useState(false);

  const hasSubject = Boolean(draft.subject_ar || draft.subject_en);
  const hasContent = Boolean(draft.content_ar || draft.content_en);
  const readyToSend = Boolean(id) && !dirty && hasSubject && hasContent;

  if (id && campaignQuery.isLoading) {
    return (
      <div className="grid place-items-center py-16 text-muted" role="status">
        <LoaderCircle className="size-6 animate-spin" aria-hidden="true" />
      </div>
    );
  }
  if (id && campaignQuery.isError) {
    return <p className="text-sm text-danger">تعذّر تحميل الحملة.</p>;
  }

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/marketing/campaigns"
            aria-label="العودة إلى الحملات"
            className="grid size-10 place-items-center rounded border border-border text-muted hover:bg-surface-hover"
          >
            <ArrowRight className="size-4 flip-rtl" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-h2 font-semibold">{id ? campaign?.name || 'الحملة' : 'حملة جديدة'}</h1>
            {campaign ? (
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className={cn('inline-flex rounded-full px-2 py-0.5', toneClass(CAMPAIGN_STATUSES, campaign.status))}>
                  {campaign.status_display}
                </span>
                {campaign.status === 'scheduled' ? <span>موعد الإرسال: {fmtDateTime(campaign.scheduled_at)}</span> : null}
                {campaign.sent_at ? <span>اكتمل: {fmtDateTime(campaign.sent_at)}</span> : null}
                {campaign.source_model ? <span>من {campaign.source_model === 'Post' ? 'مقال' : campaign.source_model === 'Project' ? 'مشروع' : 'خدمة'} منشور</span> : null}
              </p>
            ) : null}
          </div>
        </div>
        {!locked ? (
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending || !draft.name}
            className="inline-flex min-h-11 items-center gap-2 rounded bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {save.isPending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
            {id ? 'حفظ' : 'إنشاء المسودة'}
          </button>
        ) : null}
      </header>

      {!id ? <FromContentPicker /> : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        {/* ---------------------------------------------------- النموذج */}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!locked) save.mutate();
          }}
          className="space-y-6"
        >
          <fieldset disabled={locked} className="rounded-lg border border-border bg-surface p-5">
            <legend className="px-1 text-sm font-semibold">المحتوى</legend>
            <Field id="name" label="الاسم الداخلي" error={errors.name} required>
              <input id="name" value={draft.name} onChange={(e) => set('name', e.target.value)} className={INPUT} placeholder="لا يظهر للمشترك" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="subject_ar" label="الموضوع (عربي)" error={errors.subject_ar}>
                <input id="subject_ar" value={draft.subject_ar} onChange={(e) => set('subject_ar', e.target.value)} className={INPUT} />
              </Field>
              <Field id="subject_en" label="الموضوع (إنجليزي)" error={errors.subject_en}>
                <input id="subject_en" dir="ltr" value={draft.subject_en} onChange={(e) => set('subject_en', e.target.value)} className={INPUT} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="content_ar" label="المحتوى (عربي)" error={errors.content_ar} help="نص عادي — سطر فارغ يفصل بين الفقرات.">
                <textarea id="content_ar" rows={10} value={draft.content_ar} onChange={(e) => set('content_ar', e.target.value)} className={cn(INPUT, 'min-h-40 py-2')} />
              </Field>
              <Field id="content_en" label="المحتوى (إنجليزي)" error={errors.content_en}>
                <textarea id="content_en" rows={10} dir="ltr" value={draft.content_en} onChange={(e) => set('content_en', e.target.value)} className={cn(INPUT, 'min-h-40 py-2')} />
              </Field>
            </div>
            <ResourceField
              field={{ name: 'image', label: 'صورة الرسالة (اختياري)', type: 'media' }}
              values={{ image: draft.image }}
              setValue={(_, value) => set('image', (value as number | null) ?? null)}
              errors={errors}
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field id="cta_label_ar" label="نص الزر (عربي)">
                <input id="cta_label_ar" value={draft.cta_label_ar} onChange={(e) => set('cta_label_ar', e.target.value)} className={INPUT} />
              </Field>
              <Field id="cta_label_en" label="نص الزر (إنجليزي)">
                <input id="cta_label_en" dir="ltr" value={draft.cta_label_en} onChange={(e) => set('cta_label_en', e.target.value)} className={INPUT} />
              </Field>
              <Field id="cta_url" label="رابط الزر" error={errors.cta_url}>
                <input id="cta_url" type="url" dir="ltr" value={draft.cta_url} onChange={(e) => set('cta_url', e.target.value)} className={INPUT} placeholder="https://" />
              </Field>
            </div>
            <Field id="template" label="القالب" help="فارغ = القالب الافتراضي بهوية الموقع.">
              <select id="template" value={draft.template ?? ''} onChange={(e) => set('template', e.target.value ? Number(e.target.value) : null)} className={INPUT}>
                <option value="">الافتراضي</option>
                {templates.data?.filter((t) => t.is_active).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </Field>
          </fieldset>

          <fieldset disabled={locked} className="rounded-lg border border-border bg-surface p-5">
            <legend className="px-1 text-sm font-semibold">الجمهور</legend>
            <Field id="target_language" label="اللغة المستهدفة">
              <select id="target_language" value={draft.target_language} onChange={(e) => set('target_language', e.target.value as Draft['target_language'])} className={INPUT}>
                {TARGET_LANGUAGES.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </Field>
            <div>
              <p className="mb-1.5 text-sm font-medium">الاهتمامات المستهدفة</p>
              <p className="mb-2 text-xs text-muted">لا اختيار = كل المشتركين النشطين. أكثر من اهتمام = من اختار أيًّا منها.</p>
              <div className="flex flex-wrap gap-2">
                {interests.data?.map((item) => {
                  const active = draft.target_interests.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => set('target_interests', active ? draft.target_interests.filter((v) => v !== item.id) : [...draft.target_interests, item.id])}
                      className={cn('min-h-10 rounded-full border px-3 text-sm', active ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted hover:text-foreground')}
                    >
                      {item.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </fieldset>
        </form>

        {/* ---------------------------------------------------- الشريط الجانبي */}
        <aside className="space-y-4">
          {id ? (
            <div className="rounded-lg border border-border bg-surface p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Users className="size-4 text-primary" aria-hidden="true" />
                المستلمون المتوقعون
              </p>
              {dirty ? (
                <p className="text-xs text-warning">احفظ التغييرات لتحديث العدد.</p>
              ) : audience.data ? (
                <>
                  <p className="text-3xl font-semibold" dir="ltr">{audience.data.total}</p>
                  <p className="text-xs text-muted" dir="ltr">AR {audience.data.ar} · EN {audience.data.en}</p>
                </>
              ) : (
                <LoaderCircle className="size-4 animate-spin text-muted" aria-hidden="true" />
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted">
              أنشئ المسودة أولًا لتظهر معاينة الجمهور وأزرار الإرسال.
            </div>
          )}

          {id && editable ? (
            <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
              <div>
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <FlaskConical className="size-4 text-primary" aria-hidden="true" />
                  إرسال اختباري
                </p>
                <input
                  type="email"
                  dir="ltr"
                  placeholder={user?.email ?? 'بريدك'}
                  aria-label="بريد الاختبار"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className={cn(INPUT, 'mb-2')}
                />
                <div className="flex gap-2">
                  <select aria-label="لغة الاختبار" value={testLanguage} onChange={(e) => setTestLanguage(e.target.value as 'ar' | 'en')} className={cn(INPUT, 'w-auto')}>
                    <option value="ar">عربي</option>
                    <option value="en">English</option>
                  </select>
                  <button
                    type="button"
                    disabled={!readyToSend || action.isPending}
                    onClick={() => action.mutate({ path: 'test-send', body: { email: testEmail || undefined, language: testLanguage } })}
                    className="min-h-11 flex-1 rounded border border-border px-3 text-sm hover:bg-surface-hover disabled:opacity-50"
                  >
                    أرسل نسخة
                  </button>
                </div>
              </div>

              {canSend ? (
                <>
                  <hr className="border-border" />
                  <div>
                    <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <CalendarClock className="size-4 text-primary" aria-hidden="true" />
                      جدولة
                    </p>
                    <input
                      type="datetime-local"
                      aria-label="موعد الإرسال"
                      value={scheduleAt}
                      onChange={(e) => setScheduleAt(e.target.value)}
                      className={cn(INPUT, 'mb-2')}
                    />
                    <button
                      type="button"
                      disabled={!readyToSend || !scheduleAt || action.isPending}
                      onClick={() => action.mutate({ path: 'schedule', body: { scheduled_at: new Date(scheduleAt).toISOString() } })}
                      className="min-h-11 w-full rounded border border-border px-3 text-sm hover:bg-surface-hover disabled:opacity-50"
                    >
                      {campaign?.status === 'scheduled' ? 'تغيير الموعد' : 'جدولة الإرسال'}
                    </button>
                  </div>
                  <hr className="border-border" />
                  {!confirmSend ? (
                    <button
                      type="button"
                      disabled={!readyToSend || action.isPending || !audience.data?.total}
                      onClick={() => setConfirmSend(true)}
                      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
                    >
                      <Send className="size-4 flip-rtl" aria-hidden="true" />
                      إرسال الآن
                    </button>
                  ) : (
                    <div className="rounded border border-warning/40 bg-warning/10 p-3 text-sm">
                      <p className="mb-3">
                        سيُرسل إلى <strong dir="ltr">{audience.data?.total}</strong> مشترك على دفعات ولا يمكن التراجع بعد بدء الإرسال. متأكد؟
                      </p>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setConfirmSend(false)} className="min-h-10 flex-1 rounded border border-border text-sm">تراجع</button>
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmSend(false);
                            action.mutate({ path: 'send' });
                          }}
                          className="min-h-10 flex-1 rounded bg-primary text-sm font-medium text-primary-foreground"
                        >
                          نعم، أرسل
                        </button>
                      </div>
                    </div>
                  )}
                  {!hasSubject || !hasContent ? (
                    <p className="text-xs text-muted">الموضوع والمحتوى مطلوبان بلغة واحدة على الأقل قبل الإرسال.</p>
                  ) : null}
                </>
              ) : (
                <p className="text-xs text-muted">الإرسال يتطلب صلاحية «إرسال الحملات».</p>
              )}
            </div>
          ) : null}

          {campaign && ['sending', 'sent', 'failed'].includes(campaign.status) ? (
            <CampaignStatsPanel stats={stats.data} campaign={campaign} />
          ) : null}

          {id ? (
            <div className="flex flex-wrap gap-2">
              {campaign && ['draft', 'scheduled', 'sending'].includes(campaign.status) ? (
                <button
                  type="button"
                  disabled={action.isPending}
                  onClick={() => action.mutate({ path: 'cancel' })}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded border border-border px-3 text-xs text-muted hover:text-danger"
                >
                  <XCircle className="size-3.5" aria-hidden="true" />
                  {campaign.status === 'sending' ? 'إيقاف الإرسال' : 'إلغاء الحملة'}
                </button>
              ) : null}
              <button
                type="button"
                disabled={action.isPending}
                onClick={() => action.mutate({ path: 'duplicate' })}
                className="inline-flex min-h-10 items-center gap-1.5 rounded border border-border px-3 text-xs text-muted hover:text-foreground"
              >
                <Copy className="size-3.5" aria-hidden="true" />
                نسخ كمسودة
              </button>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  help,
  error,
  required,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  error?: string[];
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </label>
      {children}
      {help ? <p className="mt-1 text-xs text-muted">{help}</p> : null}
      {error?.length ? <p className="mt-1 text-xs text-danger">{error[0]}</p> : null}
    </div>
  );
}

function CampaignStatsPanel({ stats, campaign }: { stats?: CampaignStats; campaign: Campaign }) {
  const total = campaign.total_recipients || 1;
  const progress = Math.round(((campaign.sent_count + campaign.failed_count) / total) * 100);
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="mb-3 text-sm font-semibold">
        {campaign.status === 'sending' ? 'جارٍ الإرسال…' : 'النتائج'}
      </p>
      {campaign.status === 'sending' ? (
        <div className="mb-3">
          <div className="h-2 overflow-hidden rounded-full bg-surface-hover">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted" dir="ltr">{campaign.sent_count + campaign.failed_count} / {campaign.total_recipients}</p>
        </div>
      ) : null}
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <Stat label="أُرسل" value={campaign.sent_count} />
        <Stat label="فشل" value={campaign.failed_count} tone={campaign.failed_count ? 'text-danger' : undefined} />
        <Stat label="فتح" value={campaign.open_count} extra={stats ? `${stats.open_rate}%` : undefined} />
        <Stat label="نقر" value={campaign.click_count} extra={stats ? `${stats.click_rate}%` : undefined} />
        <Stat label="إلغاء اشتراك" value={campaign.unsubscribe_count} />
        <Stat label="بانتظار" value={stats?.pending ?? Math.max(0, campaign.total_recipients - campaign.sent_count - campaign.failed_count)} />
      </dl>
      <p className="mt-3 text-xs text-muted">
        نسبة الفتح تقديرية — بعض برامج البريد تحجب صور التتبع.
      </p>
    </div>
  );
}

function Stat({ label, value, extra, tone }: { label: string; value: number; extra?: string; tone?: string }) {
  return (
    <div className="rounded border border-border p-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={cn('font-semibold', tone)} dir="ltr">
        {value}
        {extra ? <span className="ms-1 text-xs font-normal text-muted">({extra})</span> : null}
      </dd>
    </div>
  );
}

// ---------------------------------------------------------------- من المحتوى

const CONTENT_KINDS = [
  { value: 'post', label: 'مقال', endpoint: '/posts/' },
  { value: 'project', label: 'مشروع', endpoint: '/projects/' },
  { value: 'service', label: 'خدمة', endpoint: '/services/' },
] as const;

interface ContentItem {
  id: number;
  title: string;
}

/** يبني مسودة جاهزة من مقال أو مشروع أو خدمة منشورة بضغطة واحدة. */
function FromContentPicker() {
  const router = useRouter();
  const toast = useToast();
  const [kind, setKind] = useState<(typeof CONTENT_KINDS)[number]['value']>('post');
  const [search, setSearch] = useState('');
  const endpoint = useMemo(() => CONTENT_KINDS.find((k) => k.value === kind)!.endpoint, [kind]);

  const items = useQuery({
    queryKey: ['from-content', kind, search],
    queryFn: async () =>
      (await api.get<Paginated<ContentItem>>(endpoint, { params: { page_size: 8, lang: 'ar', ...(search ? { search } : {}) } })).data.results,
  });

  const create = useMutation({
    mutationFn: async (itemId: number) =>
      (await api.post<Campaign>('/campaigns/from-content/', { kind, id: itemId })).data,
    onSuccess: (campaign) => {
      toast.success('أُنشئت مسودة من المحتوى');
      router.push(`/dashboard/marketing/campaigns/${campaign.id}`);
    },
    onError: (error: unknown) => toast.error((toApiError(error) as ApiErrorPayload).detail),
  });

  return (
    <details className="mb-6 rounded-lg border border-border bg-surface p-4">
      <summary className="cursor-pointer text-sm font-semibold">أو ابدأ من محتوى منشور (مقال · مشروع · خدمة)</summary>
      <p className="mb-3 mt-1 text-xs text-muted">
        الموضوع من العنوان والمحتوى من الملخص والزر إلى الصفحة، والجمهور هو الاهتمام المقابل — ثم عدّل ما تشاء.
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} aria-label="نوع المحتوى" className={cn(INPUT, 'w-auto')}>
          {CONTENT_KINDS.map((k) => (
            <option key={k.value} value={k.value}>{k.label}</option>
          ))}
        </select>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالعنوان"
          aria-label="بحث في المحتوى"
          className={cn(INPUT, 'min-w-56 flex-1')}
        />
      </div>
      <ul className="divide-y divide-border rounded border border-border">
        {items.data?.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <span className="truncate">{item.title}</span>
            <button
              type="button"
              disabled={create.isPending}
              onClick={() => create.mutate(item.id)}
              className="min-h-9 shrink-0 rounded border border-border px-3 text-xs hover:bg-surface-hover disabled:opacity-50"
            >
              إنشاء مسودة
            </button>
          </li>
        ))}
        {items.isLoading ? <li className="px-3 py-3 text-xs text-muted">…</li> : null}
        {items.data && !items.data.length ? <li className="px-3 py-3 text-xs text-muted">لا نتائج.</li> : null}
      </ul>
    </details>
  );
}

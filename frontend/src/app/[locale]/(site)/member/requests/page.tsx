'use client';

import { useQuery } from '@tanstack/react-query';
import { FileText, LoaderCircle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { buttonClass } from '@/components/ui/button-styles';
import { useMember } from '@/contexts/MemberContext';
import { StageBadge, StageProgress, stageOf } from '@/features/track/stages';
import { api } from '@/lib/api/client';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';

interface MyRequest {
  id: number;
  reference_code: string;
  status: string;
  created_at: string;
  updated_at: string;
  project_type: string;
  project_type_display: string;
  service_title: string;
  description: string;
  budget_range: string;
  budget_display: string;
  timeline: string;
  timeline_display: string;
  tracking_token: string | null;
}

export default function MyRequestsPage() {
  const t = useTranslations('member.requests');
  const tTabs = useTranslations('member.tabs');
  const tForm = useTranslations('requestForm');
  const tTrack = useTranslations('track');
  // تسميات الخيارات في الخادم عربية؛ ترجمات نموذج الطلب تغطي المفاتيح نفسها
  const choice = (group: 'projectType' | 'budget' | 'timeline', key: string, fallback: string) =>
    key && tForm.has(`${group}.${key}`) ? tForm(`${group}.${key}`) : fallback;
  const locale = useLocale();
  const { member } = useMember();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['my-requests'],
    queryFn: async () => {
      const { data: list } = await api.get<MyRequest[]>('/project-requests/mine/');
      return list;
    },
  });

  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', numberingSystem: 'latn' });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h2 font-semibold">{tTabs('requests')}</h1>
        <Link href="/request-quote" className={buttonClass('primary', 'sm')}>
          {t('newRequest')}
        </Link>
      </div>

      {member && !member.is_email_verified ? (
        <p className="mb-4 rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm">
          {t('verifyToSee')}
        </p>
      ) : null}

      {isLoading ? (
        <div className="grid place-items-center py-12 text-muted" role="status">
          <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
        </div>
      ) : isError ? (
        <div role="alert" className="rounded-lg border border-danger/40 bg-danger-soft p-4 text-sm">
          {t('loadError')}{' '}
          <button type="button" onClick={() => refetch()} className="font-medium underline">
            {t('retry')}
          </button>
        </div>
      ) : data && data.length ? (
        <ul className="space-y-4">
          {data.map((request) => {
            const info = stageOf('request', request.status);
            return (
              <li key={request.id} className="rounded-xl border border-border bg-surface p-5 shadow-subtle">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {request.service_title ||
                        choice('projectType', request.project_type, request.project_type_display) ||
                        t('generalRequest')}
                    </p>
                    <p className="mt-0.5 text-sm text-muted">
                      <span dir="ltr" className="font-mono">{request.reference_code}</span>
                      {' · '}
                      {dateFmt.format(new Date(request.created_at))}
                    </p>
                  </div>
                  <StageBadge info={info} />
                </div>

                <StageProgress info={info} className="mb-4" />

                <p className="line-clamp-3 whitespace-pre-line text-sm text-muted">{request.description}</p>

                {request.budget_display || request.timeline_display ? (
                  <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
                    {request.budget_display ? (
                      <div className="flex gap-1">
                        <dt>{t('budget')}:</dt>
                        <dd className="font-medium text-foreground">
                          {choice('budget', request.budget_range, request.budget_display)}
                        </dd>
                      </div>
                    ) : null}
                    {request.timeline_display ? (
                      <div className="flex gap-1">
                        <dt>{t('timeline')}:</dt>
                        <dd className="font-medium text-foreground">
                          {choice('timeline', request.timeline, request.timeline_display)}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                ) : null}

                <p className="mt-4 border-t border-border pt-3 text-sm">
                  {request.tracking_token ? (
                    <>
                      <Link
                        href={`/track/${request.tracking_token}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {tTrack('detailsAndReplies')}
                      </Link>
                      <span className="text-muted"> · </span>
                    </>
                  ) : null}
                  <Link href={`/contact`} className="text-primary hover:underline">
                    {t('askAbout')}
                  </Link>{' '}
                  <span className="text-muted">{t('mentionReference')}</span>
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary">
            <FileText className="size-6" aria-hidden="true" />
          </span>
          <p className="font-medium">{t('empty')}</p>
          <p className="max-w-prose text-sm text-muted">{t('emptyHint')}</p>
          <Link href="/request-quote" className={cn(buttonClass('primary'), 'mt-2')}>
            {t('newRequest')}
          </Link>
        </div>
      )}
    </div>
  );
}

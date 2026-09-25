'use client';

import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { LoaderCircle, MessageSquareText } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { buttonClass } from '@/components/ui/button-styles';
import {
  StageBadge,
  StageGuide,
  StageProgress,
  stageOf,
  type TrackKind,
} from '@/features/track/stages';
import { TrackBox } from '@/features/track/track-box';
import { api } from '@/lib/api/client';
import { Link } from '@/lib/i18n/navigation';

interface TrackDetail {
  kind: TrackKind;
  reference_code: string;
  status: string;
  name: string;
  created_at: string;
  updated_at: string;
  project_type: string;
  project_type_display: string;
  service_title: string;
  subject: string;
  body: string;
  budget_range: string;
  timeline: string;
  replies: { id: number; body: string; created_at: string }[];
}

/**
 * صفحة المتابعة: الحالة ومراحلها، نص الطلب، وردود الفريق بترتيب زمني.
 * تُجلب من المتصفح بلا تخزين — الحالة شخصية وتتغير.
 */
export function TrackDetailView({ token }: { token: string }) {
  const t = useTranslations('track');
  const tForm = useTranslations('requestForm');
  const locale = useLocale();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['track', token],
    retry: (count, caught) =>
      !(axios.isAxiosError(caught) && caught.response?.status === 404) && count < 2,
    queryFn: async () => {
      const { data: detail } = await api.get<TrackDetail>(`/track/${encodeURIComponent(token)}/`);
      return detail;
    },
  });

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16 text-muted" role="status">
        <LoaderCircle className="size-6 animate-spin" aria-hidden="true" />
      </div>
    );
  }

  if (error || !data) {
    const notFound = axios.isAxiosError(error) && error.response?.status === 404;
    return notFound ? (
      <div className="space-y-6">
        <p role="alert" className="rounded-lg border border-warning/40 bg-warning-soft p-4 text-sm">
          {t('invalidLink')}
        </p>
        <TrackBox />
      </div>
    ) : (
      <div role="alert" className="rounded-lg border border-danger/40 bg-danger-soft p-4 text-sm">
        {t('loadError')}{' '}
        <button type="button" onClick={() => refetch()} className="font-medium underline">
          {t('retry')}
        </button>
      </div>
    );
  }

  const dateFmt = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    numberingSystem: 'latn',
  });
  const dateTimeFmt = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    numberingSystem: 'latn',
  });
  const info = stageOf(data.kind, data.status, data.replies.length > 0);
  const isRequest = data.kind === 'request';
  const choice = (group: 'projectType' | 'budget' | 'timeline', key: string) =>
    key && tForm.has(`${group}.${key}`) ? tForm(`${group}.${key}`) : '';
  const title = isRequest
    ? data.service_title ||
      choice('projectType', data.project_type) ||
      data.project_type_display ||
      t('kind.request')
    : data.subject || t('kind.message');

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-surface p-5 shadow-subtle sm:p-6">
        {data.name ? (
          <p className="mb-1 text-sm text-muted">{t('greeting', { name: data.name })}</p>
        ) : null}
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-h3 font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted">
              {t('referenceLabel')}:{' '}
              <span dir="ltr" className="font-mono text-foreground">
                {data.reference_code}
              </span>
              {' · '}
              {t('sentOn', { date: dateFmt.format(new Date(data.created_at)) })}
            </p>
          </div>
          <StageBadge info={info} />
        </div>

        <StageProgress info={info} className="mb-4" />
        <StageGuide info={info} className="mb-6" />

        <h3 className="mb-1.5 text-sm font-medium text-muted">
          {isRequest ? t('yourRequest') : t('yourMessage')}
        </h3>
        <p className="whitespace-pre-line text-sm leading-relaxed">{data.body}</p>

        {isRequest && (data.budget_range || data.timeline) ? (
          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
            {data.budget_range ? (
              <div className="flex gap-1">
                <dt>{tForm('budgetLabel')}:</dt>
                <dd className="font-medium text-foreground">
                  {choice('budget', data.budget_range)}
                </dd>
              </div>
            ) : null}
            {data.timeline ? (
              <div className="flex gap-1">
                <dt>{tForm('timelineLabel')}:</dt>
                <dd className="font-medium text-foreground">{choice('timeline', data.timeline)}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </section>

      <section
        aria-labelledby="track-replies"
        className="rounded-xl border border-border bg-surface p-5 shadow-subtle sm:p-6"
      >
        <h2 id="track-replies" className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <MessageSquareText className="size-5 text-primary" aria-hidden="true" />
          {t('replies')}
        </h2>
        {data.replies.length ? (
          <ol className="space-y-4">
            {data.replies.map((reply) => (
              <li
                key={reply.id}
                className="rounded-lg border-s-4 border-primary bg-primary-soft/40 p-4"
              >
                <p className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                  <span className="font-medium text-foreground">{t('teamName')}</span>
                  <time dateTime={reply.created_at}>
                    {dateTimeFmt.format(new Date(reply.created_at))}
                  </time>
                </p>
                <p className="whitespace-pre-line text-sm leading-relaxed">{reply.body}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted">{isRequest ? t('noReplies') : t('noRepliesMessage')}</p>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border p-4 text-sm">
        <p className="text-muted">{t('askMore')}</p>
        <Link href="/contact" className={buttonClass('secondary', 'sm')}>
          {t('contact')}
        </Link>
      </div>
      <p className="text-xs text-muted">{t('keepLink')}</p>
    </div>
  );
}

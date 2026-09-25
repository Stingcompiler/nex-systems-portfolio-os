'use client';

import { Check, Info } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils/cn';

export type TrackKind = 'request' | 'message';

/**
 * مراحل الطلب كما يفهمها العميل. حالات الفريق الداخلية أدق (تمت المراجعة،
 * تم التواصل، موعد محدد…) لكنها كلها عند العميل «قيد الدراسة».
 */
const REQUEST_STAGES = ['received', 'reviewing', 'proposal', 'inProgress', 'completed'] as const;

const REQUEST_STAGE_OF: Record<string, number> = {
  new: 0,
  reviewed: 1,
  contacted: 1,
  meeting_scheduled: 1,
  proposal_sent: 2,
  accepted: 3,
  in_progress: 3,
  completed: 4,
};

const MESSAGE_STAGES = ['messageReceived', 'messageRead', 'messageReplied'] as const;

const MESSAGE_STAGE_OF: Record<string, number> = {
  new: 0,
  read: 1,
  replied: 2,
};

export interface StageInfo {
  stages: readonly string[];
  index: number;
  closed: boolean;
}

/**
 * موضع الحالة في مراحل العميل. الرسالة المؤرشفة ليست «مغلقة» عنده: إن
 * رُدّ عليها فهي «تم الرد»، وإلا «قُرئت».
 */
export function stageOf(kind: TrackKind, status: string, hasReplies = false): StageInfo {
  if (kind === 'message') {
    const index =
      status === 'archived'
        ? hasReplies
          ? 2
          : 1
        : Math.max(MESSAGE_STAGE_OF[status] ?? 0, hasReplies ? 2 : 0);
    return { stages: MESSAGE_STAGES, index, closed: false };
  }
  return {
    stages: REQUEST_STAGES,
    index: REQUEST_STAGE_OF[status] ?? 0,
    closed: status === 'rejected',
  };
}

export function StageBadge({ info }: { info: StageInfo }) {
  const t = useTranslations('track.stage');
  const done = info.index === info.stages.length - 1;
  return (
    <span
      className={cn(
        'rounded-full px-3 py-1 text-xs font-medium',
        info.closed
          ? 'bg-surface-hover text-muted'
          : done
            ? 'bg-success-soft text-success'
            : 'bg-primary-soft text-primary',
      )}
    >
      {info.closed ? t('closed') : t(info.stages[info.index])}
    </span>
  );
}

/** شريط المراحل: ما مضى مكتمل، والحالي مميز، والقادم باهت. */
export function StageProgress({ info, className }: { info: StageInfo; className?: string }) {
  const t = useTranslations('track');
  if (info.closed) return null;
  return (
    <ol
      className={cn('grid gap-1.5', className)}
      style={{
        gridTemplateColumns: `repeat(${info.stages.length}, minmax(0, 1fr))`,
      }}
      aria-label={t('progress')}
    >
      {info.stages.map((name, index) => (
        <li key={name} className="min-w-0" aria-current={index === info.index ? 'step' : undefined}>
          <span className="sr-only sm:hidden">{t(`stage.${name}`)}</span>
          <span
            className={cn(
              'block h-1.5 rounded-full',
              index <= info.index ? 'bg-primary' : 'bg-surface-hover',
            )}
            aria-hidden="true"
          />
          <span
            className={cn(
              // الهاتف: الشريط وحده — شارة الحالة تسمّي المرحلة، والتسميات تُبتر في أعمدة ضيقة
              'mt-1.5 hidden items-center gap-1 text-xs sm:flex',
              index === info.index ? 'font-medium text-foreground' : 'text-muted',
            )}
          >
            {index < info.index ? <Check className="size-3 shrink-0" aria-hidden="true" /> : null}
            <span className="truncate">{t(`stage.${name}`)}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * شرح المراحل: ما تعنيه مرحلة العميل الآن بارزًا، ثم كل المراحل بمعانيها
 * بترتيبها — ما مضى مكتمل، والحالي «أنت هنا»، والقادم باهت.
 */
export function StageGuide({ info, className }: { info: StageInfo; className?: string }) {
  const t = useTranslations('track');
  const current = info.closed ? 'closed' : info.stages[info.index];

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex gap-3 rounded-lg border border-primary/30 bg-primary-soft/50 p-4">
        <Info className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold">
            {t('currentStage')}: {t(`stage.${current}`)}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted">{t(`stageHelp.${current}`)}</p>
        </div>
      </div>

      {info.closed ? null : (
        <details className="group rounded-lg border border-border">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 text-sm font-medium">
            {t('stageGuideTitle')}
            <span
              aria-hidden="true"
              className="text-muted transition-transform group-open:rotate-180"
            >
              ⌄
            </span>
          </summary>
          <ol className="space-y-3 border-t border-border px-4 py-4">
            {info.stages.map((name, index) => {
              const done = index < info.index;
              const here = index === info.index;
              return (
                <li key={name} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold',
                      done || here
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-surface-hover text-muted',
                    )}
                  >
                    {done ? <Check className="size-3.5" /> : index + 1}
                  </span>
                  <div className={cn(!done && !here && 'opacity-70')}>
                    <p className="text-sm font-medium">
                      {t(`stage.${name}`)}
                      {here ? (
                        <span className="ms-2 rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary">
                          {t('youAreHere')}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted">
                      {t(`stageHelp.${name}`)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </details>
      )}
    </div>
  );
}

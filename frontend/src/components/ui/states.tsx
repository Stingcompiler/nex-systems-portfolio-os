import { FileQuestion, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

/**
 * [بند 10] المكوّنان نفساهما يخدمان الموقع والجدول:
 * bare يزيل الإطار والخلفية ليعملا داخل <td colSpan>.
 * [بند 14] الخلفيات من رموز soft لا من نسب شفافية.
 */
export function EmptyState({
  title,
  body,
  action,
  bare = false,
  className,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  bare?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 px-6 py-16 text-center',
        !bare && 'rounded-xl border border-dashed border-border bg-surface',
        className,
      )}
    >
      <FileQuestion className="size-6 shrink-0 text-primary" aria-hidden="true" />
      <p className="mt-1 text-base font-semibold">{title}</p>
      {body ? <p className="max-w-prose text-sm text-muted">{body}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title,
  body,
  action,
  bare = false,
  className,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  bare?: boolean;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center gap-3 px-6 py-16 text-center',
        !bare && 'rounded-xl border border-danger/30 bg-danger-soft',
        className,
      )}
    >
      <TriangleAlert className="size-6 shrink-0 text-danger" aria-hidden="true" />
      <p className="mt-1 text-base font-semibold">{title}</p>
      {body ? <p className="max-w-prose text-sm text-muted">{body}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('animate-pulse rounded bg-surface-hover', className)} />
  );
}

export function CardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-xl border border-border bg-surface p-6 shadow-subtle">
          <Skeleton className="mb-4 size-10 rounded" />
          <Skeleton className="mb-3 h-5 w-3/4" />
          <Skeleton className="mb-2 h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}

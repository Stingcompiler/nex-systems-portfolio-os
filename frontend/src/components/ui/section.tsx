import type { ReactNode } from 'react';

import { Container } from '@/components/ui/container';
import { cn } from '@/lib/utils/cn';

export function Section({
  id,
  children,
  className,
  tone = 'default',
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  tone?: 'default' | 'muted';
}) {
  return (
    <section
      id={id}
      className={cn(
        'py-16 sm:py-24',
        tone === 'muted' && 'bg-surface border-y border-border',
        className,
      )}
    >
      <Container>{children}</Container>
    </section>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
  align = 'start',
  as: Heading = 'h2',
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  align?: 'start' | 'center';
  as?: 'h1' | 'h2';
}) {
  return (
    <div
      className={cn(
        'mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
        align === 'center' && 'sm:flex-col sm:items-center sm:text-center',
      )}
    >
      <div className={cn('max-w-prose', align === 'center' && 'mx-auto')}>
        <Heading
          className={cn(
            'relative font-semibold',
            Heading === 'h1' ? 'text-h1' : 'text-h2',
            // شريط تمييز متدرّج قبل العنوان — لمسة تحريرية عصرية
            "before:absolute before:-top-5 before:h-1 before:w-10 before:rounded-full before:bg-brand before:content-['']",
            align === 'center' ? 'before:start-1/2 before:-translate-x-1/2 rtl:before:translate-x-1/2' : 'before:start-0',
          )}
        >
          {title}
        </Heading>
        {subtitle ? <p className="mt-3 text-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

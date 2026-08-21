import type { ReactNode } from 'react';

import { Container } from '@/components/ui/container';
import { Link } from '@/lib/i18n/navigation';

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="hero-surface">
      <Container className="grid min-h-[80vh] place-items-center py-16">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <Link
              href="/"
              className="mx-auto mb-4 inline-flex items-center gap-2 text-lg font-bold"
            >
              <span className="grid size-9 place-items-center rounded-lg bg-brand text-white shadow-[0_2px_12px_-2px_rgb(var(--primary)/0.6)]">
                N
              </span>
              NEXA SYSTEMS
            </Link>
            <h1 className="text-h2 font-semibold">{title}</h1>
            {subtitle ? <p className="mt-2 text-sm text-muted">{subtitle}</p> : null}
          </div>

          <div className="rounded-xl border border-border bg-surface/80 p-6 shadow-elevated backdrop-blur">
            {children}
          </div>

          {footer ? (
            <div className="mt-6 text-center text-sm text-muted">{footer}</div>
          ) : null}
        </div>
      </Container>
    </div>
  );
}

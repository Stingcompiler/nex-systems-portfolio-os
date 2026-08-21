import { getLocale } from 'next-intl/server';
import type { ReactNode } from 'react';

import { Container } from '@/components/ui/container';
import { getSiteSettings } from '@/lib/api/queries';
import { Link } from '@/lib/i18n/navigation';
import type { Locale } from '@/lib/i18n/routing';

export async function AuthShell({
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
  const settings = await getSiteSettings((await getLocale()) as Locale);
  const siteName = settings?.site_name || 'NEXA SYSTEMS';

  return (
    <div className="hero-surface">
      <Container className="grid min-h-[80vh] place-items-center py-16">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <Link
              href="/"
              className="mx-auto mb-4 inline-flex items-center gap-2 text-lg font-bold"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand text-white shadow-[0_2px_12px_-2px_rgb(var(--primary)/0.6)]">
                {siteName.charAt(0).toUpperCase()}
              </span>
              {siteName}
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

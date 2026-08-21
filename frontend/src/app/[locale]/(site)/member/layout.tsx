'use client';

import { Bookmark, LoaderCircle, LogOut, MessageSquare, Settings, User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, type ReactNode } from 'react';

import { Container } from '@/components/ui/container';
import { useMember } from '@/contexts/MemberContext';
import { Link, usePathname, useRouter } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';

const TABS = [
  { href: '/member', key: 'overview', icon: User, exact: true },
  { href: '/member/saved', key: 'saved', icon: Bookmark },
  { href: '/member/comments', key: 'comments', icon: MessageSquare },
  { href: '/member/settings', key: 'settings', icon: Settings },
];

export default function MemberLayout({ children }: { children: ReactNode }) {
  const t = useTranslations('member');
  const { member, loading, logout } = useMember();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !member) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, member, pathname, router]);

  if (loading) {
    return (
      <Container className="grid min-h-[50vh] place-items-center">
        <span role="status">
          <LoaderCircle className="size-6 animate-spin text-muted" aria-hidden="true" />
          <span className="sr-only">…</span>
        </span>
      </Container>
    );
  }

  if (!member) return null;

  async function onLogout() {
    await logout();
    router.replace('/');
  }

  return (
    <Container className="py-12">
      <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
        <aside>
          <div className="mb-4 rounded-lg border border-border bg-surface p-4">
            <p className="font-semibold">{member.full_name}</p>
            <p className="truncate text-sm text-muted" dir="ltr">{member.email}</p>
            {!member.is_email_verified ? (
              <p className="mt-2 rounded bg-warning/15 px-2 py-1 text-xs text-warning">
                {t('emailUnverified')}
              </p>
            ) : null}
          </div>

          <nav aria-label={t('menu')}>
            <ul className="flex flex-col gap-1">
              {TABS.map((tab) => {
                const active = tab.exact
                  ? pathname === tab.href
                  : pathname.startsWith(tab.href);
                return (
                  <li key={tab.href}>
                    <Link
                      href={tab.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex min-h-11 items-center gap-3 rounded px-3 text-sm transition-colors',
                        active
                          ? 'bg-primary/10 font-medium text-primary'
                          : 'text-muted hover:bg-surface-hover hover:text-foreground',
                      )}
                    >
                      <tab.icon className="size-4" aria-hidden="true" />
                      {t(`tabs.${tab.key}`)}
                    </Link>
                  </li>
                );
              })}
              <li>
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex min-h-11 w-full items-center gap-3 rounded px-3 text-sm text-muted hover:bg-surface-hover hover:text-danger"
                >
                  <LogOut className="size-4 flip-rtl" aria-hidden="true" />
                  {t('logout')}
                </button>
              </li>
            </ul>
          </nav>
        </aside>

        <div>{children}</div>
      </div>
    </Container>
  );
}

'use client';

import { useQuery } from '@tanstack/react-query';
import { Bell, ExternalLink, LogOut, Menu, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useMemo, useState } from 'react';

import { ThemeToggle } from '@/components/layout/theme-toggle';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api/client';
import { DASHBOARD_NAV } from '@/lib/constants/dashboard-nav';

/** بحث سريع يقفز إلى أقسام اللوحة — عميل بالكامل، بلا نقطة نهاية بحث. */
function DashboardSearch() {
  const { can } = useAuth();
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const items = useMemo(
    () =>
      DASHBOARD_NAV.flatMap((group) => group.items).filter(
        (item) => !item.permission || can(item.permission),
      ),
    [can],
  );

  const results = useMemo(() => {
    const term = query.trim();
    if (!term) return [];
    return items.filter((item) => item.label.includes(term)).slice(0, 8);
  }, [query, items]);

  function go(href: string) {
    setQuery('');
    setOpen(false);
    router.push(href);
  }

  return (
    <div className="relative hidden flex-1 sm:block sm:max-w-md">
      <Search
        className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted"
        aria-hidden="true"
      />
      <input
        type="search"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && results[0]) go(results[0].href);
          if (event.key === 'Escape') setOpen(false);
        }}
        placeholder="بحث في كل شيء…"
        aria-label="بحث في أقسام اللوحة"
        className="min-h-11 w-full rounded-lg border border-border bg-surface ps-9 pe-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
      />
      {open && results.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-border bg-surface shadow-card"
        >
          {results.map((item) => (
            <li key={item.href} role="option" aria-selected={false}>
              <button
                type="button"
                // mousedown يسبق blur فلا يُغلق قبل التنقّل
                onMouseDown={(event) => {
                  event.preventDefault();
                  go(item.href);
                }}
                className="flex min-h-11 w-full items-center px-3 text-start text-sm text-foreground hover:bg-surface-hover"
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const { data } = await api.get<{ unread: number }>('/notifications/unread-count/');
      return data.unread;
    },
    // استقصاء كل دقيقة — WebSocket ليس مبرَّرًا لهذا الحجم
    refetchInterval: 60_000,
  });
}

export function DashboardTopbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { data: unread = 0 } = useUnreadCount();

  async function onLogout() {
    await logout();
    router.replace('/dashboard/login');
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/90 px-4 backdrop-blur">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="فتح القائمة"
        className="inline-flex size-11 items-center justify-center rounded text-foreground hover:bg-surface-hover lg:hidden"
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>

      <DashboardSearch />

      <div className="flex items-center justify-end gap-2 ms-auto">
        <Link
          href="/ar"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden min-h-11 items-center gap-2 rounded px-3 text-sm text-muted hover:bg-surface-hover hover:text-foreground sm:inline-flex"
        >
          <ExternalLink className="size-4 flip-rtl" aria-hidden="true" />
          عرض الموقع
        </Link>

        <Link
          href="/dashboard/notifications"
          className="relative inline-flex size-11 items-center justify-center rounded text-muted hover:bg-surface-hover hover:text-foreground"
          aria-label={unread > 0 ? `الإشعارات، ${unread} غير مقروء` : 'الإشعارات'}
        >
          <Bell className="size-5" aria-hidden="true" />
          {unread > 0 ? (
            <span className="absolute end-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
              <span dir="ltr">{unread > 99 ? '99+' : unread}</span>
            </span>
          ) : null}
        </Link>

        <ThemeToggle />

        <div className="flex items-center gap-2 border-s border-border ps-2">
          <div className="hidden text-end sm:block">
            <p className="text-sm font-medium leading-tight">{user?.full_name}</p>
            <p className="text-xs text-muted">{user?.role_display}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            aria-label="تسجيل الخروج"
            title="تسجيل الخروج"
            className="inline-flex size-11 items-center justify-center rounded text-muted hover:bg-surface-hover hover:text-danger"
          >
            <LogOut className="size-5 flip-rtl" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}

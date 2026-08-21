'use client';

import {
  Ban,
  Bell,
  Boxes,
  CalendarClock,
  ChartNoAxesColumn,
  CircleHelp,
  Cpu,
  Download,
  FileText,
  Flag,
  FolderKanban,
  GraduationCap,
  History,
  Home,
  Image as ImageIcon,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Mail,
  MessageSquare,
  PenLine,
  Quote,
  Settings,
  Tags,
  UserPlus,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api/client';
import { DASHBOARD_NAV } from '@/lib/constants/dashboard-nav';
import { cn } from '@/lib/utils/cn';

interface NavActivity {
  pending_requests: number;
  unanswered_messages: number;
  pending_comments: number;
  reported_comments: number;
  follow_ups_today: unknown[];
}

/** أعداد «بحاجة انتباه» بجانب عناصر القائمة — من ملخّص اللوحة المخزَّن مؤقتًا. */
function useNavBadges(): Record<string, number> {
  const { data } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => {
      const { data } = await api.get<{ activity: NavActivity }>('/dashboard/summary/');
      return data;
    },
    staleTime: 60_000,
  });
  const a = data?.activity;
  if (!a) return {};
  return {
    '/dashboard/crm/requests': a.pending_requests,
    '/dashboard/crm/messages': a.unanswered_messages,
    '/dashboard/crm/follow-ups': a.follow_ups_today?.length ?? 0,
    '/dashboard/community/comments': a.pending_comments,
    '/dashboard/community/reports': a.reported_comments,
  };
}

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Home,
  Wrench,
  Boxes,
  FolderKanban,
  FileText,
  Cpu,
  Quote,
  ListChecks,
  CircleHelp,
  ChartNoAxesColumn,
  Download,
  GraduationCap,
  Image: ImageIcon,
  Bell,
  Settings,
  Users,
  UserPlus,
  Inbox,
  Mail,
  CalendarClock,
  PenLine,
  Tags,
  MessageSquare,
  Flag,
  Ban,
  History,
};

export function DashboardSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can } = useAuth();
  const badges = useNavBadges();

  return (
    <nav aria-label="قائمة لوحة التحكم" className="flex h-full flex-col gap-6 p-4">
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className="flex items-center gap-2 px-2 text-lg font-bold"
      >
        <span className="grid size-8 place-items-center rounded-lg bg-brand text-white shadow-[0_2px_10px_-2px_rgb(var(--primary)/0.6)]">
          N
        </span>
        NEXA
      </Link>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto">
        {DASHBOARD_NAV.map((group) => {
          // الصلاحيات تُخفي العناصر غير المتاحة — لا فائدة من رابط يعطي 403
          const items = group.items.filter(
            (item) => !item.permission || can(item.permission),
          );
          if (!items.length) return null;

          return (
            <div key={group.label || 'root'}>
              {group.label ? (
                <p className="mb-2 px-2 text-xs font-semibold text-muted">{group.label}</p>
              ) : null}
              <ul className="flex flex-col gap-0.5">
                {items.map((item) => {
                  const Icon = ICONS[item.icon] ?? LayoutDashboard;
                  const active =
                    item.href === '/dashboard'
                      ? pathname === '/dashboard'
                      : pathname.startsWith(item.href);
                  const badge = badges[item.href] ?? 0;

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'relative flex min-h-11 items-center gap-3 rounded-lg px-2.5 text-sm transition-colors',
                          // شريط تمييز جانبي عند النشاط — يتبع اتجاه اللغة
                          "before:absolute before:inset-y-2 before:start-0 before:w-0.5 before:rounded-full before:content-['']",
                          active
                            ? 'bg-primary-soft font-medium text-primary before:bg-brand'
                            : 'text-muted before:bg-transparent hover:bg-surface-hover hover:text-foreground',
                        )}
                      >
                        <Icon className="size-4 shrink-0" aria-hidden="true" />
                        <span className="flex-1 truncate">{item.label}</span>
                        {badge > 0 ? (
                          <span
                            className={cn(
                              'grid min-w-5 shrink-0 place-items-center rounded-full px-1.5 text-xs font-bold',
                              active
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-primary-soft text-primary',
                            )}
                            aria-label={`${badge} بحاجة انتباه`}
                          >
                            <span className="code-inline">{badge > 99 ? '99+' : badge}</span>
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

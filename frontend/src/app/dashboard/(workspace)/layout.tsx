'use client';

import { LoaderCircle, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { DashboardSidebar } from '@/features/dashboard/shell/sidebar';
import { DashboardTopbar } from '@/features/dashboard/shell/topbar';

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/dashboard/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, pathname, router]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center" role="status" aria-live="polite">
        <LoaderCircle className="size-6 animate-spin text-muted" aria-hidden="true" />
        <span className="sr-only">جارٍ التحميل…</span>
      </div>
    );
  }

  if (!user) return null;

  // الحماية الحقيقية في الخادم؛ هذه رسالة أوضح من 403 متكرر
  if (!user.is_dashboard_user) {
    return (
      <div className="grid min-h-dvh place-items-center px-4 text-center">
        <div>
          <ShieldAlert className="mx-auto mb-3 size-10 text-danger" aria-hidden="true" />
          <h1 className="text-h2 font-semibold">لا تملك صلاحية الدخول</h1>
          <p className="mt-2 text-muted">هذا الحساب ليس من مستخدمي لوحة التحكم.</p>
          <Link
            href="/ar"
            className="mt-6 inline-flex min-h-11 items-center rounded bg-primary px-5 font-medium text-primary-foreground"
          >
            العودة إلى الموقع
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-64 shrink-0 border-e border-border bg-surface/60 lg:block">
        <div className="sticky top-0 h-dvh">
          <DashboardSidebar />
        </div>
      </aside>

      {menuOpen ? (
        <>
          <div
            className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm lg:hidden"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="fixed inset-y-0 start-0 z-40 w-64 overflow-y-auto border-e border-border bg-surface lg:hidden">
            <DashboardSidebar onNavigate={() => setMenuOpen(false)} />
          </aside>
        </>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopbar onOpenMenu={() => setMenuOpen(true)} />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

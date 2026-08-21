'use client';

import { CircleUser, LogIn } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useMember } from '@/contexts/MemberContext';
import { Link } from '@/lib/i18n/navigation';

/**
 * زر الحساب في الترويسة.
 *
 * لا يعرض شيئًا أثناء التحميل الأولي لتفادي وميض «دخول» ثم «حسابي».
 */
export function MemberMenu() {
  const t = useTranslations('auth');
  const { member, loading } = useMember();

  if (loading) {
    return <span className="inline-block size-11" aria-hidden="true" />;
  }

  if (member) {
    return (
      <Link
        href="/member"
        aria-label={t('goToAccount')}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-hover"
      >
        <CircleUser className="size-4 text-muted" aria-hidden="true" />
        <span className="hidden sm:inline">{member.full_name.split(' ')[0]}</span>
      </Link>
    );
  }

  return (
    <Link
      href="/login"
      aria-label={t('loginButton')}
      className="flex size-9 items-center justify-center rounded-full text-muted transition-colors duration-fast hover:bg-surface-hover hover:text-foreground"
    >
      <LogIn className="size-[1.1rem] flip-rtl" aria-hidden="true" />
    </Link>
  );
}

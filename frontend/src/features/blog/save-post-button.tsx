'use client';

import { Bookmark, BookmarkCheck, LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { api } from '@/lib/api/client';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';

/**
 * زر حفظ المقال للأعضاء.
 *
 * الحفظ ميزة عضوية؛ الزائر غير المسجّل يُوجَّه للدخول بدل إظهار خطأ.
 * حالة تسجيل الدخول تُستنتج من نجاح نداء الحفظ (401 = غير مسجّل)، فلا
 * حاجة لجلب المستخدم في كل صفحة مقال عامة.
 */
export function SavePostButton({
  slug,
  initialSaved,
}: {
  slug: string;
  initialSaved: boolean;
}) {
  const t = useTranslations('blog');
  const [saved, setSaved] = useState(initialSaved);
  const [pending, setPending] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);

  async function toggle() {
    setPending(true);
    try {
      const { data } = await api.post<{ saved: boolean }>(`/posts/${slug}/save/`);
      setSaved(data.saved);
      setNeedsLogin(false);
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status;
      if (status === 401 || status === 403) {
        setNeedsLogin(true);
      }
    } finally {
      setPending(false);
    }
  }

  if (needsLogin) {
    return (
      <Link
        href="/login"
        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border px-4 text-sm text-muted hover:text-foreground"
      >
        <Bookmark className="size-4" aria-hidden="true" />
        {t('loginToSave')}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={saved}
      className={cn(
        'inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm transition-colors',
        saved
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border text-muted hover:text-foreground',
      )}
    >
      {pending ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      ) : saved ? (
        <BookmarkCheck className="size-4" aria-hidden="true" />
      ) : (
        <Bookmark className="size-4" aria-hidden="true" />
      )}
      {saved ? t('saved') : t('save')}
    </button>
  );
}

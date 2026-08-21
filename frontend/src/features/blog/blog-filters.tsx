'use client';

import { Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { usePathname, useRouter } from '@/lib/i18n/navigation';
import type { Category } from '@/lib/api/types';
import { cn } from '@/lib/utils/cn';

/**
 * بحث وفلترة المدونة.
 *
 * الحالة تعيش في معاملات المسار لا في الحالة المحلية، فتبقى الصفحة قابلة
 * للمشاركة والفهرسة، والبحث يمرّ عبر الخادم فيستفيد من التطبيع العربي.
 */
export function BlogFilters({
  categories,
  activeCategory,
  activeSearch,
}: {
  categories: Category[];
  activeCategory?: string;
  activeSearch?: string;
}) {
  const t = useTranslations('blog');
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState(activeSearch ?? '');

  // مزامنة الحقل مع تغيّر المعامل من الخارج (زر رجوع مثلًا)
  useEffect(() => {
    setSearch(activeSearch ?? '');
  }, [activeSearch]);

  function apply(next: { category?: string; search?: string }) {
    const params = new URLSearchParams();
    const category = next.category ?? activeCategory;
    const query = next.search ?? search;
    if (category) params.set('category', category);
    if (query) params.set('search', query);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="mb-8 space-y-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          apply({ search });
        }}
        role="search"
        className="relative max-w-md"
      >
        <Search
          className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted"
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchLabel')}
          className="min-h-11 w-full rounded-lg border border-border bg-surface ps-9 pe-9 text-sm focus-visible:ring-2 focus-visible:ring-ring"
        />
        {search ? (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              apply({ search: '' });
            }}
            aria-label={t('clearSearch')}
            className="absolute inset-y-0 end-2 my-auto inline-flex size-7 items-center justify-center rounded text-muted hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </form>

      {categories.length ? (
        <ul className="flex flex-wrap gap-2">
          <li>
            <button
              type="button"
              onClick={() => apply({ category: '' })}
              aria-pressed={!activeCategory}
              className={cn(
                'inline-flex min-h-10 items-center rounded-full border px-4 text-sm transition-colors',
                !activeCategory
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-surface text-muted hover:bg-surface-hover',
              )}
            >
              {t('allCategories')}
            </button>
          </li>
          {categories.map((category) => (
            <li key={category.id}>
              <button
                type="button"
                onClick={() => apply({ category: category.slug })}
                aria-pressed={activeCategory === category.slug}
                className={cn(
                  'inline-flex min-h-10 items-center rounded-full border px-4 text-sm transition-colors',
                  activeCategory === category.slug
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-surface text-muted hover:bg-surface-hover',
                )}
              >
                {category.name}
                {category.post_count > 0 ? (
                  <span className="ms-1.5 text-xs opacity-70" dir="ltr">
                    {category.post_count}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

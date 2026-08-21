'use client';

import { useQuery } from '@tanstack/react-query';
import { Bookmark, LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { api } from '@/lib/api/client';
import { Link } from '@/lib/i18n/navigation';
import type { Paginated } from '@/lib/api/types';

interface SavedItem {
  id: number;
  post: {
    slug: string;
    title: string;
    excerpt: string;
    reading_time: number;
    category: { name: string } | null;
  };
  created_at: string;
}

export default function SavedPostsPage() {
  const t = useTranslations('member');

  const { data, isLoading } = useQuery({
    queryKey: ['saved-posts'],
    queryFn: async () => {
      const { data: list } = await api.get<Paginated<SavedItem> | SavedItem[]>(
        '/posts/saved/',
      );
      return Array.isArray(list) ? list : list.results;
    },
  });

  return (
    <div>
      <h1 className="mb-6 text-h2 font-semibold">{t('tabs.saved')}</h1>

      {isLoading ? (
        <div className="grid place-items-center py-12 text-muted" role="status">
          <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
        </div>
      ) : data && data.length ? (
        <ul className="space-y-3">
          {data.map((item) => (
            <li key={item.id}>
              <Link
                href={`/blog/${item.post.slug}`}
                className="block rounded-lg border border-border bg-surface p-4 hover:border-primary/50"
              >
                {item.post.category ? (
                  <span className="text-xs text-primary">{item.post.category.name}</span>
                ) : null}
                <p className="font-medium">{item.post.title}</p>
                {item.post.excerpt ? (
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{item.post.excerpt}</p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <Bookmark className="mx-auto mb-3 size-8 text-muted" aria-hidden="true" />
          <p className="text-muted">{t('noSaved')}</p>
          <Link href="/blog" className="mt-3 inline-block text-sm text-primary hover:underline">
            {t('browseBlog')}
          </Link>
        </div>
      )}
    </div>
  );
}

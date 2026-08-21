'use client';

import { useQuery } from '@tanstack/react-query';
import { LoaderCircle, MessageSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { api } from '@/lib/api/client';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';

interface MyComment {
  id: number;
  content: string;
  status: string;
  status_display: string;
  post_title: string;
  post_slug: string;
  created_at: string;
}

const STATUS_STYLE: Record<string, string> = {
  approved: 'bg-success/15 text-success',
  pending: 'bg-warning/15 text-warning',
  rejected: 'bg-danger/10 text-danger',
  spam: 'bg-surface-hover text-muted',
};

export default function MyCommentsPage() {
  const t = useTranslations('member');

  const { data, isLoading } = useQuery({
    queryKey: ['my-comments'],
    queryFn: async () => {
      const { data: list } = await api.get<MyComment[]>('/comments/mine/');
      return list;
    },
  });

  return (
    <div>
      <h1 className="mb-6 text-h2 font-semibold">{t('tabs.comments')}</h1>

      {isLoading ? (
        <div className="grid place-items-center py-12 text-muted" role="status">
          <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
        </div>
      ) : data && data.length ? (
        <ul className="space-y-3">
          {data.map((comment) => (
            <li key={comment.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <Link
                  href={`/blog/${comment.post_slug}`}
                  className="text-sm font-medium hover:text-primary"
                >
                  {comment.post_title}
                </Link>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs',
                    STATUS_STYLE[comment.status] ?? 'bg-surface-hover text-muted',
                  )}
                >
                  {comment.status_display}
                </span>
              </div>
              <p className="text-sm text-muted">{comment.content}</p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <MessageSquare className="mx-auto mb-3 size-8 text-muted" aria-hidden="true" />
          <p className="text-muted">{t('noComments')}</p>
        </div>
      )}
    </div>
  );
}

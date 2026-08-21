import { Clock, Eye } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

import { CoverImage } from '@/components/content/media';
import { Badge, Card } from '@/components/ui/misc';
import type { PostListItem } from '@/lib/api/types';
import { Link } from '@/lib/i18n/navigation';
import type { Locale } from '@/lib/i18n/routing';
import { formatDate } from '@/lib/utils/format';

export async function PostCard({
  post,
  priority = false,
}: {
  post: PostListItem;
  priority?: boolean;
}) {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations('blog');

  return (
    <Card interactive className="relative flex h-full flex-col p-0">
      <CoverImage
        media={post.cover_image}
        alt={post.title}
        priority={priority}
        className="rounded-b-none"
      />
      <div className="flex flex-1 flex-col p-6">
        {post.category ? (
          <Badge tone="primary" className="mb-2 self-start">
            {post.category.name}
          </Badge>
        ) : null}

        <h3 className="mb-2 text-h3 font-semibold">
          <Link
            href={`/blog/${post.slug}`}
            className="after:absolute after:inset-0 focus-visible:outline-none"
          >
            {post.title}
          </Link>
        </h3>

        {post.excerpt ? (
          <p className="mb-4 flex-1 text-sm text-muted">{post.excerpt}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          {post.published_at ? (
            <time dateTime={post.published_at}>{formatDate(post.published_at, locale)}</time>
          ) : null}
          {post.reading_time ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden="true" />
              {t('readingTime', { minutes: post.reading_time })}
            </span>
          ) : null}
          {post.view_count > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Eye className="size-3.5" aria-hidden="true" />
              <span dir="ltr">{post.view_count}</span>
            </span>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

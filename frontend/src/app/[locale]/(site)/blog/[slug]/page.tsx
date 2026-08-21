import { Clock, Eye } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { CoverImage } from '@/components/content/media';
import { Container } from '@/components/ui/container';
import { Badge, Breadcrumbs, JsonLd } from '@/components/ui/misc';
import { ArticleBody } from '@/features/blog/article-body';
import { PostCard } from '@/features/blog/post-card';
import { CommentsSection } from '@/features/comments/comments-section';
import { SavePostButton } from '@/features/blog/save-post-button';
import { ShareButtons } from '@/features/blog/share-buttons';
import { ViewBeacon } from '@/features/blog/view-beacon';
import { ApiError } from '@/lib/api/server';
import { getPost, getPostSlugs, getSeoSettings, getSiteSettings } from '@/lib/api/queries';
import { Link } from '@/lib/i18n/navigation';
import { locales, type Locale } from '@/lib/i18n/routing';
import { articleFromPostJsonLd, breadcrumbJsonLd } from '@/lib/seo/json-ld';
import { absoluteUrl, buildMetadata } from '@/lib/seo/metadata';
import { formatDate } from '@/lib/utils/format';

export async function generateStaticParams() {
  const posts = await getPostSlugs();
  return locales.flatMap((locale) =>
    posts.results.map((post) => ({ locale, slug: post.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  try {
    const [post, settings, seoSettings] = await Promise.all([
      getPost(locale as Locale, slug),
      getSiteSettings(locale as Locale),
      getSeoSettings(locale as Locale),
    ]);

    return buildMetadata({
      locale: locale as Locale,
      path: `/blog/${slug}`,
      title: post.seo.title || post.title,
      description: post.seo.description,
      image: post.seo.image?.url ?? null,
      type: 'article',
      publishedTime: post.published_at,
      settings,
      seoSettings,
    });
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) {
      return { robots: { index: false, follow: false } };
    }
    throw error;
  }
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  setRequestLocale(rawLocale);
  const locale = rawLocale as Locale;

  let post;
  try {
    post = await getPost(locale, slug);
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) notFound();
    throw error;
  }

  const [t, tNav, settings] = await Promise.all([
    getTranslations('blog'),
    getTranslations('nav'),
    getSiteSettings(locale),
  ]);

  const url = absoluteUrl(`/${locale}/blog/${slug}`);

  return (
    <>
      <ViewBeacon slug={slug} />
      <JsonLd data={articleFromPostJsonLd(post, settings, locale)} />
      <JsonLd
        data={breadcrumbJsonLd(
          [
            { name: tNav('home'), path: '/' },
            { name: t('title'), path: '/blog' },
            { name: post.title, path: `/blog/${slug}` },
          ],
          locale,
        )}
      />

      <article>
        <Container className="py-12 sm:py-16">
          <Breadcrumbs
            label={tNav('breadcrumbs')}
            items={[
              { name: tNav('home'), href: '/' },
              { name: t('title'), href: '/blog' },
              { name: post.title },
            ]}
          />

          <div className="mx-auto max-w-prose">
            <header className="mb-8">
              {post.category ? (
                <Link href={`/blog?category=${post.category.slug}`}>
                  <Badge tone="primary" className="mb-3">
                    {post.category.name}
                  </Badge>
                </Link>
              ) : null}

              <h1 className="text-h1 font-semibold tracking-tight">{post.title}</h1>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                {post.author_name ? <span>{post.author_name}</span> : null}
                {post.published_at ? (
                  <time dateTime={post.published_at}>
                    {formatDate(post.published_at, locale)}
                  </time>
                ) : null}
                {post.reading_time ? (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-4" aria-hidden="true" />
                    {t('readingTime', { minutes: post.reading_time })}
                  </span>
                ) : null}
                {post.view_count > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <Eye className="size-4" aria-hidden="true" />
                    <span dir="ltr">{post.view_count}</span>
                  </span>
                ) : null}
              </div>
            </header>

            {post.cover_image ? (
              <CoverImage
                media={post.cover_image}
                alt={post.title}
                priority
                ratio="aspect-[16/9]"
                sizes="(max-width: 768px) 100vw, 72ch"
                className="mb-8 rounded-xl shadow-card"
              />
            ) : null}

            <ArticleBody content={post.content} />

            {post.tags.length ? (
              <ul className="mt-8 flex flex-wrap gap-2 border-t border-border pt-6">
                {post.tags.map((tag) => (
                  <li key={tag.id}>
                    <Link
                      href={`/blog?search=${encodeURIComponent(tag.name)}`}
                      className="inline-flex rounded-full border border-border px-3 py-1 text-xs text-muted hover:text-foreground"
                    >
                      #{tag.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
              <ShareButtons url={url} title={post.title} />
              <SavePostButton slug={slug} initialSaved={post.is_saved} />
            </div>

            <CommentsSection
              postId={post.id}
              postSlug={slug}
              allowComments={post.allow_comments}
            />
          </div>
        </Container>

        {post.related_posts.length ? (
          <section className="border-t border-border bg-surface/60 py-12 sm:py-16">
            <Container>
              <h2 className="mb-8 text-h2 font-semibold">{t('related')}</h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {post.related_posts.map((related) => (
                  <PostCard key={related.id} post={related} />
                ))}
              </div>
            </Container>
          </section>
        ) : null}
      </article>
    </>
  );
}

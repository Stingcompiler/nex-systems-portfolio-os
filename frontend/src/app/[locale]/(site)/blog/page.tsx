import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Container } from '@/components/ui/container';
import { Breadcrumbs, JsonLd } from '@/components/ui/misc';
import { EmptyState } from '@/components/ui/states';
import { BlogFilters } from '@/features/blog/blog-filters';
import { PostCard } from '@/features/blog/post-card';
import {
  getCategories,
  getPopularPosts,
  getPosts,
  getSeoSettings,
  getSiteSettings,
} from '@/lib/api/queries';
import { Link } from '@/lib/i18n/navigation';
import type { Locale } from '@/lib/i18n/routing';
import { breadcrumbJsonLd } from '@/lib/seo/json-ld';
import { absoluteUrl, buildMetadata } from '@/lib/seo/metadata';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const [t, settings, seoSettings] = await Promise.all([
    getTranslations({ locale, namespace: 'blog' }),
    getSiteSettings(locale as Locale),
    getSeoSettings(locale as Locale),
  ]);

  return buildMetadata({
    locale: locale as Locale,
    path: '/blog',
    title: t('title'),
    description: t('description'),
    settings,
    seoSettings,
  });
}

export default async function BlogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string; search?: string; page?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const filters = await searchParams;
  setRequestLocale(rawLocale);
  const locale = rawLocale as Locale;

  const [t, tNav, posts, categories, popular] = await Promise.all([
    getTranslations('blog'),
    getTranslations('nav'),
    getPosts(locale, {
      category: filters.category,
      search: filters.search,
      page_size: 12,
    }),
    getCategories(locale),
    getPopularPosts(locale),
  ]);

  const isFiltered = Boolean(filters.category || filters.search);

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Blog',
          name: t('title'),
          url: absoluteUrl(`/${locale}/blog`),
          inLanguage: locale,
        }}
      />
      <JsonLd
        data={breadcrumbJsonLd(
          [
            { name: tNav('home'), path: '/' },
            { name: t('title'), path: '/blog' },
          ],
          locale,
        )}
      />

      <Container className="py-12 sm:py-16">
        <Breadcrumbs items={[{ name: tNav('home'), href: '/' }, { name: t('title') }]} label={tNav('breadcrumbs')} />

        <header className="mb-8 max-w-prose">
          <h1 className="text-h1 font-semibold">{t('title')}</h1>
          <p className="mt-3 text-muted">{t('description')}</p>
        </header>

        <div className="grid gap-10 lg:grid-cols-[1fr_16rem]">
          <div>
            <BlogFilters
              categories={categories}
              activeCategory={filters.category}
              activeSearch={filters.search}
            />

            {posts.results.length ? (
              <div className="grid gap-6 sm:grid-cols-2">
                {posts.results.map((post, index) => (
                  <PostCard key={post.id} post={post} priority={index < 2} />
                ))}
              </div>
            ) : (
              <EmptyState
                title={isFiltered ? t('noResults') : t('empty')}
                body={isFiltered ? t('noResultsBody') : t('emptyBody')}
              />
            )}
          </div>

          {popular.length ? (
            <aside>
              <h2 className="mb-4 text-sm font-semibold text-muted">{t('popular')}</h2>
              <ul className="space-y-4">
                {popular.slice(0, 5).map((post) => (
                  <li key={post.id}>
                    <Link
                      href={`/blog/${post.slug}`}
                      className="group block text-sm font-medium hover:text-primary"
                    >
                      {post.title}
                    </Link>
                    {post.category ? (
                      <span className="text-xs text-muted">{post.category.name}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </aside>
          ) : null}
        </div>
      </Container>
    </>
  );
}

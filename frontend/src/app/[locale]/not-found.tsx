import { getTranslations } from 'next-intl/server';

import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { Link } from '@/lib/i18n/navigation';
import { MAIN_NAV } from '@/lib/constants/nav';

export default async function NotFound() {
  const [t, tNav] = await Promise.all([
    getTranslations('notFound'),
    getTranslations('nav'),
  ]);

  return (
    <Container className="flex min-h-dvh flex-col items-center justify-center py-20 text-center">
      <p className="text-display font-bold text-primary/30">404</p>
      <h1 className="mt-2 text-h1 font-semibold">{t('title')}</h1>
      <p className="mt-3 max-w-prose text-muted">{t('body')}</p>

      <p className="mt-8 text-sm font-medium text-muted">{t('suggestions')}</p>
      <ul className="mt-3 flex flex-wrap justify-center gap-2">
        {MAIN_NAV.slice(0, 5).map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="inline-flex min-h-11 items-center rounded border border-border bg-surface px-4 text-sm hover:bg-surface-hover"
            >
              {tNav(item.key)}
            </Link>
          </li>
        ))}
      </ul>

      <ButtonLink href="/" className="mt-8">
        {tNav('home')}
      </ButtonLink>
    </Container>
  );
}

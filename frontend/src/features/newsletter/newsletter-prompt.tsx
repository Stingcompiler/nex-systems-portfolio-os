'use client';

import { Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { NewsletterForm } from '@/features/newsletter/newsletter-form';

/** صندوق اشتراك مضغوط أسفل المقال. */
export function NewsletterPrompt() {
  const t = useTranslations('newsletter');
  return (
    <aside
      aria-label={t('title')}
      className="relative mt-8 rounded-lg border border-border bg-surface p-5 sm:p-6"
    >
      <p className="mb-3 flex items-center gap-2 font-semibold">
        <Mail className="size-4 text-primary" aria-hidden="true" />
        {t('blogPrompt')}
      </p>
      <NewsletterForm source="blog_post" defaultInterests={['articles']} compact />
    </aside>
  );
}

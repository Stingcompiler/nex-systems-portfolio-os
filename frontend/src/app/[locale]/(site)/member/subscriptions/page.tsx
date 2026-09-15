'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  cancelMySubscription,
  fetchMySubscription,
  updateMySubscription,
} from '@/features/newsletter/newsletter-api';
import { PreferencesForm } from '@/features/newsletter/token-views';

export default function MemberSubscriptionsPage() {
  const t = useTranslations('newsletter');
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['my-subscription'],
    queryFn: fetchMySubscription,
  });

  return (
    <div className="max-w-md">
      <h1 className="mb-2 text-h2 font-semibold">{t('preferencesTitle')}</h1>
      <p className="mb-6 text-sm text-muted">{t('memberIntro')}</p>

      <div className="rounded-lg border border-border bg-surface p-6">
        {query.isLoading || !query.data ? (
          <div className="grid place-items-center py-6 text-muted" role="status">
            <LoaderCircle className="size-6 animate-spin" aria-hidden="true" />
          </div>
        ) : (
          <PreferencesForm
            key={query.data.status}
            initial={query.data}
            onSave={async ({ language, interests }) => {
              const saved = await updateMySubscription({ language, interests });
              queryClient.setQueryData(['my-subscription'], saved);
              return saved;
            }}
            onUnsubscribe={async () => {
              await cancelMySubscription();
              queryClient.invalidateQueries({ queryKey: ['my-subscription'] });
            }}
          />
        )}
      </div>
    </div>
  );
}

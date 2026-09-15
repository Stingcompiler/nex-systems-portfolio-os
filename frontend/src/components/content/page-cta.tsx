import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/misc';

/**
 * دعوة ختامية للصفحات الداخلية — بطاقة هادئة لا لوحة العلامة الكبيرة
 * التي تختم الرئيسية، كي لا تتكرر اللوحة نفسها في كل صفحة.
 */
export async function PageCta({
  title,
  body,
  className,
}: {
  title?: string;
  body?: string;
  className?: string;
}) {
  const t = await getTranslations('pageCta');

  return (
    <Card className={className}>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-prose">
          <h2 className="text-h3 font-semibold">{title || t('title')}</h2>
          <p className="mt-2 text-sm text-muted">{body || t('body')}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          <ButtonLink href="/request-quote">
            {t('primary')}
            <ArrowLeft className="size-4 flip-rtl" aria-hidden="true" />
          </ButtonLink>
          <ButtonLink href="/contact" variant="secondary">
            {t('secondary')}
          </ButtonLink>
        </div>
      </div>
    </Card>
  );
}

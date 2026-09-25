'use client';

import axios from 'axios';
import { LoaderCircle, Search } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useState, type FormEvent } from 'react';

import { buttonClass } from '@/components/ui/button-styles';
import { fieldClass } from '@/components/ui/field';
import { api } from '@/lib/api/client';
import { Link, usePathname, useRouter } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';

interface TrackResult {
  kind: 'request' | 'message';
  reference_code: string;
  tracking_token: string;
  created_at: string;
}

/**
 * مربع «تابع طلبك»: مفتاحان من ثلاثة (رقم مرجعي، بريد، هاتف).
 *
 * نتيجة واحدة تنقل مباشرة إلى صفحة المتابعة، وأكثر (بريد + هاتف لعدة
 * طلبات) تُعرض قائمة للاختيار. `compact` للتذييل: حقلان وزر في سطر واحد
 * على الشاشات الواسعة.
 */
export function TrackBox({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations('track');
  const locale = useLocale();
  const router = useRouter();
  const id = useId();
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<TrackResult[] | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!first.trim() || !second.trim()) return;
    setPending(true);
    setError(null);
    setResults(null);
    try {
      const { data } = await api.post<TrackResult[]>('/track/', {
        first: first.trim(),
        second: second.trim(),
      });
      if (data.length === 1) {
        router.push(`/track/${data[0].tracking_token}`);
        return;
      }
      setResults(data);
    } catch (caught) {
      const response = axios.isAxiosError(caught) ? caught.response : undefined;
      const code = (response?.data as { code?: string } | undefined)?.code ?? '';
      if (response?.status === 404) setError(t('notFound'));
      else if (response?.status === 429) setError(t('tooMany'));
      else if (code === 'unrecognized' || code === 'same_kind') setError(t(`errors.${code}`));
      else setError(t('errorGeneric'));
    } finally {
      setPending(false);
    }
  }

  const dateFmt = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    numberingSystem: 'latn',
  });

  return (
    <div className={cn('rounded-xl border border-border bg-surface p-5 shadow-subtle', className)}>
      <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
        <Search className="size-5 text-primary" aria-hidden="true" />
        {t('boxTitle')}
      </h2>
      <p className="mt-1 text-sm text-muted">{t('boxHint')}</p>

      <form
        onSubmit={onSubmit}
        className={cn('mt-4 grid gap-3', compact && 'md:grid-cols-[1fr_1fr_auto] md:items-end')}
        noValidate
      >
        <div>
          <label htmlFor={`${id}-first`} className="mb-1.5 block text-sm font-medium">
            {t('firstLabel')}
          </label>
          <input
            id={`${id}-first`}
            value={first}
            onChange={(event) => setFirst(event.target.value)}
            placeholder={t('firstPlaceholder')}
            autoComplete="off"
            dir="auto"
            required
            className={fieldClass()}
          />
        </div>
        <div>
          <label htmlFor={`${id}-second`} className="mb-1.5 block text-sm font-medium">
            {t('secondLabel')}
          </label>
          <input
            id={`${id}-second`}
            value={second}
            onChange={(event) => setSecond(event.target.value)}
            placeholder={t('secondPlaceholder')}
            autoComplete="email"
            dir="auto"
            required
            className={fieldClass()}
          />
        </div>
        <button
          type="submit"
          disabled={pending || !first.trim() || !second.trim()}
          className={cn(buttonClass('primary'), 'gap-2')}
        >
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
          {pending ? t('searching') : t('submit')}
        </button>
      </form>

      <div aria-live="polite">
        {error ? (
          <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
        {results && results.length > 1 ? (
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium">{t('results')}</p>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {results.map((row) => (
                <li
                  key={row.tracking_token}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                >
                  <span className="min-w-0">
                    <span className="font-medium">{t(`kind.${row.kind}`)}</span>{' '}
                    <span dir="ltr" className="font-mono text-muted">
                      {row.reference_code}
                    </span>
                    <span className="text-muted">
                      {' '}
                      · {dateFmt.format(new Date(row.created_at))}
                    </span>
                  </span>
                  <Link
                    href={`/track/${row.tracking_token}`}
                    className="shrink-0 font-medium text-primary hover:underline"
                  >
                    {t('open')}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {compact ? null : <p className="mt-4 text-xs text-muted">{t('whyTwo')}</p>}
    </div>
  );
}

/** مربع التذييل: يختفي في صفحات المتابعة نفسها كي لا يتكرر المربع. */
export function FooterTrackBox({ className }: { className?: string }) {
  const pathname = usePathname();
  if (pathname === '/track' || pathname.startsWith('/track/')) return null;
  return <TrackBox compact className={className} />;
}

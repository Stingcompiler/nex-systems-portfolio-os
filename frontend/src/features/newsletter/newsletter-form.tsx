'use client';

import { useQuery } from '@tanstack/react-query';
import { LoaderCircle, MailCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState, type FormEvent } from 'react';

import { InterestPicker } from '@/features/newsletter/interest-picker';
import { fetchInterests, subscribe } from '@/features/newsletter/newsletter-api';
import { toApiError } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';

interface Props {
  source: 'footer' | 'home' | 'blog_post' | 'popup';
  /** اهتمامات مختارة مسبقًا (مثلًا «المقالات» أسفل مقال) */
  defaultInterests?: string[];
  /** عرض مضغوط بسطر واحد بلا اسم — للمقالات والتذييل */
  compact?: boolean;
  /** نص أبيض فوق لوحة العلامة */
  onBrand?: boolean;
  className?: string;
}

export function NewsletterForm({
  source,
  defaultInterests = [],
  compact = false,
  onBrand = false,
  className,
}: Props) {
  const t = useTranslations('newsletter');
  const locale = useLocale() as 'ar' | 'en';

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [interests, setInterests] = useState<string[]>(defaultInterests);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [website, setWebsite] = useState(''); // الحقل الخادع
  const loadedAt = useRef(Date.now());

  const interestsQuery = useQuery({
    queryKey: ['interests', locale],
    queryFn: () => fetchInterests(locale),
    staleTime: 60 * 60_000,
    enabled: !compact,
  });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await subscribe({
        email,
        name: compact ? undefined : name,
        language: locale,
        interests,
        source,
        website,
        elapsed_seconds: (Date.now() - loadedAt.current) / 1000,
      });
      setDone(true);
    } catch (err) {
      setError(toApiError(err).detail);
    } finally {
      setPending(false);
    }
  }

  const inputClass = cn(
    'min-h-11 w-full rounded border px-3 text-sm',
    onBrand
      ? 'border-white/30 bg-white/10 text-white placeholder:text-white/60 focus:border-white'
      : 'border-border bg-background',
  );
  const buttonClass = cn(
    'inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded px-5 text-sm font-medium disabled:opacity-60',
    onBrand ? 'bg-white text-primary hover:bg-white/90' : 'bg-primary text-primary-foreground',
  );

  if (done) {
    return (
      <div
        role="status"
        className={cn(
          'flex items-start gap-3 rounded-lg border p-4 text-sm',
          onBrand ? 'border-white/30 bg-white/10 text-white' : 'border-success/40 bg-success/10',
          className,
        )}
      >
        <MailCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-semibold">{t('sentTitle')}</p>
          <p className={cn('mt-1', onBrand ? 'text-white/85' : 'text-muted')}>{t('sent')}</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className={className} noValidate>
      {/* حقل خادع: مخفي بصريًا وعن قارئات الشاشة — البوتات تملؤه */}
      <div aria-hidden="true" className="absolute -start-[9999px] top-auto h-px w-px overflow-hidden">
        <label htmlFor={`website-${source}`}>Website</label>
        <input
          id={`website-${source}`}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </div>

      <div className={cn('flex gap-2', compact ? 'flex-col sm:flex-row' : 'flex-col')}>
        <div className="flex-1">
          <label htmlFor={`email-${source}`} className="sr-only">
            {t('email')}
          </label>
          <input
            id={`email-${source}`}
            type="email"
            required
            autoComplete="email"
            dir="ltr"
            placeholder={t('email')}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={cn(inputClass, 'text-start')}
          />
        </div>
        {!compact ? (
          <div className="flex-1">
            <label htmlFor={`name-${source}`} className="sr-only">
              {t('name')}
            </label>
            <input
              id={`name-${source}`}
              type="text"
              autoComplete="name"
              placeholder={t('name')}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
            />
          </div>
        ) : null}
        {compact ? (
          <button type="submit" disabled={pending || !email} className={buttonClass}>
            {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
            {t('subscribe')}
          </button>
        ) : null}
      </div>

      {!compact && interestsQuery.data?.length ? (
        <div className="mt-4">
          <InterestPicker
            interests={interestsQuery.data}
            selected={interests}
            onChange={setInterests}
            label={t('interests')}
          />
        </div>
      ) : null}

      {!compact ? (
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button type="submit" disabled={pending || !email} className={buttonClass}>
            {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
            {pending ? t('subscribing') : t('subscribe')}
          </button>
          <p className={cn('text-xs', onBrand ? 'text-white/75' : 'text-muted')}>{t('consent')}</p>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className={cn('mt-2 text-sm', onBrand ? 'text-white' : 'text-danger')}>
          {error}
        </p>
      ) : null}
    </form>
  );
}

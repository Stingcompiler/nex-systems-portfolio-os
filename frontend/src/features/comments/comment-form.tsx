'use client';

import { LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState, type FormEvent } from 'react';

import { useMember } from '@/contexts/MemberContext';
import { useCreateComment } from '@/features/comments/comments-api';
import { fieldError, toApiError, type ApiErrorPayload } from '@/lib/api/client';

export function CommentForm({
  postId,
  postSlug,
  parentId,
  onDone,
  compact = false,
}: {
  postId: number;
  postSlug: string;
  parentId?: number;
  onDone?: () => void;
  compact?: boolean;
}) {
  const t = useTranslations('comments');
  const { member } = useMember();
  const create = useCreateComment(postSlug);

  const [content, setContent] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [error, setError] = useState<ApiErrorPayload | null>(null);
  const [done, setDone] = useState(false);
  // زمن فتح النموذج — يقيس المرشّح الزمني ضد الإرسال الآلي
  const openedAt = useRef(Date.now());

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await create.mutateAsync({
        post: postId,
        parent: parentId ?? null,
        content,
        guest_name: member ? undefined : guestName,
        guest_email: member ? undefined : guestEmail,
        website,
        elapsed_seconds: (Date.now() - openedAt.current) / 1000,
      });
      setDone(true);
      setContent('');
      onDone?.();
    } catch (caught) {
      setError(toApiError(caught));
    }
  }

  if (done) {
    return (
      <div className="rounded-lg border border-success/40 bg-success/5 p-4 text-sm">
        {t('pendingReview')}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      {error && !Object.keys(error.errors).length ? (
        <div role="alert" className="rounded border border-danger/40 bg-danger/10 p-3 text-sm">
          {error.detail}
        </div>
      ) : null}

      {/* honeypot */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={website}
        onChange={(event) => setWebsite(event.target.value)}
        className="sr-only"
        aria-hidden="true"
      />

      {!member ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`cn-${parentId ?? 'root'}`} className="mb-1 block text-sm">
              {t('name')}
            </label>
            <input
              id={`cn-${parentId ?? 'root'}`}
              type="text"
              value={guestName}
              onChange={(event) => setGuestName(event.target.value)}
              className="min-h-11 w-full rounded border border-border bg-background px-3 text-sm"
            />
            {error && fieldError(error, 'guest_name') ? (
              <p className="mt-1 text-xs text-danger">{fieldError(error, 'guest_name')}</p>
            ) : null}
          </div>
          <div>
            <label htmlFor={`ce-${parentId ?? 'root'}`} className="mb-1 block text-sm">
              {t('email')}
            </label>
            <input
              id={`ce-${parentId ?? 'root'}`}
              type="email"
              dir="ltr"
              value={guestEmail}
              onChange={(event) => setGuestEmail(event.target.value)}
              className="min-h-11 w-full rounded border border-border bg-background px-3 text-start text-sm"
            />
            {error && fieldError(error, 'guest_email') ? (
              <p className="mt-1 text-xs text-danger">{fieldError(error, 'guest_email')}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div>
        {!compact ? (
          <label htmlFor={`cc-${parentId ?? 'root'}`} className="mb-1 block text-sm">
            {t('yourComment')}
          </label>
        ) : null}
        <textarea
          id={`cc-${parentId ?? 'root'}`}
          rows={compact ? 2 : 3}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={t('placeholder')}
          className="min-h-20 w-full rounded border border-border bg-background px-3 py-2 text-sm"
        />
        {error && fieldError(error, 'content') ? (
          <p className="mt-1 text-xs text-danger">{fieldError(error, 'content')}</p>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={create.isPending}
          className="inline-flex min-h-11 items-center gap-2 rounded bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {create.isPending ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          {parentId ? t('reply') : t('submit')}
        </button>
        {onDone && parentId ? (
          <button
            type="button"
            onClick={onDone}
            className="min-h-11 px-3 text-sm text-muted hover:text-foreground"
          >
            {t('cancel')}
          </button>
        ) : null}
      </div>
    </form>
  );
}

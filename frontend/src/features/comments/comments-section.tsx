'use client';

import { Flag, LoaderCircle, MessageSquare, Reply } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useToast } from '@/contexts/ToastContext';
import { CommentForm } from '@/features/comments/comment-form';
import {
  useComments,
  useReportComment,
  type Comment,
  type CommentReply,
} from '@/features/comments/comments-api';
import { toApiError } from '@/lib/api/client';
import { crmDateTime } from '@/features/dashboard/crm/shared';

export function CommentsSection({
  postId,
  postSlug,
  allowComments,
}: {
  postId: number;
  postSlug: string;
  allowComments: boolean;
}) {
  const t = useTranslations('comments');
  const { data: comments, isLoading } = useComments(postSlug);

  const count = comments?.reduce((total, c) => total + 1 + c.replies.length, 0) ?? 0;

  return (
    <section aria-labelledby="comments-heading" className="mt-12 border-t border-border pt-8">
      <h2 id="comments-heading" className="mb-6 flex items-center gap-2 text-h2 font-semibold">
        <MessageSquare className="size-6" aria-hidden="true" />
        {t('title')}
        {count > 0 ? (
          <span className="text-base font-normal text-muted" dir="ltr">
            ({count})
          </span>
        ) : null}
      </h2>

      {allowComments ? (
        <div className="mb-8 rounded-lg border border-border bg-surface p-4">
          <h3 className="mb-3 text-sm font-semibold">{t('addComment')}</h3>
          <CommentForm postId={postId} postSlug={postSlug} />
        </div>
      ) : (
        <p className="mb-8 rounded-lg border border-border bg-surface/60 p-4 text-sm text-muted">
          {t('closed')}
        </p>
      )}

      {isLoading ? (
        <div className="grid place-items-center py-8 text-muted" role="status">
          <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
        </div>
      ) : comments && comments.length ? (
        <ul className="space-y-6">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              postId={postId}
              postSlug={postSlug}
              allowComments={allowComments}
            />
          ))}
        </ul>
      ) : (
        <p className="py-6 text-center text-sm text-muted">{t('beFirst')}</p>
      )}
    </section>
  );
}

function CommentItem({
  comment,
  postId,
  postSlug,
  allowComments,
}: {
  comment: Comment;
  postId: number;
  postSlug: string;
  allowComments: boolean;
}) {
  const t = useTranslations('comments');
  const [replying, setReplying] = useState(false);

  return (
    <li>
      <CommentBody comment={comment} />

      <div className="mt-2 flex items-center gap-3 ps-1 text-xs">
        {allowComments ? (
          <button
            type="button"
            onClick={() => setReplying((value) => !value)}
            className="inline-flex items-center gap-1 text-muted hover:text-foreground"
          >
            <Reply className="size-3.5 flip-rtl" aria-hidden="true" />
            {t('reply')}
          </button>
        ) : null}
        <ReportButton commentId={comment.id} />
      </div>

      {replying ? (
        <div className="mt-3 ps-6">
          <CommentForm
            postId={postId}
            postSlug={postSlug}
            parentId={comment.id}
            compact
            onDone={() => setReplying(false)}
          />
        </div>
      ) : null}

      {comment.replies.length ? (
        <ul className="mt-4 space-y-4 border-s-2 border-border ps-4">
          {comment.replies.map((reply) => (
            <li key={reply.id}>
              <CommentBody comment={reply} />
              <div className="mt-1 flex items-center gap-3 ps-1 text-xs">
                <ReportButton commentId={reply.id} />
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function CommentBody({ comment }: { comment: CommentReply }) {
  const t = useTranslations('comments');
  return (
    <div className="rounded-lg bg-surface/60 p-4">
      <div className="mb-1 flex items-center gap-2">
        <span className="font-medium">{comment.author_name}</span>
        {comment.is_mine ? (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
            {t('you')}
          </span>
        ) : null}
        <time className="text-xs text-muted">{crmDateTime(comment.created_at)}</time>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{comment.content}</p>
    </div>
  );
}

function ReportButton({ commentId }: { commentId: number }) {
  const t = useTranslations('comments');
  const toast = useToast();
  const report = useReportComment();
  const [open, setOpen] = useState(false);

  async function submit(reason: string) {
    try {
      await report.mutateAsync({ comment: commentId, reason });
      toast.success(t('reportThanks'));
    } catch (error) {
      toast.error(toApiError(error).detail);
    } finally {
      setOpen(false);
    }
  }

  return (
    <span className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1 text-muted hover:text-danger"
      >
        <Flag className="size-3.5" aria-hidden="true" />
        {t('report')}
      </button>
      {open ? (
        <span className="absolute bottom-full start-0 z-10 mb-1 flex w-40 flex-col rounded-lg border border-border bg-surface p-1 shadow-card">
          {['spam', 'offensive', 'off_topic'].map((reason) => (
            <button
              key={reason}
              type="button"
              onClick={() => submit(reason)}
              className="rounded px-3 py-1.5 text-start text-xs hover:bg-surface-hover"
            >
              {t(`reason.${reason}`)}
            </button>
          ))}
        </span>
      ) : null}
    </span>
  );
}

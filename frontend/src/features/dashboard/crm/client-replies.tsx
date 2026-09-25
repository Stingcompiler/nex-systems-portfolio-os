"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, LoaderCircle, Send } from "lucide-react";
import { useState, type FormEvent } from "react";

import { useToast } from "@/contexts/ToastContext";
import { crmDateTime } from "@/features/dashboard/crm/shared";
import { api, toApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";

export interface ClientReply {
  id: number;
  body: string;
  author_name: string;
  created_at: string;
}

/**
 * الرد على صاحب الطلب أو الرسالة.
 *
 * خلاف الملاحظات الداخلية، الرد يظهر للعميل في صفحة متابعته ويُرسل إلى
 * بريده إن وُجد. من أرسل بالهاتف وحده يصله الرابط عبر واتساب: زر النسخ
 * يضع رابط صفحة المتابعة في الحافظة.
 */
export function ClientReplies({
  endpoint,
  replies,
  trackingToken,
  language,
  hasEmail,
  invalidate,
  className,
}: {
  /** مسار السجل في الـ API، مثل `/project-requests/5` */
  endpoint: string;
  replies: ClientReply[];
  trackingToken: string | null;
  language: string;
  hasEmail: boolean;
  /** مفاتيح الاستعلامات التي تُحدَّث بعد الإرسال */
  invalidate: unknown[][];
  className?: string;
}) {
  const [body, setBody] = useState("");
  const queryClient = useQueryClient();
  const toast = useToast();
  const lang = language === "en" ? "en" : "ar";
  const trackPath = trackingToken ? `/${lang}/track/${trackingToken}` : "";

  const send = useMutation({
    mutationFn: (text: string) =>
      api.post(`${endpoint}/replies/`, { body: text }),
    onSuccess: () => {
      setBody("");
      invalidate.forEach((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      );
      toast.success(
        hasEmail
          ? "أُرسل الرد وسيصل بريد العميل"
          : "حُفظ الرد في صفحة المتابعة",
      );
    },
    onError: (caught) => toast.error(toApiError(caught).detail),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (body.trim().length >= 2 && !send.isPending) send.mutate(body.trim());
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${trackPath}`,
      );
      toast.success("نُسخ رابط المتابعة");
    } catch {
      toast.error("تعذّر النسخ");
    }
  }

  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-surface p-5 shadow-subtle",
        className,
      )}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">الرد على العميل</h2>
        {trackPath ? (
          <div className="flex items-center gap-1">
            <a
              href={trackPath}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs text-muted hover:bg-surface-hover hover:text-foreground"
            >
              <ExternalLink className="size-3.5" aria-hidden="true" />
              صفحة المتابعة
            </a>
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs text-muted hover:bg-surface-hover hover:text-foreground"
            >
              <Copy className="size-3.5" aria-hidden="true" />
              نسخ الرابط
            </button>
          </div>
        ) : null}
      </div>

      {replies.length ? (
        <ol className="mb-4 space-y-3">
          {replies.map((reply) => (
            <li
              key={reply.id}
              className="rounded-lg border-s-4 border-primary bg-primary-soft/40 p-3"
            >
              <p className="mb-1 flex flex-wrap justify-between gap-2 text-xs text-muted">
                <span>{reply.author_name || "الفريق"}</span>
                <time dateTime={reply.created_at}>
                  {crmDateTime(reply.created_at)}
                </time>
              </p>
              <p className="whitespace-pre-line text-sm">{reply.body}</p>
            </li>
          ))}
        </ol>
      ) : null}

      <form onSubmit={onSubmit} className="flex flex-col gap-2">
        <label htmlFor={`reply-${endpoint}`} className="sr-only">
          نص الرد
        </label>
        <textarea
          id={`reply-${endpoint}`}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={4}
          placeholder="اكتب ردًّا يراه العميل في صفحة متابعة طلبه…"
          className="min-h-28 w-full rounded-lg border border-border-strong bg-background p-3 text-sm leading-relaxed"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted">
            {hasEmail
              ? "يظهر في صفحة المتابعة ويُرسل إلى بريد العميل."
              : "لا بريد لهذا العميل: يظهر الرد في صفحة المتابعة فقط — أرسل له الرابط عبر واتساب."}
          </p>
          <button
            type="submit"
            disabled={body.trim().length < 2 || send.isPending}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {send.isPending ? (
              <LoaderCircle
                className="size-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Send className="size-4 flip-rtl" aria-hidden="true" />
            )}
            إرسال الرد
          </button>
        </div>
      </form>
    </section>
  );
}

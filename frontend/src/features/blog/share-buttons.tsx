'use client';

import { Check, Link2, Share2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

/**
 * أزرار المشاركة.
 *
 * تستخدم Web Share API الأصلية على الأجهزة الداعمة (أغلب الهواتف)، وإلا
 * تسقط إلى نسخ الرابط. لا سكربتات خارجية ولا أزرار تتبّع من منصات التواصل.
 */
export function ShareButtons({ url, title }: { url: string; title: string }) {
  const t = useTranslations('blog');
  const [copied, setCopied] = useState(false);
  const canNativeShare = typeof navigator !== 'undefined' && 'share' in navigator;

  async function share() {
    if (canNativeShare) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* ألغى المستخدم — نسقط إلى النسخ */
      }
    }
    await copy();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* الحافظة غير متاحة — نتجاهل بهدوء */
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted">{t('share')}:</span>
      <button
        type="button"
        onClick={share}
        aria-label={t('share')}
        className="inline-flex size-10 items-center justify-center rounded-full border border-border text-muted hover:bg-surface-hover hover:text-foreground"
      >
        <Share2 className="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={copy}
        aria-label={t('copyLink')}
        className="inline-flex size-10 items-center justify-center rounded-full border border-border text-muted hover:bg-surface-hover hover:text-foreground"
      >
        {copied ? (
          <Check className="size-4 text-success" aria-hidden="true" />
        ) : (
          <Link2 className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

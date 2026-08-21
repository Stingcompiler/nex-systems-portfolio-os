import type { Locale } from '@/lib/i18n/routing';

/**
 * التواريخ والأرقام بالأرقام اللاتينية في اللغتين.
 * الأرقام الهندية أقل وضوحًا للجمهور المختلط وللأسعار والمعرّفات.
 */
const NUMBERING = { numberingSystem: 'latn' } as const;

export function formatDate(value: string | null | undefined, locale: Locale): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...NUMBERING,
  }).format(date);
}

export function formatMonthYear(value: string | null | undefined, locale: Locale): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    ...NUMBERING,
  }).format(date);
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar' : 'en', NUMBERING).format(value);
}

export function formatPrice(
  amount: string | number | null | undefined,
  currency: string,
  locale: Locale,
): string {
  if (amount === null || amount === undefined || amount === '') return '';
  const numeric = typeof amount === 'string' ? Number(amount) : amount;
  if (Number.isNaN(numeric)) return '';
  try {
    return new Intl.NumberFormat(locale === 'ar' ? 'ar' : 'en', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0,
      ...NUMBERING,
    }).format(numeric);
  } catch {
    return `${numeric} ${currency}`;
  }
}

/**
 * يحوّل نصًا بفقرات مفصولة بسطرين إلى مصفوفة فقرات.
 * محتوى قاعدة البيانات نص عادي، فلا يُحقن كـ HTML إطلاقًا.
 */
export function toParagraphs(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

/** رابط واتساب برسالة مُعبّأة مسبقًا حسب السياق. */
export function whatsappLink(number: string, message: string): string {
  const digits = (number || '').replace(/\D/g, '');
  if (!digits) return '';
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${digits}${text}`;
}

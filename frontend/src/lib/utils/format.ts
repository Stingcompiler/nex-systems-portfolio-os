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

/**
 * يحوّل رقم الهاتف المخزّن إلى صيغة دولية قابلة للاتصال (`+249902929451`).
 * الأرقام المحلية السودانية (09xxxxxxxx) تُقرأ كثيرًا في الإعدادات بلا مفتاح
 * الدولة، فيُضاف لها؛ وأي رقم يبدأ بـ00 يُحوَّل إلى +.
 */
export function toE164(number: string | null | undefined, defaultCountryCode = '249'): string {
  const raw = (number || '').trim();
  if (!raw) return '';
  if (raw.startsWith('+')) return `+${raw.slice(1).replace(/\D/g, '')}`;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (digits.startsWith('0')) return `+${defaultCountryCode}${digits.slice(1)}`;
  return `+${digits}`;
}

/** صيغة عرض مجمّعة: `+249902929451` → `+249 90 292 9451`. */
export function formatPhone(number: string | null | undefined): string {
  const e164 = toE164(number);
  if (!e164) return '';
  const match = e164.match(/^\+(\d{1,3})(\d{2})(\d{3})(\d+)$/);
  if (!match) return e164;
  const [, country, a, b, rest] = match;
  return `+${country} ${a} ${b} ${rest}`;
}

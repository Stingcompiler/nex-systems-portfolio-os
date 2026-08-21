/** قوائم وألوان مشتركة لشاشات إدارة العملاء. */

export const LEAD_STATUSES = [
  { value: 'new', label: 'جديد', tone: 'blue' },
  { value: 'contacted', label: 'تم التواصل', tone: 'cyan' },
  { value: 'waiting', label: 'بانتظار الرد', tone: 'amber' },
  { value: 'negotiating', label: 'تفاوض', tone: 'amber' },
  { value: 'proposal_sent', label: 'أُرسل العرض', tone: 'violet' },
  { value: 'accepted', label: 'مقبول', tone: 'green' },
  { value: 'in_progress', label: 'قيد التنفيذ', tone: 'green' },
  { value: 'completed', label: 'مكتمل', tone: 'gray' },
  { value: 'long_term', label: 'عميل دائم', tone: 'green' },
  { value: 'rejected', label: 'مرفوض', tone: 'red' },
  { value: 'archived', label: 'مؤرشف', tone: 'gray' },
] as const;

export const REQUEST_STATUSES = [
  { value: 'new', label: 'جديد' },
  { value: 'reviewed', label: 'تمت المراجعة' },
  { value: 'contacted', label: 'تم التواصل' },
  { value: 'meeting_scheduled', label: 'موعد محدد' },
  { value: 'proposal_sent', label: 'أُرسل العرض' },
  { value: 'accepted', label: 'مقبول' },
  { value: 'in_progress', label: 'قيد التنفيذ' },
  { value: 'completed', label: 'مكتمل' },
  { value: 'rejected', label: 'مرفوض' },
];

export const CONTACT_STATUSES = [
  { value: 'new', label: 'جديدة' },
  { value: 'read', label: 'مقروءة' },
  { value: 'replied', label: 'تم الرد' },
  { value: 'archived', label: 'مؤرشفة' },
];

export const PRIORITIES = [
  { value: 'low', label: 'منخفضة' },
  { value: 'medium', label: 'متوسطة' },
  { value: 'high', label: 'عالية' },
  { value: 'urgent', label: 'عاجلة' },
];

export const INTERACTION_TYPES = [
  { value: 'call', label: 'مكالمة' },
  { value: 'whatsapp', label: 'واتساب' },
  { value: 'email', label: 'بريد' },
  { value: 'meeting', label: 'اجتماع' },
  { value: 'other', label: 'أخرى' },
];

const TONE_CLASSES: Record<string, string> = {
  blue: 'bg-primary/10 text-primary',
  cyan: 'bg-accent/10 text-accent',
  amber: 'bg-warning/15 text-warning',
  violet: 'bg-primary/10 text-primary',
  green: 'bg-success/15 text-success',
  red: 'bg-danger/10 text-danger',
  gray: 'bg-surface-hover text-muted',
};

export function statusTone(status: string): string {
  const entry = LEAD_STATUSES.find((item) => item.value === status);
  return TONE_CLASSES[entry?.tone ?? 'gray'] ?? TONE_CLASSES.gray;
}

export function statusLabel(status: string): string {
  return LEAD_STATUSES.find((item) => item.value === status)?.label ?? status;
}

export function crmDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('ar', {
    dateStyle: 'medium',
    numberingSystem: 'latn',
  }).format(new Date(iso));
}

export function crmDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('ar', {
    dateStyle: 'short',
    timeStyle: 'short',
    numberingSystem: 'latn',
  }).format(new Date(iso));
}

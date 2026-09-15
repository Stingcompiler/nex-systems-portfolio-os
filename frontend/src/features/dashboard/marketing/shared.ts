/** قوائم وألوان وأنواع مشتركة لشاشات التسويق. */

export const SUBSCRIBER_STATUSES = [
  { value: 'active', label: 'نشط', tone: 'green' },
  { value: 'pending', label: 'بانتظار التأكيد', tone: 'amber' },
  { value: 'unsubscribed', label: 'ألغى الاشتراك', tone: 'gray' },
  { value: 'bounced', label: 'مرتد', tone: 'red' },
  { value: 'complained', label: 'اشتكى', tone: 'red' },
] as const;

export const CAMPAIGN_STATUSES = [
  { value: 'draft', label: 'مسودة', tone: 'gray' },
  { value: 'scheduled', label: 'مجدولة', tone: 'amber' },
  { value: 'sending', label: 'قيد الإرسال', tone: 'blue' },
  { value: 'sent', label: 'أُرسلت', tone: 'green' },
  { value: 'failed', label: 'فشلت', tone: 'red' },
  { value: 'cancelled', label: 'أُلغيت', tone: 'gray' },
] as const;

export const TARGET_LANGUAGES = [
  { value: 'all', label: 'كل اللغات' },
  { value: 'ar', label: 'العربية فقط' },
  { value: 'en', label: 'الإنجليزية فقط' },
];

const TONE_CLASSES: Record<string, string> = {
  blue: 'bg-primary/10 text-primary',
  amber: 'bg-warning/15 text-warning',
  green: 'bg-success/15 text-success',
  red: 'bg-danger/10 text-danger',
  gray: 'bg-surface-hover text-muted',
};

export function toneClass(list: readonly { value: string; tone: string }[], value: string) {
  const entry = list.find((item) => item.value === value);
  return TONE_CLASSES[entry?.tone ?? 'gray'] ?? TONE_CLASSES.gray;
}

export interface InterestOption {
  id: number;
  key: string;
  name: string;
  description: string;
}

export interface SubscriberRow {
  id: number;
  email: string;
  name: string;
  language: 'ar' | 'en';
  interests: string[];
  interest_names: string[];
  status: string;
  status_display: string;
  source: string;
  source_display: string;
  confirmed_at: string | null;
  created_at: string;
}

export interface SubscriberStats {
  total: number;
  active: number;
  pending: number;
  unsubscribed: number;
  bounced: number;
  confirmed_last_30_days: number;
  growth: { day: string; n: number }[];
  by_interest: { key: string; name_ar: string; n: number }[];
}

export interface Campaign {
  id: number;
  name: string;
  subject_ar: string;
  subject_en: string;
  content_ar: string;
  content_en: string;
  image: number | null;
  cta_label_ar: string;
  cta_label_en: string;
  cta_url: string;
  template: number | null;
  target_language: 'ar' | 'en' | 'all';
  target_interests: number[];
  status: string;
  status_display: string;
  scheduled_at: string | null;
  started_at: string | null;
  sent_at: string | null;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  open_count: number;
  click_count: number;
  unsubscribe_count: number;
  source_model: string;
  source_id: number | null;
  created_at: string;
}

export type CampaignListItem = Pick<
  Campaign,
  | 'id' | 'name' | 'subject_ar' | 'subject_en' | 'status' | 'status_display'
  | 'target_language' | 'scheduled_at' | 'sent_at' | 'total_recipients'
  | 'sent_count' | 'failed_count' | 'open_count' | 'click_count'
  | 'unsubscribe_count' | 'created_at'
>;

export interface CampaignStats {
  status: string;
  total_recipients: number;
  pending: number;
  sent: number;
  failed: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
  open_rate: number;
  click_rate: number;
  started_at: string | null;
  sent_at: string | null;
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('ar', {
    dateStyle: 'medium',
    timeStyle: 'short',
    numberingSystem: 'latn',
  }).format(new Date(iso));
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('ar', { dateStyle: 'medium', numberingSystem: 'latn' }).format(
    new Date(iso),
  );
}

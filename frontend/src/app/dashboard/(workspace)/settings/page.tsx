'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, Save } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useToast } from '@/contexts/ToastContext';
import { ResourceField, type FormValues } from '@/features/dashboard/resource/fields';
import type { FieldConfig } from '@/features/dashboard/resource/types';
import { api, toApiError } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';

const TABS = [
  { key: 'identity', label: 'الهوية' },
  { key: 'owner', label: 'المطوّر' },
  { key: 'contact', label: 'التواصل' },
  { key: 'seo', label: 'SEO' },
  { key: 'operation', label: 'التشغيل' },
] as const;

const FIELDS: (FieldConfig & { tab: string; endpoint?: 'settings' | 'seo' })[] = [
  { name: 'site_name', label: 'اسم الموقع', type: 'bilingual-text', tab: 'identity' },
  { name: 'tagline', label: 'الشعار النصي', type: 'bilingual-text', tab: 'identity' },
  { name: 'logo_light', label: 'الشعار (وضع فاتح)', type: 'media', tab: 'identity' },
  { name: 'logo_dark', label: 'الشعار (وضع داكن)', type: 'media', tab: 'identity' },
  { name: 'favicon', label: 'أيقونة الموقع', type: 'media', tab: 'identity' },

  { name: 'owner_name', label: 'اسم المطوّر', type: 'bilingual-text', tab: 'owner' },
  { name: 'owner_title', label: 'المسمى المهني', type: 'bilingual-text', tab: 'owner' },
  { name: 'owner_bio', label: 'النبذة', type: 'bilingual-textarea', tab: 'owner',
    help: 'قسم «نبذة» في الرئيسية مخفي حتى تُملأ.' },
  { name: 'owner_photo', label: 'الصورة الشخصية', type: 'media', tab: 'owner' },
  { name: 'cv_ar', label: 'السيرة الذاتية (عربي)', type: 'media', tab: 'owner' },
  { name: 'cv_en', label: 'السيرة الذاتية (إنجليزي)', type: 'media', tab: 'owner' },

  { name: 'email', label: 'البريد', type: 'email', tab: 'contact' },
  { name: 'phone', label: 'الهاتف', type: 'text', tab: 'contact' },
  { name: 'whatsapp', label: 'رقم واتساب', type: 'text', tab: 'contact',
    help: 'زر واتساب العائم لا يظهر بدون الرقم.' },
  { name: 'whatsapp_default_message', label: 'رسالة واتساب الافتراضية',
    type: 'bilingual-text', tab: 'contact' },
  { name: 'address', label: 'العنوان', type: 'bilingual-text', tab: 'contact' },
  { name: 'city', label: 'المدينة', type: 'text', tab: 'contact' },
  { name: 'country', label: 'الدولة', type: 'text', tab: 'contact' },

  { name: 'default_seo_title', label: 'عنوان SEO الافتراضي', type: 'bilingual-text',
    tab: 'seo', endpoint: 'seo' },
  { name: 'default_seo_description', label: 'وصف SEO الافتراضي',
    type: 'bilingual-textarea', tab: 'seo', endpoint: 'seo' },
  { name: 'default_og_image', label: 'صورة المشاركة الافتراضية', type: 'media',
    tab: 'seo', endpoint: 'seo' },
  { name: 'twitter_handle', label: 'حساب تويتر', type: 'text', tab: 'seo', endpoint: 'seo' },

  { name: 'default_language', label: 'اللغة الافتراضية', type: 'select', tab: 'operation',
    options: [
      { value: 'ar', label: 'العربية' },
      { value: 'en', label: 'English' },
    ] },
  { name: 'default_theme', label: 'الوضع الافتراضي', type: 'select', tab: 'operation',
    options: [
      { value: 'light', label: 'فاتح' },
      { value: 'dark', label: 'داكن' },
      { value: 'system', label: 'حسب النظام' },
    ] },
  { name: 'maintenance_mode', label: 'وضع الصيانة', type: 'switch', tab: 'operation',
    help: 'يحوّل الزوار إلى صفحة صيانة — المديرون يتصفحون طبيعيًا.' },
  { name: 'maintenance_message', label: 'رسالة الصيانة', type: 'bilingual-textarea',
    tab: 'operation' },
];

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<string>('identity');
  const [values, setValues] = useState<FormValues>({});
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const settings = useQuery({
    queryKey: ['site-settings', 'admin'],
    queryFn: async () => {
      const [general, seo] = await Promise.all([
        api.get('/settings/', { params: { full: 'true' } }),
        api.get('/settings/seo/', { params: { full: 'true' } }),
      ]);
      // الصور تُعاد ككائنات في المسلسل الإداري؛ نحتاج المعرّف فقط للحقول
      return { ...general.data, ...seo.data };
    },
  });

  useEffect(() => {
    if (settings.data) {
      const flattened: FormValues = {};
      for (const [key, value] of Object.entries(settings.data)) {
        flattened[key] =
          value && typeof value === 'object' && 'id' in value
            ? (value as { id: number }).id
            : value;
      }
      setValues(flattened);
    }
  }, [settings.data]);

  const save = useMutation({
    mutationFn: async () => {
      const general: Record<string, unknown> = {};
      const seo: Record<string, unknown> = {};

      for (const field of FIELDS) {
        const target = field.endpoint === 'seo' ? seo : general;
        const keys =
          field.type === 'bilingual-text' || field.type === 'bilingual-textarea'
            ? [`${field.name}_ar`, `${field.name}_en`]
            : [field.name];
        for (const key of keys) {
          target[key] = values[key] ?? (field.type === 'media' ? null : '');
        }
      }

      await Promise.all([
        api.patch('/settings/', general),
        api.patch('/settings/seo/', seo),
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-settings'] });
      setErrors({});
      toast.success('حُفظت الإعدادات');
    },
    onError: (error) => {
      const payload = toApiError(error);
      setErrors(payload.errors);
      toast.error(payload.detail);
    },
  });

  function setValue(key: string, value: unknown) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  const visibleFields = FIELDS.filter((field) => field.tab === activeTab);

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-h2 font-semibold">إعدادات الموقع</h1>
        <p className="mt-1 text-sm text-muted">كل ما يظهر للزائر يُدار من هنا.</p>
      </header>

      <div role="tablist" className="mb-6 flex flex-wrap gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'min-h-11 border-b-2 px-4 text-sm font-medium transition-colors',
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {settings.isLoading ? (
        <div className="grid place-items-center py-16 text-muted" role="status">
          <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
          className="max-w-3xl"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {visibleFields.map((field) => (
              <div
                key={field.name}
                className={cn(
                  ['bilingual-textarea', 'media'].includes(field.type) ? 'sm:col-span-2' : '',
                )}
              >
                <ResourceField
                  field={field}
                  values={values}
                  setValue={setValue}
                  errors={errors}
                />
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={save.isPending}
              className="inline-flex min-h-11 items-center gap-2 rounded bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {save.isPending ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="size-4" aria-hidden="true" />
              )}
              حفظ الإعدادات
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

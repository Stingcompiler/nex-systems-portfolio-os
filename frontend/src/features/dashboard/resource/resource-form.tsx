'use client';

import { LoaderCircle, Save, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import { ListSkeleton } from '@/features/dashboard/list-skeleton';
import { useToast } from '@/contexts/ToastContext';
import { FieldMarkContext, ResourceField, type FormValues } from '@/features/dashboard/resource/fields';
import type { ResourceConfig } from '@/features/dashboard/resource/types';
import {
  useResourceItem,
  useResourceMutations,
} from '@/features/dashboard/resource/use-resource';
import { toApiError } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';

/** القيم الابتدائية لنموذج إنشاء جديد، مشتقة من تعريف الحقول. */
function blankValues(config: ResourceConfig): FormValues {
  const values: FormValues = {};
  for (const field of config.fields) {
    switch (field.type) {
      case 'bilingual-text':
      case 'bilingual-textarea':
        values[`${field.name}_ar`] = '';
        values[`${field.name}_en`] = '';
        break;
      case 'switch':
        values[field.name] = false;
        break;
      case 'json-list':
      case 'media-list':
        values[field.name] = [];
        break;
      case 'relation':
        values[field.name] = field.multiple ? [] : null;
        break;
      case 'media':
        values[field.name] = null;
        break;
      default:
        values[field.name] = '';
    }
  }
  return values;
}

export function ResourceForm({
  config,
  itemId,
  open,
  onClose,
}: {
  config: ResourceConfig;
  itemId: number | string | null;
  open: boolean;
  onClose: () => void;
}) {
  const isEditing = itemId !== null && itemId !== undefined;
  const { data: item, isLoading } = useResourceItem(config, open && isEditing ? itemId : null);
  const { create, update } = useResourceMutations(config);
  const toast = useToast();

  const tabs = useMemo(
    () => config.tabs ?? [{ key: 'main', label: 'البيانات' }],
    [config.tabs],
  );
  // الحقل الذي يعرّف العنصر في القائمة (أول عمود: العنوان أو الاسم) إلزامي
  // دائمًا — عنصر بلا اسم لا يُعرف في الجدول ولا في حوار الحذف
  const fields = useMemo(() => {
    const primary = (config.columns[0]?.name ?? '').replace(/_ar$/, '');
    return config.fields.map((field) =>
      field.name === primary && field.type !== 'readonly' ? { ...field, required: true } : field,
    );
  }, [config]);
  const [activeTab, setActiveTab] = useState(tabs[0].key);
  const [values, setValues] = useState<FormValues>(() => blankValues(config));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [dirty, setDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  // إعادة التهيئة عند فتح النموذج أو وصول بيانات العنصر
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setDirty(false);
    setConfirmDiscard(false);
    setActiveTab(tabs[0].key);
    setValues(isEditing && item ? { ...blankValues(config), ...item } : blankValues(config));
  }, [open, item, isEditing, config, tabs]);

  // §15.4: الإغلاق بتغييرات غير محفوظة يطلب قرارًا بدل أن يضيّع ما كُتب
  function requestClose() {
    if (dirty) setConfirmDiscard(true);
    else onClose();
  }

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (dirty) setConfirmDiscard(true);
        else onClose();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, dirty]);

  // مغادرة الصفحة نفسها (إعادة تحميل، إغلاق التبويب) بتغييرات معلّقة
  useEffect(() => {
    if (!open || !dirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [open, dirty]);

  // أول خطأ ظاهر يُمرَّر إليه بعد الرسم (§15.3)
  useEffect(() => {
    if (!Object.keys(errors).length) return;
    bodyRef.current
      ?.querySelector('[data-field-error]')
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [errors, activeTab]);

  if (!open) return null;

  function setValue(key: string, value: unknown) {
    setDirty(true);
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  /** يرسل الحقول التي يعرّفها الإعداد فقط — لا حقول محسوبة ولا تواريخ نظام. */
  function buildPayload(): Record<string, unknown> {
    // أنواع عمودها في قاعدة البيانات يقبل NULL: الفراغ فيها يعني «بلا قيمة».
    // بقية الأنواع نصية (العمود NOT NULL مع blank=True) — بما فيها url و email
    // و select والحقول الثنائية — فيبقى الفراغ سلسلة فارغة "" لا null، وإلا
    // ردّ الخادم: "This field may not be null."
    const EMPTY_TO_NULL = new Set(['number', 'decimal', 'date', 'relation', 'media']);

    const payload: Record<string, unknown> = {};
    for (const field of config.fields) {
      if (field.type === 'readonly') continue;
      const keys =
        field.type === 'bilingual-text' || field.type === 'bilingual-textarea'
          ? [`${field.name}_ar`, `${field.name}_en`]
          : [field.name];
      for (const key of keys) {
        const value = values[key];
        // الرقم الفارغ لا يُرسل: أعمدة الأرقام هنا (الترتيب وأمثاله) NOT NULL بقيمة
        // افتراضية، فيأخذها الإنشاء ويُبقي التعديل القيمة السابقة. إرسال null
        // كان يرفض حفظ مشروع جديد بلا ترتيب (ST-02)
        if (field.type === 'number' && (value === '' || value === null || value === undefined)) continue;
        payload[key] = value === '' && EMPTY_TO_NULL.has(field.type) ? null : value;
      }
    }
    return payload;
  }

  /** الحقول الإلزامية الفارغة قبل أي طلب — رسالة تقول ما الناقص (§15.3). */
  function missingRequired(): Record<string, string[]> {
    const missing: Record<string, string[]> = {};
    for (const field of fields) {
      if (!field.required || field.type === 'readonly' || field.type === 'switch') continue;
      const key =
        field.type === 'bilingual-text' || field.type === 'bilingual-textarea'
          ? `${field.name}_ar`
          : field.name;
      const value = values[key];
      const empty =
        value === null ||
        value === undefined ||
        (typeof value === 'string' && !value.trim()) ||
        (Array.isArray(value) && !value.length);
      if (empty) missing[key] = [`اكتب ${field.label} — الحقل إلزامي.`];
    }
    return missing;
  }

  function focusTabOf(keys: string[]) {
    const failedField = fields.find((field) =>
      keys.some((key) => key === field.name || key.startsWith(`${field.name}_`)),
    );
    if (failedField?.tab) setActiveTab(failedField.tab);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const missing = missingRequired();
    if (Object.keys(missing).length) {
      setErrors(missing);
      focusTabOf(Object.keys(missing));
      return;
    }
    setErrors({});

    try {
      if (isEditing) {
        await update.mutateAsync({ id: itemId!, payload: buildPayload() });
        toast.success('حُفظت التعديلات');
      } else {
        await create.mutateAsync(buildPayload());
        toast.success(`أُضيف ${config.itemLabel ?? 'العنصر'}`);
      }
      onClose();
    } catch (caught) {
      const payload = toApiError(caught);
      setErrors(payload.errors);
      toast.error(payload.detail);

      // ينقل المستخدم إلى التبويب الذي فيه أول خطأ بدل تركه يبحث؛ ما كتبه يبقى
      focusTabOf(Object.keys(payload.errors));
    }
  }

  const saving = create.isPending || update.isPending;
  // اسم العنصر من أول عمود في الجدول (title_ar، name…) — «تعديل — الخدمات»
  // لا يقول أي خدمة تُعدَّل
  const itemName = isEditing ? String(values[config.columns[0]?.name ?? ''] ?? '').trim() : '';
  const heading = isEditing
    ? itemName
      ? `تعديل: ${itemName}`
      : `تعديل — ${config.title}`
    : `إضافة — ${config.title}`;

  const editable = fields.filter((field) => field.type !== 'readonly');
  const requiredCount = editable.filter((field) => field.required).length;
  const markMode = requiredCount * 2 > editable.length ? 'optional' : 'required';

  const visibleFields = fields.filter(
    (field) => (field.tab ?? tabs[0].key) === activeTab,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={heading}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <form
        onSubmit={onSubmit}
        noValidate
        className="flex h-dvh w-full max-w-2xl flex-col border-s border-border bg-surface shadow-card"
      >
        <div className="flex items-center gap-3 border-b border-border p-4">
          <h2 className="min-w-0 flex-1 truncate text-h3 font-semibold">{heading}</h2>
          <button
            type="button"
            onClick={requestClose}
            aria-label="إغلاق"
            className="inline-flex size-9 items-center justify-center rounded text-muted hover:bg-surface-hover"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        {tabs.length > 1 ? (
          <div role="tablist" className="flex gap-1 border-b border-border px-4">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'min-h-11 border-b-2 px-3 text-sm font-medium transition-colors',
                  activeTab === tab.key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted hover:text-foreground',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : null}

        {dirty ? (
          <div className="flex items-center gap-2 border-b border-border bg-surface-subtle px-4 py-2 text-sm text-text-secondary" role="status">
            <span className="size-2 rounded-full bg-warning" aria-hidden="true" />
            تغييرات غير محفوظة
          </div>
        ) : null}

        <div ref={bodyRef} className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <ListSkeleton />
          ) : (
            <FieldMarkContext.Provider value={markMode}>
            <div className="grid gap-4 sm:grid-cols-2">
              {visibleFields.map((field) => (
                <div
                  key={field.name}
                  className={cn(
                    field.full ||
                      ['bilingual-textarea', 'json-list', 'textarea', 'relation'].includes(
                        field.type,
                      )
                      ? 'sm:col-span-2'
                      : '',
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
            </FieldMarkContext.Provider>
          )}
        </div>

        {confirmDiscard ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-border bg-warning-soft px-4 py-3 text-sm" role="alert">
            <span className="flex-1 font-medium">ستضيع التغييرات غير المحفوظة. هل تغلق النموذج؟</span>
            <button
              type="button"
              onClick={() => setConfirmDiscard(false)}
              className="inline-flex min-h-11 items-center rounded border border-border-strong bg-surface px-4"
            >
              متابعة التحرير
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 items-center rounded px-4 font-medium text-danger hover:bg-danger-soft"
            >
              تجاهل التغييرات
            </button>
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2 border-t border-border p-4">
          <button
            type="button"
            onClick={requestClose}
            className="inline-flex min-h-11 items-center rounded border border-border px-4 text-sm hover:bg-surface-hover"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-h-11 items-center gap-2 rounded bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {saving ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="size-4" aria-hidden="true" />
            )}
            {isEditing ? 'حفظ التعديلات' : `إضافة ${config.itemLabel ?? 'العنصر'}`}
          </button>
        </div>
      </form>
    </div>
  );
}

'use client';

import { LoaderCircle, Save, X } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { useToast } from '@/contexts/ToastContext';
import { ResourceField, type FormValues } from '@/features/dashboard/resource/fields';
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
  const [activeTab, setActiveTab] = useState(tabs[0].key);
  const [values, setValues] = useState<FormValues>(() => blankValues(config));
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  // إعادة التهيئة عند فتح النموذج أو وصول بيانات العنصر
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setActiveTab(tabs[0].key);
    setValues(isEditing && item ? { ...blankValues(config), ...item } : blankValues(config));
  }, [open, item, isEditing, config, tabs]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  function setValue(key: string, value: unknown) {
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
        payload[key] = value === '' && EMPTY_TO_NULL.has(field.type) ? null : value;
      }
    }
    return payload;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setErrors({});

    try {
      if (isEditing) {
        await update.mutateAsync({ id: itemId!, payload: buildPayload() });
        toast.success('حُفظت التعديلات');
      } else {
        await create.mutateAsync(buildPayload());
        toast.success('أُضيف العنصر');
      }
      onClose();
    } catch (caught) {
      const payload = toApiError(caught);
      setErrors(payload.errors);
      toast.error(payload.detail);

      // ينقل المستخدم إلى التبويب الذي فيه أول خطأ بدل تركه يبحث
      const failedKeys = Object.keys(payload.errors);
      const failedField = config.fields.find((field) =>
        failedKeys.some((key) => key === field.name || key.startsWith(`${field.name}_`)),
      );
      if (failedField?.tab) setActiveTab(failedField.tab);
    }
  }

  const saving = create.isPending || update.isPending;
  const visibleFields = config.fields.filter(
    (field) => (field.tab ?? tabs[0].key) === activeTab,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={isEditing ? `تعديل ${config.title}` : `إضافة إلى ${config.title}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={onSubmit}
        noValidate
        className="flex h-dvh w-full max-w-2xl flex-col border-s border-border bg-surface shadow-card"
      >
        <div className="flex items-center gap-3 border-b border-border p-4">
          <h2 className="flex-1 text-h3 font-semibold">
            {isEditing ? `تعديل — ${config.title}` : `إضافة — ${config.title}`}
          </h2>
          <button
            type="button"
            onClick={onClose}
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

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="grid place-items-center py-16 text-muted">
              <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
            </div>
          ) : (
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
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border p-4">
          <button
            type="button"
            onClick={onClose}
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
            حفظ
          </button>
        </div>
      </form>
    </div>
  );
}

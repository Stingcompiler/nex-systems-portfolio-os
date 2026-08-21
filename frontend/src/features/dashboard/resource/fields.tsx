'use client';

import { useQuery } from '@tanstack/react-query';
import { GripVertical, ImageOff, Plus, Trash2, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { MediaPickerDialog, MediaThumb, type MediaItem } from '@/features/dashboard/media/media-picker';
import { useRelationOptions } from '@/features/dashboard/resource/use-resource';
import type { FieldConfig, SubField } from '@/features/dashboard/resource/types';
import { api } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';

export type FormValues = Record<string, unknown>;

interface FieldProps {
  field: FieldConfig;
  values: FormValues;
  setValue: (key: string, value: unknown) => void;
  errors: Record<string, string[]>;
}

const INPUT =
  'min-h-11 w-full rounded border border-border bg-background px-3 text-sm ' +
  'focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60';

function Wrapper({
  id,
  label,
  help,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </label>
      {children}
      {help ? <p className="mt-1 text-xs text-muted">{help}</p> : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function firstError(errors: Record<string, string[]>, ...keys: string[]) {
  for (const key of keys) {
    if (errors[key]?.length) return errors[key][0];
  }
  return undefined;
}

// --------------------------------------------------------------- ثنائي اللغة

function BilingualField({ field, values, setValue, errors, multiline }: FieldProps & { multiline: boolean }) {
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const key = `${field.name}_${lang}`;
  const id = `field-${key}`;
  const error = firstError(errors, `${field.name}_ar`, `${field.name}_en`);
  const Control = multiline ? 'textarea' : 'input';

  return (
    <Wrapper id={id} label={field.label} help={field.help} required={field.required} error={error}>
      {/* تبويبان في حقل واحد بدل شاشتين منفصلتين للغتين */}
      <div className="mb-1.5 inline-flex rounded border border-border p-0.5" role="tablist">
        {(['ar', 'en'] as const).map((code) => (
          <button
            key={code}
            type="button"
            role="tab"
            aria-selected={lang === code}
            onClick={() => setLang(code)}
            className={cn(
              'min-h-8 rounded px-3 text-xs font-medium transition-colors',
              lang === code
                ? 'bg-primary text-primary-foreground'
                : 'text-muted hover:text-foreground',
            )}
          >
            {code === 'ar' ? 'عربي' : 'English'}
          </button>
        ))}
      </div>

      <Control
        id={id}
        key={key}
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        lang={lang}
        rows={multiline ? 5 : undefined}
        value={String(values[key] ?? '')}
        placeholder={field.placeholder}
        onChange={(event: { target: { value: string } }) => setValue(key, event.target.value)}
        aria-invalid={Boolean(error)}
        className={cn(INPUT, multiline && 'min-h-28 py-2 leading-relaxed')}
      />
    </Wrapper>
  );
}

// --------------------------------------------------------------- الوسائط

function MediaField({ field, values, setValue, errors }: FieldProps) {
  const [open, setOpen] = useState(false);
  const value = values[field.name] as number | null | undefined;
  const id = `field-${field.name}`;

  const { data: media } = useQuery({
    queryKey: ['media-item', value],
    enabled: Boolean(value),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await api.get<MediaItem>(`/media/${value}/`, {
        params: { full: 'true' },
      });
      return data;
    },
  });

  return (
    <Wrapper
      id={id}
      label={field.label}
      help={field.help}
      required={field.required}
      error={firstError(errors, field.name)}
    >
      <div className="flex items-center gap-3">
        {media ? (
          <MediaThumb media={media} className="size-16 shrink-0 border border-border" />
        ) : (
          <span className="grid size-16 shrink-0 place-items-center rounded border border-dashed border-border text-muted">
            <ImageOff className="size-5" aria-hidden="true" />
          </span>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            id={id}
            onClick={() => setOpen(true)}
            className="inline-flex min-h-11 items-center rounded border border-border bg-surface px-4 text-sm hover:bg-surface-hover"
          >
            {value ? 'تغيير' : 'اختر ملفًا'}
          </button>
          {value ? (
            <button
              type="button"
              onClick={() => setValue(field.name, null)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded px-3 text-sm text-muted hover:text-danger"
            >
              <X className="size-4" aria-hidden="true" />
              إزالة
            </button>
          ) : null}
        </div>
      </div>

      <MediaPickerDialog
        open={open}
        onClose={() => setOpen(false)}
        onSelect={(item) => setValue(field.name, item.id)}
      />
    </Wrapper>
  );
}

// --------------------------------------------------------------- معرض الصور

interface GalleryItem {
  id?: number;
  image: number;
  image_detail?: MediaItem | null;
  caption_ar?: string;
  caption_en?: string;
}

/**
 * معرض صور مرتّب — الترتيب في المصفوفة هو `display_order` في الخادم.
 *
 * الحقل يرسل القائمة كاملة عند الحفظ، وغيابها يعني «لا تمسّ المعرض».
 */
function MediaListField({ field, values, setValue, errors }: FieldProps) {
  const [open, setOpen] = useState(false);
  const items = (values[field.name] as GalleryItem[]) ?? [];

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setValue(field.name, next);
  }

  function updateItem(index: number, key: keyof GalleryItem, value: unknown) {
    setValue(
      field.name,
      items.map((item, position) =>
        position === index ? { ...item, [key]: value } : item,
      ),
    );
  }

  return (
    <Wrapper
      id={`field-${field.name}`}
      label={field.label}
      help={field.help}
      error={firstError(errors, field.name)}
    >
      <div className="flex flex-col gap-3">
        {items.map((item, index) => (
          <div
            key={item.id ?? `${item.image}-${index}`}
            className="rounded border border-border bg-background p-3"
          >
            <div className="flex items-start gap-3">
              <MediaThumb
                media={item.image_detail}
                className="size-16 shrink-0 border border-border"
              />

              <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                <input
                  value={item.caption_ar ?? ''}
                  onChange={(event) => updateItem(index, 'caption_ar', event.target.value)}
                  placeholder="التعليق (عربي)"
                  className={INPUT}
                />
                <input
                  dir="ltr"
                  value={item.caption_en ?? ''}
                  onChange={(event) => updateItem(index, 'caption_en', event.target.value)}
                  placeholder="Caption (English)"
                  className={cn(INPUT, 'text-start')}
                />
              </div>

              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label="تحريك لأعلى"
                  className="rounded px-2 py-1 text-xs text-muted hover:bg-surface-hover disabled:opacity-40"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === items.length - 1}
                  aria-label="تحريك لأسفل"
                  className="rounded px-2 py-1 text-xs text-muted hover:bg-surface-hover disabled:opacity-40"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setValue(field.name, items.filter((_, position) => position !== index))
                  }
                  aria-label="حذف الصورة"
                  className="rounded px-2 py-1 text-muted hover:text-danger"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded border border-dashed border-border px-4 text-sm text-muted hover:bg-surface-hover hover:text-foreground"
        >
          <Plus className="size-4" aria-hidden="true" />
          إضافة صورة
        </button>
      </div>

      <MediaPickerDialog
        open={open}
        onClose={() => setOpen(false)}
        onSelect={(picked) =>
          setValue(field.name, [
            ...items,
            { image: picked.id, image_detail: picked, caption_ar: '', caption_en: '' },
          ])
        }
      />
    </Wrapper>
  );
}

// --------------------------------------------------------------- العلاقات

function RelationField({ field, values, setValue, errors }: FieldProps) {
  const { data: options = [], isLoading } = useRelationOptions(field.endpoint, field.labelKey);
  const id = `field-${field.name}`;

  if (field.multiple) {
    const selected = (values[field.name] as number[]) ?? [];
    return (
      <Wrapper
        id={id}
        label={field.label}
        help={field.help}
        error={firstError(errors, field.name)}
      >
        <div
          id={id}
          role="group"
          aria-label={field.label}
          className="max-h-48 overflow-y-auto rounded border border-border bg-background p-2"
        >
          {isLoading ? (
            <p className="p-2 text-sm text-muted">جارٍ التحميل…</p>
          ) : (
            options.map((option) => {
              const checked = selected.includes(Number(option.value));
              return (
                <label
                  key={option.value}
                  className="flex min-h-9 cursor-pointer items-center gap-2 rounded px-2 text-sm hover:bg-surface-hover"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setValue(
                        field.name,
                        checked
                          ? selected.filter((entry) => entry !== Number(option.value))
                          : [...selected, Number(option.value)],
                      )
                    }
                    className="size-4"
                  />
                  {option.label}
                </label>
              );
            })
          )}
        </div>
      </Wrapper>
    );
  }

  return (
    <Wrapper
      id={id}
      label={field.label}
      help={field.help}
      required={field.required}
      error={firstError(errors, field.name)}
    >
      <select
        id={id}
        value={String(values[field.name] ?? '')}
        onChange={(event) =>
          setValue(field.name, event.target.value ? Number(event.target.value) : null)
        }
        className={INPUT}
      >
        <option value="">— بلا —</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Wrapper>
  );
}

// --------------------------------------------------------------- قوائم JSON

function JsonListField({ field, values, setValue, errors }: FieldProps) {
  const items = (values[field.name] as Record<string, unknown>[]) ?? [];
  const subFields: SubField[] = field.subFields ?? [];

  function updateItem(index: number, key: string, value: unknown) {
    const next = items.map((item, position) =>
      position === index ? { ...item, [key]: value } : item,
    );
    setValue(field.name, next);
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setValue(field.name, next);
  }

  return (
    <Wrapper
      id={`field-${field.name}`}
      label={field.label}
      help={field.help}
      error={firstError(errors, field.name)}
    >
      <div className="flex flex-col gap-3">
        {items.map((item, index) => (
          <div key={index} className="rounded border border-border bg-background p-3">
            <div className="mb-2 flex items-center gap-2">
              <GripVertical className="size-4 text-muted" aria-hidden="true" />
              <span className="text-xs font-medium text-muted">
                عنصر <span dir="ltr">{index + 1}</span>
              </span>
              <div className="ms-auto flex gap-1">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label="تحريك لأعلى"
                  className="rounded px-2 py-1 text-xs text-muted hover:bg-surface-hover disabled:opacity-40"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === items.length - 1}
                  aria-label="تحريك لأسفل"
                  className="rounded px-2 py-1 text-xs text-muted hover:bg-surface-hover disabled:opacity-40"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setValue(field.name, items.filter((_, position) => position !== index))
                  }
                  aria-label="حذف العنصر"
                  className="rounded px-2 py-1 text-muted hover:text-danger"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {subFields.map((sub) => {
                const bilingual = sub.type.startsWith('bilingual');
                const multiline = sub.type.endsWith('textarea');
                const keys = bilingual ? [`${sub.name}_ar`, `${sub.name}_en`] : [sub.name];

                return keys.map((key) => {
                  const isEnglish = key.endsWith('_en');
                  const Control = multiline ? 'textarea' : 'input';
                  return (
                    <div key={key}>
                      <label
                        htmlFor={`${field.name}-${index}-${key}`}
                        className="mb-1 block text-xs text-muted"
                      >
                        {sub.label}
                        {bilingual ? (isEnglish ? ' (إنجليزي)' : ' (عربي)') : ''}
                      </label>
                      <Control
                        id={`${field.name}-${index}-${key}`}
                        dir={isEnglish ? 'ltr' : 'rtl'}
                        rows={multiline ? 3 : undefined}
                        value={String(item[key] ?? '')}
                        onChange={(event: { target: { value: string } }) =>
                          updateItem(index, key, event.target.value)
                        }
                        className={cn(INPUT, multiline && 'min-h-20 py-2')}
                      />
                    </div>
                  );
                });
              })}
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setValue(field.name, [...items, {}])}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-dashed border-border text-sm text-muted hover:border-primary hover:text-primary"
        >
          <Plus className="size-4" aria-hidden="true" />
          إضافة عنصر
        </button>
      </div>
    </Wrapper>
  );
}

// --------------------------------------------------------------- الموزّع

export function ResourceField(props: FieldProps) {
  const { field, values, setValue, errors } = props;
  const id = `field-${field.name}`;
  const error = firstError(errors, field.name);
  const value = values[field.name];

  switch (field.type) {
    case 'bilingual-text':
      return <BilingualField {...props} multiline={false} />;
    case 'bilingual-textarea':
      return <BilingualField {...props} multiline />;
    case 'media':
      return <MediaField {...props} />;
    case 'media-list':
      return <MediaListField {...props} />;
    case 'relation':
      return <RelationField {...props} />;
    case 'json-list':
      return <JsonListField {...props} />;

    case 'switch':
      return (
        <div>
          <label className="flex cursor-pointer items-center gap-3 py-2">
            <input
              id={id}
              type="checkbox"
              checked={Boolean(value)}
              onChange={(event) => setValue(field.name, event.target.checked)}
              className="size-4"
            />
            <span className="text-sm font-medium">{field.label}</span>
          </label>
          {field.help ? <p className="text-xs text-muted">{field.help}</p> : null}
          {error ? <p className="mt-1 text-sm text-danger">{error}</p> : null}
        </div>
      );

    case 'select':
      return (
        <Wrapper id={id} label={field.label} help={field.help} required={field.required} error={error}>
          <select
            id={id}
            value={String(value ?? '')}
            onChange={(event) => setValue(field.name, event.target.value)}
            className={INPUT}
          >
            <option value="">— اختر —</option>
            {(field.options ?? []).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Wrapper>
      );

    case 'textarea':
      return (
        <Wrapper id={id} label={field.label} help={field.help} required={field.required} error={error}>
          <textarea
            id={id}
            rows={4}
            value={String(value ?? '')}
            onChange={(event) => setValue(field.name, event.target.value)}
            className={cn(INPUT, 'min-h-24 py-2')}
          />
        </Wrapper>
      );

    case 'readonly':
      return (
        <Wrapper id={id} label={field.label} help={field.help}>
          <p className="min-h-11 rounded border border-border bg-surface-hover px-3 py-2.5 text-sm text-muted">
            {String(value ?? '—')}
          </p>
        </Wrapper>
      );

    default: {
      const inputType =
        field.type === 'number' || field.type === 'decimal'
          ? 'number'
          : field.type === 'date'
            ? 'date'
            : field.type === 'url'
              ? 'url'
              : field.type === 'email'
                ? 'email'
                : 'text';
      const isLatin = ['url', 'email', 'number', 'decimal', 'date'].includes(field.type);

      return (
        <Wrapper id={id} label={field.label} help={field.help} required={field.required} error={error}>
          <input
            id={id}
            type={inputType}
            dir={isLatin ? 'ltr' : undefined}
            step={field.type === 'decimal' ? '0.01' : undefined}
            min={field.min}
            max={field.max}
            placeholder={field.placeholder}
            value={String(value ?? '')}
            onChange={(event) =>
              setValue(
                field.name,
                field.type === 'number' || field.type === 'decimal'
                  ? event.target.value === ''
                    ? null
                    : Number(event.target.value)
                  : event.target.value,
              )
            }
            aria-invalid={Boolean(error)}
            className={cn(INPUT, isLatin && 'text-start')}
          />
        </Wrapper>
      );
    }
  }
}

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, GripVertical, LoaderCircle, Save } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useToast } from '@/contexts/ToastContext';
import { ResourceForm } from '@/features/dashboard/resource/resource-form';
import type { ResourceConfig } from '@/features/dashboard/resource/types';
import { api, toApiError } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';

interface Section {
  id: number;
  page: string;
  key: string;
  title_ar: string;
  title_en: string;
  subtitle_ar: string;
  subtitle_en: string;
  is_visible: boolean;
  display_order: number;
}

const SECTION_LABELS: Record<string, string> = {
  hero: 'الواجهة',
  intro: 'نبذة مختصرة',
  stats: 'الإحصائيات',
  services: 'الخدمات',
  solutions: 'الحلول حسب القطاعات',
  projects: 'المشاريع المميزة',
  case_studies: 'دراسات الحالة',
  process: 'طريقة العمل',
  technologies: 'التقنيات',
  testimonials: 'شهادات العملاء',
  posts: 'أحدث المقالات',
  newsletter: 'النشرة البريدية',
  cta: 'دعوة للتواصل',
};

/** إعداد مصغّر لإعادة استخدام نموذج المحرك في تحرير نص القسم. */
const sectionFormConfig: ResourceConfig = {
  key: 'sections',
  endpoint: '/sections/',
  title: 'قسم الصفحة الرئيسية',
  permission: 'core.change_pagesection',
  columns: [],
  canCreate: false,
  canDelete: false,
  fields: [
    { name: 'title', label: 'العنوان', type: 'bilingual-text' },
    { name: 'subtitle', label: 'الوصف', type: 'bilingual-textarea' },
    { name: 'cta_label', label: 'نص الزر', type: 'bilingual-text' },
    { name: 'cta_url', label: 'رابط الزر', type: 'text' },
    { name: 'image', label: 'الصورة', type: 'media' },
    { name: 'is_visible', label: 'ظاهر', type: 'switch' },
  ],
};

export default function HomeSectionsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['sections', 'home'],
    queryFn: async () => {
      const { data: sections } = await api.get<Section[]>('/sections/', {
        params: { page: 'home', full: 'true' },
      });
      return sections;
    },
  });

  const [order, setOrder] = useState<Section[]>([]);
  const [dirty, setDirty] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    if (data) {
      setOrder(data);
      setDirty(false);
    }
  }, [data]);

  const reorder = useMutation({
    mutationFn: async (ids: number[]) => {
      await api.post('/sections/reorder/', { order: ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      setDirty(false);
      toast.success('حُفظ الترتيب الجديد');
    },
    onError: (error) => toast.error(toApiError(error).detail),
  });

  const toggleVisible = useMutation({
    mutationFn: async (section: Section) => {
      await api.patch(`/sections/${section.id}/`, { is_visible: !section.is_visible });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sections'] }),
    onError: (error) => toast.error(toApiError(error).detail),
  });

  function move(from: number, to: number) {
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setOrder(next);
    setDirty(true);
  }

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h2 font-semibold">الصفحة الرئيسية</h1>
          <p className="mt-1 max-w-prose text-sm text-muted">
            رتّب الأقسام بالسحب أو بالأسهم، وأخفِ ما لا تريده. القسم الذي لا يملك
            محتوى يختفي من الموقع تلقائيًا حتى لو كان ظاهرًا هنا.
          </p>
        </div>

        <button
          type="button"
          disabled={!dirty || reorder.isPending}
          onClick={() => reorder.mutate(order.map((section) => section.id))}
          className="inline-flex min-h-11 items-center gap-2 rounded bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {reorder.isPending ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          حفظ الترتيب
        </button>
      </header>

      {isLoading ? (
        <div className="grid place-items-center py-16 text-muted" role="status">
          <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
        </div>
      ) : (
        <ol className="flex flex-col gap-2">
          {order.map((section, index) => (
            <li
              key={section.id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null && dragIndex !== index) move(dragIndex, index);
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
              className={cn(
                'flex items-center gap-3 rounded-lg border border-border bg-surface p-3',
                dragIndex === index && 'opacity-50',
                !section.is_visible && 'opacity-60',
              )}
            >
              <GripVertical
                className="size-4 shrink-0 cursor-grab text-muted"
                aria-hidden="true"
              />

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {SECTION_LABELS[section.key] ?? section.key}
                </p>
                <p className="truncate text-xs text-muted">
                  {section.title_ar || '— بلا عنوان —'}
                </p>
              </div>

              {/* أزرار الأسهم بديل يعمل بلوحة المفاتيح، فالسحب وحده غير متاح للجميع */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(index, index - 1)}
                  disabled={index === 0}
                  aria-label={`تحريك ${SECTION_LABELS[section.key] ?? section.key} لأعلى`}
                  className="rounded p-2 text-muted hover:bg-surface-hover disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(index, index + 1)}
                  disabled={index === order.length - 1}
                  aria-label={`تحريك ${SECTION_LABELS[section.key] ?? section.key} لأسفل`}
                  className="rounded p-2 text-muted hover:bg-surface-hover disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => toggleVisible.mutate(section)}
                  aria-label={section.is_visible ? 'إخفاء القسم' : 'إظهار القسم'}
                  title={section.is_visible ? 'إخفاء' : 'إظهار'}
                  className="rounded p-2 text-muted hover:bg-surface-hover hover:text-foreground"
                >
                  {section.is_visible ? (
                    <Eye className="size-4" aria-hidden="true" />
                  ) : (
                    <EyeOff className="size-4" aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(section.id)}
                  className="rounded border border-border px-3 py-2 text-xs hover:bg-surface-hover"
                >
                  تحرير النص
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <ResourceForm
        config={sectionFormConfig}
        itemId={editingId}
        open={editingId !== null}
        onClose={() => setEditingId(null)}
      />
    </div>
  );
}

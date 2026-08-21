'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, Search, Trash2, TriangleAlert, Upload } from 'lucide-react';
import { useRef, useState } from 'react';

import { useToast } from '@/contexts/ToastContext';
import {
  formatBytes,
  MediaThumb,
  useMediaList,
  useMediaUpload,
  type MediaItem,
} from '@/features/dashboard/media/media-picker';
import { api, toApiError } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';

const TYPE_FILTERS = [
  { value: '', label: 'كل الأنواع' },
  { value: 'image', label: 'صور' },
  { value: 'document', label: 'مستندات' },
  { value: 'archive', label: 'أرشيف' },
  { value: 'video', label: 'فيديو' },
];

export default function MediaLibraryPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState('');
  const [fileType, setFileType] = useState('');
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [confirmForce, setConfirmForce] = useState(false);

  const { data, isLoading } = useMediaList({ search, file_type: fileType });
  const upload = useMediaUpload();

  const remove = useMutation({
    mutationFn: async ({ id, force }: { id: number; force: boolean }) => {
      await api.delete(`/media/${id}/${force ? '?force=true' : ''}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      setSelected(null);
      setConfirmForce(false);
      toast.success('حُذف الملف');
    },
  });

  async function onUpload(files: FileList | null) {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      try {
        await upload.mutateAsync(file);
      } catch (error) {
        toast.error(`${file.name}: ${toApiError(error).detail}`);
      }
    }
    toast.success('اكتمل الرفع');
  }

  async function onDelete(item: MediaItem, force: boolean) {
    try {
      await remove.mutateAsync({ id: item.id, force });
    } catch (error) {
      const payload = toApiError(error);
      // 409 عند الملف المستخدم — نعرض تأكيد الحذف القسري
      if (payload.code === 'media_in_use') {
        setConfirmForce(true);
      } else {
        toast.error(payload.detail);
      }
    }
  }

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h2 font-semibold">مكتبة الوسائط</h1>
          <p className="mt-1 text-sm text-muted">الصور والملفات المستخدمة في المحتوى.</p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="sr-only"
          onChange={(event) => onUpload(event.target.files)}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={upload.isPending}
          className="inline-flex min-h-11 items-center gap-2 rounded bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {upload.isPending ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Upload className="size-4" aria-hidden="true" />
          )}
          رفع ملفات
        </button>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search
            className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ابحث بالاسم أو النص البديل"
            aria-label="بحث في الوسائط"
            className="min-h-11 w-full rounded border border-border bg-background ps-9 pe-3 text-sm"
          />
        </div>
        <select
          value={fileType}
          onChange={(event) => setFileType(event.target.value)}
          aria-label="نوع الملف"
          className="min-h-11 rounded border border-border bg-background px-3 text-sm"
        >
          {TYPE_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16 text-muted" role="status">
          <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
        </div>
      ) : data?.results.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {data.results.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setSelected(item)}
                className={cn(
                  'w-full overflow-hidden rounded-lg border bg-surface text-start transition-colors',
                  selected?.id === item.id
                    ? 'border-primary'
                    : 'border-border hover:border-primary/50',
                )}
              >
                <span className="relative block aspect-square bg-surface-hover">
                  {item.file_type === 'image' ? (
                    <MediaThumb media={item} className="size-full" />
                  ) : (
                    <span className="grid size-full place-items-center text-xs uppercase text-muted">
                      {item.file_type}
                    </span>
                  )}
                </span>
                <span className="block truncate p-2 text-xs" title={item.original_name}>
                  {item.original_name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-border py-16 text-center text-muted">
          لا توجد ملفات. ارفع أول ملف للبدء.
        </p>
      )}

      {selected ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="تفاصيل الملف"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setSelected(null);
              setConfirmForce(false);
            }
          }}
        >
          <div className="flex h-dvh w-full max-w-md flex-col border-s border-border bg-surface p-4">
            <div className="mb-4 aspect-video overflow-hidden rounded bg-surface-hover">
              {selected.file_type === 'image' ? (
                <MediaThumb media={selected} className="size-full !object-contain" />
              ) : (
                <span className="grid size-full place-items-center text-muted">
                  {selected.file_type}
                </span>
              )}
            </div>

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">الاسم</dt>
                <dd className="truncate">{selected.original_name}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">الحجم</dt>
                <dd dir="ltr">{formatBytes(selected.size)}</dd>
              </div>
              {selected.width ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">الأبعاد</dt>
                  <dd dir="ltr">
                    {selected.width}×{selected.height}
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-3">
                <dt className="text-muted">مرات الاستخدام</dt>
                <dd dir="ltr">{selected.usage_count}</dd>
              </div>
            </dl>

            <div className="mt-auto pt-4">
              {confirmForce ? (
                <div className="rounded border border-danger/30 bg-danger/5 p-3">
                  <p className="mb-3 flex items-start gap-2 text-sm">
                    <TriangleAlert
                      className="mt-0.5 size-4 shrink-0 text-danger"
                      aria-hidden="true"
                    />
                    هذا الملف مستخدم في {selected.usage_count} عنصرًا. الحذف قد يترك
                    مربعات فارغة في المحتوى المنشور.
                  </p>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmForce(false)}
                      className="inline-flex min-h-11 items-center rounded border border-border px-4 text-sm"
                    >
                      تراجع
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(selected, true)}
                      className="inline-flex min-h-11 items-center rounded bg-danger px-4 text-sm font-medium text-white"
                    >
                      حذف رغم ذلك
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onDelete(selected, false)}
                  disabled={remove.isPending}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded border border-danger/40 px-4 text-sm font-medium text-danger hover:bg-danger/10 disabled:opacity-60"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  حذف الملف
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

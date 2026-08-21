'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, LoaderCircle, Search, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useToast } from '@/contexts/ToastContext';
import { api, toApiError } from '@/lib/api/client';
import type { Paginated } from '@/lib/api/types';
import { cn } from '@/lib/utils/cn';

export interface MediaItem {
  id: number;
  url: string;
  thumbnail_url: string;
  alt: string;
  title: string;
  original_name: string;
  file_type: string;
  size: number;
  width: number | null;
  height: number | null;
  usage_count: number;
  created_at: string;
}

export function useMediaList(params: { search?: string; file_type?: string; page?: number }) {
  return useQuery({
    queryKey: ['media', params],
    queryFn: async () => {
      const { data } = await api.get<Paginated<MediaItem>>('/media/', {
        params: { ...params, full: 'true' },
      });
      return data;
    },
    placeholderData: (previous) => previous,
  });
}

export function useMediaUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post<MediaItem>('/media/upload/', form);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['media'] }),
  });
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0';
  const units = ['بايت', 'ك.ب', 'م.ب'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

/** نافذة اختيار ملف من المكتبة، مع رفع مباشر. */
export function MediaPickerDialog({
  open,
  onClose,
  onSelect,
  fileType,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (media: MediaItem) => void;
  fileType?: string;
}) {
  const [search, setSearch] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const { data, isLoading } = useMediaList({ search, file_type: fileType });
  const upload = useMediaUpload();

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  async function onFileChosen(file: File | undefined) {
    if (!file) return;
    try {
      const media = await upload.mutateAsync(file);
      toast.success('تم رفع الملف');
      onSelect(media);
      onClose();
    } catch (error) {
      toast.error(toApiError(error).detail);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="اختيار ملف"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="flex max-h-[85dvh] w-full max-w-3xl flex-col rounded-xl border border-border bg-surface shadow-card"
      >
        <div className="flex items-center gap-3 border-b border-border p-4">
          <h2 className="flex-1 text-h3 font-semibold">مكتبة الوسائط</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="inline-flex size-9 items-center justify-center rounded text-muted hover:bg-surface-hover"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-border p-4">
          <div className="relative flex-1">
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
          <input
            ref={fileInputRef}
            type="file"
            className="sr-only"
            onChange={(event) => onFileChosen(event.target.files?.[0])}
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
            رفع ملف
          </button>
        </div>

        <div className="min-h-48 flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="grid place-items-center py-12 text-muted">
              <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
            </div>
          ) : data?.results.length ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {data.results.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(item);
                      onClose();
                    }}
                    className="group w-full overflow-hidden rounded border border-border bg-background text-start transition-colors hover:border-primary"
                  >
                    <span className="relative block aspect-square bg-surface-hover">
                      {item.file_type === 'image' ? (
                        // صور المكتبة متغيرة الأبعاد ومن نفس الأصل — img عادية أنسب هنا
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.thumbnail_url || item.url}
                          alt={item.alt || item.original_name}
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      ) : (
                        <span className="grid size-full place-items-center text-xs text-muted">
                          {item.file_type}
                        </span>
                      )}
                      <span className="absolute inset-0 hidden place-items-center bg-primary/20 group-hover:grid">
                        <Check className="size-6 text-primary" aria-hidden="true" />
                      </span>
                    </span>
                    <span className="block truncate p-2 text-xs" title={item.original_name}>
                      {item.original_name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-12 text-center text-sm text-muted">
              لا توجد ملفات مطابقة. ارفع ملفًا للبدء.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** معاينة مصغّرة تُستخدم في الجداول والنماذج. */
export function MediaThumb({
  media,
  className,
}: {
  media: { thumbnail_url?: string; url?: string; alt?: string } | null | undefined;
  className?: string;
}) {
  if (!media?.url && !media?.thumbnail_url) {
    return (
      <span
        aria-hidden="true"
        className={cn('block rounded bg-surface-hover', className)}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={media.thumbnail_url || media.url}
      alt={media.alt || ''}
      loading="lazy"
      className={cn('rounded object-cover', className)}
    />
  );
}

'use client';

import {
  ChevronLeft,
  Eye,
  EyeOff,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useMemo, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { MediaThumb } from '@/features/dashboard/media/media-picker';
import { ResourceForm } from '@/features/dashboard/resource/resource-form';
import type { ColumnConfig, ResourceConfig } from '@/features/dashboard/resource/types';
import {
  identifierOf,
  useResourceList,
  useResourceMutations,
  type ResourceRow,
} from '@/features/dashboard/resource/use-resource';
import { Button, IconButton } from '@/components/ui/button';
import { Badge } from '@/components/ui/misc';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { toApiError } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';

function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function Cell({
  column,
  row,
  locale,
  t,
}: {
  column: ColumnConfig;
  row: ResourceRow;
  locale: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const value = row[column.name];

  switch (column.type) {
    // [بند 4] نبرات Badge الدلالية بدل bg-success/15 المكتوبة يدويًا
    case 'boolean':
      return (
        <Badge tone={value ? 'success' : 'default'}>{value ? t('yes') : t('no')}</Badge>
      );

    case 'badge':
      return value ? (
        <Badge tone="primary">{String(value)}</Badge>
      ) : (
        <span className="text-muted">—</span>
      );

    case 'choice':
      return <span>{column.map?.[String(value)] ?? String(value ?? '—')}</span>;

    // [تحسين] شارة ملوّنة حسب الحالة — منشور أخضر، مسودة كهرماني، مرفوض أحمر…
    case 'status': {
      if (value === null || value === undefined || value === '') {
        return <span className="text-muted">—</span>;
      }
      const key = String(value);
      return (
        <Badge tone={column.tones?.[key] ?? 'default'}>
          {column.map?.[key] ?? key}
        </Badge>
      );
    }

    // [بند 6 من دليل RTL] الأرقام والتواريخ معزولة اتجاهيًا
    case 'number':
      return <span className="code-inline">{String(value ?? 0)}</span>;

    case 'date':
      return value ? (
        <time className="code-inline text-muted" dateTime={String(value)}>
          {new Intl.DateTimeFormat(locale, {
            dateStyle: 'medium',
            numberingSystem: 'latn',
          }).format(new Date(String(value)))}
        </time>
      ) : (
        <span className="text-muted">—</span>
      );

    case 'image':
      return (
        <MediaThumb
          media={value as { url?: string; thumbnail_url?: string } | null}
          className="size-10 border border-border"
        />
      );

    default: {
      const text = value === null || value === undefined || value === '' ? '—' : String(value);
      // [بند 12] truncate بارتفاع سطر عادي — line-clamp-1 مع 1.9 يقصّ التشكيل
      return (
        <span className="truncate-line" title={text}>
          {text}
        </span>
      );
    }
  }
}

export function ResourcePage({ config }: { config: ResourceConfig }) {
  const { can } = useAuth();
  const toast = useToast();
  // [بند 8] كل نص من مساحة الترجمة dashboard — لا سلسلة عربية في الشيفرة
  const t = useTranslations('dashboard');
  const locale = useLocale();

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ResourceRow | null>(null);

  const search = useDebounced(searchInput);
  const params = useMemo(
    () => ({
      page,
      page_size: 25,
      ...(search ? { search } : {}),
      ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
    }),
    [page, search, filters],
  );

  const { data, isLoading, isError, error, refetch, isFetching } = useResourceList(config, params);
  const { remove, publish } = useResourceMutations(config);

  const editable = !config.permission || can(config.permission);
  const canCreate = editable && config.canCreate !== false;
  const rows = data?.results ?? [];
  const totalPages = data?.total_pages ?? 1;
  const searchId = useId();

  useEffect(() => {
    setPage(1);
  }, [search, filters]);

  function openCreate() {
    setEditingId(null);
    setFormOpen(true);
  }

  async function onDelete(row: ResourceRow) {
    try {
      await remove.mutateAsync(identifierOf(config, row));
      toast.success(t('toast.deleted'));
      setConfirmDelete(null);
    } catch (caught) {
      toast.error(toApiError(caught).detail);
    }
  }

  async function onTogglePublish(row: ResourceRow) {
    const identifier = identifierOf(config, row);
    try {
      await publish.mutateAsync({ id: identifier, next: !row.is_published });
      toast.success(row.is_published ? t('toast.unpublished') : t('toast.published'));
    } catch (caught) {
      const payload = toApiError(caught);
      const blockers = payload.errors?.is_published;
      toast.error(blockers?.length ? blockers[0] : payload.detail);
    }
  }

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h2 font-semibold">{config.title}</h1>
          {config.description ? <p className="mt-1 text-sm text-muted">{config.description}</p> : null}
        </div>

        {/* [بند 11] زر النظام نفسه بدل bg-primary px-4 rounded اليدوي */}
        {canCreate ? (
          <Button onClick={openCreate}>
            <Plus className="size-4" aria-hidden="true" />
            {t('actions.create')}
          </Button>
        ) : null}
      </header>

      {config.searchable !== false || config.filters?.length ? (
        <div className="mb-4 flex flex-wrap items-end gap-2">
          {config.searchable !== false ? (
            <div className="min-w-56 flex-1">
              {/* الوصولية: تسمية مرتبطة، لا placeholder كبديل */}
              <label htmlFor={searchId} className="mb-1 block text-xs font-medium text-muted">
                {t('search.label', { resource: config.title })}
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted"
                  aria-hidden="true"
                />
                <input
                  id={searchId}
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder={t('search.placeholder')}
                  className="min-h-11 w-full rounded-lg border border-border bg-background ps-9 pe-3 text-sm"
                />
              </div>
            </div>
          ) : null}

          {config.filters?.map((filter) => (
            <div key={filter.name}>
              <label
                htmlFor={`filter-${filter.name}`}
                className="mb-1 block text-xs font-medium text-muted"
              >
                {filter.label}
              </label>
              <select
                id={`filter-${filter.name}`}
                value={filters[filter.name] ?? ''}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, [filter.name]: event.target.value }))
                }
                className="min-h-11 rounded-lg border border-border bg-background px-3 text-sm"
              >
                <option value="">{t('filters.all')}</option>
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ))}

          {isFetching ? (
            <span className="flex min-h-11 items-center" aria-live="polite">
              <LoaderCircle className="size-4 animate-spin text-muted" aria-hidden="true" />
              <span className="sr-only">{t('states.loading')}</span>
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-subtle">
        <table className="w-full min-w-[40rem] text-sm">
          <caption className="sr-only">{config.title}</caption>
          <thead>
            <tr className="border-b border-border bg-surface-hover text-xs text-muted">
              {config.columns.map((column) => (
                <th key={column.name} scope="col" className="px-4 py-3 text-start font-medium">
                  {column.label}
                </th>
              ))}
              {/* [بند 7] عمود الإجراءات بمحاذاة النهاية المنطقية */}
              <th scope="col" className="px-4 py-3 text-end font-medium">
                {t('table.actions')}
              </th>
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <tr key={index} className="border-b border-border last:border-0">
                  {config.columns.map((column) => (
                    <td key={column.name} className="px-4 py-3.5">
                      <div className="h-4 animate-pulse rounded bg-surface-hover" />
                    </td>
                  ))}
                  <td className="px-4 py-3.5">
                    <div className="ms-auto h-4 w-16 animate-pulse rounded bg-surface-hover" />
                  </td>
                </tr>
              ))
            ) : isError ? (
              <tr>
                <td colSpan={config.columns.length + 1} className="p-0">
                  {/* [بند 10] المكوّن المشترك بدل نسخة خاصة داخل الخلية */}
                  <ErrorState
                    bare
                    title={t('states.errorTitle')}
                    body={toApiError(error).detail}
                    action={
                      <Button variant="secondary" onClick={() => refetch()}>
                        {t('actions.retry')}
                      </Button>
                    }
                  />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={config.columns.length + 1} className="p-0">
                  <EmptyState
                    bare
                    title={t('states.emptyTitle')}
                    body={config.emptyHint ?? t('states.emptyBody')}
                    action={
                      canCreate ? (
                        <Button onClick={openCreate}>
                          <Plus className="size-4" aria-hidden="true" />
                          {t('actions.createFirst')}
                        </Button>
                      ) : undefined
                    }
                  />
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border last:border-0 hover:bg-surface-hover"
                >
                  {config.columns.map((column) => (
                    // [بند 7] حشوة رأسية 14px تناسب ارتفاع السطر العربي
                    <td key={column.name} className="max-w-64 px-4 py-3.5">
                      <Cell column={column} row={row} locale={locale} t={t} />
                    </td>
                  ))}
                  <td className="px-4 py-3.5">
                    <div className="-me-2 flex items-center justify-end gap-0.5">
                      <IconButton
                        label={t('actions.edit')}
                        onClick={() => {
                          setEditingId(identifierOf(config, row));
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                      </IconButton>

                      {config.publishAction && editable ? (
                        <IconButton
                          label={row.is_published ? t('actions.unpublish') : t('actions.publish')}
                          onClick={() => onTogglePublish(row)}
                        >
                          {row.is_published ? (
                            <EyeOff className="size-4" aria-hidden="true" />
                          ) : (
                            <Eye className="size-4" aria-hidden="true" />
                          )}
                        </IconButton>
                      ) : null}

                      {editable && config.canDelete !== false ? (
                        <IconButton
                          label={t('actions.delete')}
                          tone="danger"
                          onClick={() => setConfirmDelete(row)}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </IconButton>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <nav
          aria-label={t('pagination.label')}
          className="mt-4 flex items-center justify-between gap-3 text-sm"
        >
          <p className="text-muted">
            {t.rich('pagination.summary', {
              page: data?.current_page ?? page,
              total: totalPages,
              count: data?.count ?? 0,
              ltr: (chunks) => <span className="code-inline inline">{chunks}</span>,
            })}
          </p>
          <div className="flex gap-1">
            {/* [بند 9] أيقونة واحدة ثابتة تنعكس بالـCSS — لا تفريع على اللغة */}
            <IconButton
              label={t('pagination.prev')}
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="border border-border"
            >
              <ChevronLeft className="size-4 flip-rtl" aria-hidden="true" />
            </IconButton>
            <IconButton
              label={t('pagination.next')}
              disabled={page >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              className="border border-border"
            >
              <ChevronLeft className="size-4 rotate-180 flip-rtl" aria-hidden="true" />
            </IconButton>
          </div>
        </nav>
      ) : null}

      <ResourceForm
        config={config}
        itemId={editingId}
        open={formOpen}
        onClose={() => setFormOpen(false)}
      />

      {confirmDelete ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
          aria-label={t('confirmDelete.title')}
        >
          <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-card">
            <span className="mb-3 grid size-12 place-items-center rounded-2xl bg-danger-soft text-danger">
              <TriangleAlert className="size-6" aria-hidden="true" />
            </span>
            <h2 className="text-h3 font-semibold">{t('confirmDelete.title')}</h2>
            <p className="mt-2 text-sm text-muted">{t('confirmDelete.body')}</p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmDelete(null)}>
                {t('actions.cancel')}
              </Button>
              <Button
                variant="danger"
                loading={remove.isPending}
                onClick={() => onDelete(confirmDelete)}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                {t('actions.delete')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

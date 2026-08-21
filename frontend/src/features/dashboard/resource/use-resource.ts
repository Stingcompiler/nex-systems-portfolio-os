'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api/client';
import type { Paginated } from '@/lib/api/types';
import type { ResourceConfig } from '@/features/dashboard/resource/types';

export interface ListParams {
  page?: number;
  page_size?: number;
  search?: string;
  ordering?: string;
  [key: string]: string | number | undefined;
}

export interface ResourceRow {
  id: number;
  [key: string]: unknown;
}

/**
 * `full=true` يطلب المسلسل الإداري بلغتيه.
 * الخادم يتجاهله لغير مستخدمي اللوحة، فلا يمكن استخراج حقول داخلية به.
 */
function withAdminView(params: ListParams = {}) {
  return { ...params, full: 'true' };
}

/**
 * معرّف السطر في المسار.
 *
 * بعض الموارد تُعرَّف بـ slug لا بـ id (`lookup_field` في الخادم)، فاستخدام
 * `id` معها يعطي 404 عند التعديل والحذف.
 */
export function identifierOf(config: ResourceConfig, row: ResourceRow): string | number {
  return config.identifier === 'slug' ? String(row.slug) : row.id;
}

export function useResourceList(config: ResourceConfig, params: ListParams = {}) {
  return useQuery({
    queryKey: [config.key, 'list', params],
    queryFn: async () => {
      const { data } = await api.get<Paginated<ResourceRow> | ResourceRow[]>(
        config.endpoint,
        { params: withAdminView(params) },
      );

      // نقاط نهاية الإعدادات تعيد قائمة مباشرة بلا غلاف ترقيم
      if (Array.isArray(data)) {
        return {
          count: data.length,
          total_pages: 1,
          current_page: 1,
          page_size: data.length,
          next: null,
          previous: null,
          results: data,
        } as Paginated<ResourceRow>;
      }
      return data;
    },
    placeholderData: (previous) => previous,
  });
}

export function useResourceItem(config: ResourceConfig, id: string | number | null) {
  return useQuery({
    queryKey: [config.key, 'item', id],
    enabled: id !== null && id !== undefined,
    queryFn: async () => {
      const { data } = await api.get<ResourceRow>(`${config.endpoint}${id}/`, {
        params: { full: 'true' },
      });
      return data;
    },
  });
}

export function useResourceMutations(config: ResourceConfig) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [config.key] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
  };

  const create = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const body = { ...(config.createDefaults ?? {}), ...payload };
      const { data } = await api.post<ResourceRow>(config.endpoint, body);
      return data;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string | number;
      payload: Record<string, unknown>;
    }) => {
      const { data } = await api.patch<ResourceRow>(`${config.endpoint}${id}/`, payload);
      return data;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string | number) => {
      await api.delete(`${config.endpoint}${id}/`);
    },
    onSuccess: invalidate,
  });

  const publish = useMutation({
    mutationFn: async ({ id, next }: { id: string | number; next: boolean }) => {
      const action = next ? 'publish' : 'unpublish';
      const { data } = await api.post<ResourceRow>(`${config.endpoint}${id}/${action}/`);
      return data;
    },
    onSuccess: invalidate,
  });

  return { create, update, remove, publish, invalidate };
}

/** خيارات حقل علاقة — تُجلب مرة وتُخزَّن. */
export function useRelationOptions(endpoint?: string, labelKey = 'name') {
  return useQuery({
    queryKey: ['relation-options', endpoint],
    enabled: Boolean(endpoint),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await api.get<Paginated<ResourceRow> | ResourceRow[]>(endpoint!, {
        params: { page_size: 200, full: 'true' },
      });
      const rows = Array.isArray(data) ? data : data.results;
      return rows.map((row) => ({
        value: row.id,
        label: String(row[labelKey] ?? row.name ?? row.title_ar ?? row.id),
      }));
    },
  });
}

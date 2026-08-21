'use client';

import { useQuery } from '@tanstack/react-query';
import { LoaderCircle, Search, Users } from 'lucide-react';
import { useState } from 'react';

import { crmDate } from '@/features/dashboard/crm/shared';
import { api } from '@/lib/api/client';
import type { Paginated } from '@/lib/api/types';

interface Client {
  id: number;
  name: string;
  company: string;
  email: string;
  phone: string;
  country: string;
  client_since: string;
  is_active: boolean;
}

export default function ClientsPage() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['clients', search],
    queryFn: async () => {
      const { data: list } = await api.get<Paginated<Client>>('/clients/', {
        params: { page_size: 50, ...(search ? { search } : {}) },
      });
      return list;
    },
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-h2 font-semibold">العملاء</h1>
        <p className="mt-1 text-sm text-muted">
          العملاء المتعاقدون — يظهرون هنا عند تحويل عميل محتمل.
        </p>
      </header>

      <div className="relative mb-4 max-w-sm">
        <Search
          className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted"
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="بحث بالاسم أو الشركة"
          aria-label="بحث في العملاء"
          className="min-h-11 w-full rounded border border-border bg-background ps-9 pe-3 text-sm"
        />
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16 text-muted" role="status">
          <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
        </div>
      ) : data?.results.length ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th scope="col" className="px-4 py-3 text-start font-medium">الاسم</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">الشركة</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">البريد</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">عميل منذ</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((client) => (
                <tr key={client.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{client.name}</td>
                  <td className="px-4 py-3 text-muted">{client.company || '—'}</td>
                  <td className="px-4 py-3 text-muted" dir="ltr">{client.email || '—'}</td>
                  <td className="px-4 py-3 text-muted">{crmDate(client.client_since)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        client.is_active
                          ? 'rounded-full bg-success/15 px-2 py-0.5 text-xs text-success'
                          : 'rounded-full bg-surface-hover px-2 py-0.5 text-xs text-muted'
                      }
                    >
                      {client.is_active ? 'نشط' : 'غير نشط'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <Users className="mx-auto mb-3 size-8 text-muted" aria-hidden="true" />
          <p className="text-muted">لا عملاء بعد. حوّل عميلًا محتملًا مقبولًا ليظهر هنا.</p>
        </div>
      )}
    </div>
  );
}

'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { toApiError } from '@/lib/api/client';

/**
 * حالة الخادم في لوحة التحكم.
 *
 * الصفحات العامة لا تستخدم هذا إطلاقًا — هي Server Components تجلب
 * بياناتها على الخادم. هذا خاص بشاشات الإدارة حيث تتكرر دورة
 * جلب/تعديل/إعادة جلب عشرات المرات.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              // لا فائدة من إعادة محاولة خطأ صلاحيات أو تحقق
              const { code } = toApiError(error);
              if (['permission_denied', 'not_authenticated', 'not_found',
                   'validation_error'].includes(code)) {
                return false;
              }
              return failureCount < 2;
            },
          },
          mutations: { retry: false },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

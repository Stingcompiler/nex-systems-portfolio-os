'use client';

import type { ReactNode } from 'react';

import { PageViewBeacon } from '@/components/layout/page-view-beacon';
import { MemberProvider } from '@/contexts/MemberContext';
import { QueryProvider } from '@/contexts/QueryProvider';
import { ToastProvider } from '@/contexts/ToastContext';

/**
 * مزوّدات العميل للموقع العام.
 *
 * الموقع في معظمه Server Components؛ هذه الطبقة الرقيقة تغلّف الأجزاء
 * التفاعلية فقط (نموذج التعليق، جلسة العضو) دون تحويل الصفحات إلى عميل.
 */
export function SiteProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <MemberProvider>
        <ToastProvider>
          <PageViewBeacon />
          {children}
        </ToastProvider>
      </MemberProvider>
    </QueryProvider>
  );
}

'use client';

import { useEffect } from 'react';

/** حدود خطأ اللوحة — تُبقي الانهيار داخل إطارها بدل إسقاط الصفحة كلها. */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[dashboard] خطأ غير متوقع:', error);
  }, [error]);

  return (
    <div className="grid min-h-[60vh] place-items-center p-6 text-center">
      <div className="max-w-sm">
        <h1 className="mb-2 text-h3 font-semibold">تعذّر عرض هذا القسم</h1>
        <p className="mb-6 text-sm text-muted">
          غالبًا يكون الخلل مؤقتًا (انقطاع لحظي في الخادم). أعد المحاولة، وإن تكرر
          فتحقق من سجل الأخطاء في المتصفح.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex min-h-11 items-center rounded bg-primary px-5 text-sm font-medium text-primary-foreground"
        >
          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}

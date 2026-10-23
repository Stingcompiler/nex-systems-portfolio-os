/**
 * هيكل تحميل للقوائم والصفحات (Design Reference §4): يحجز شكل المحتوى بدل
 * مؤشر دوران في فراغ، فلا تقفز الصفحة حين تصل البيانات.
 */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border rounded-lg border border-border bg-surface" role="status">
      <span className="sr-only">جارٍ التحميل…</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-4 px-4 py-4" aria-hidden="true">
          <div className="h-4 flex-1 animate-pulse rounded bg-surface-hover" style={{ maxWidth: `${70 - (index % 3) * 15}%` }} />
          <div className="ms-auto h-4 w-16 animate-pulse rounded bg-surface-hover" />
        </div>
      ))}
    </div>
  );
}

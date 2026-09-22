'use client';

/**
 * شبكة الأمان الأخيرة: تلتقط ما يفلت من حدود الخطأ الداخلية — بما فيها
 * استثناءات التخطيطات الجذرية نفسها (شاشة «Application error» البيضاء
 * التي ظهرت أثناء إعادة تشغيل الخدمة بعد نفاد الذاكرة).
 *
 * تستبدل التخطيط الجذري بالكامل، فتحمل <html> خاصًا بها، وبأنماط سطرية
 * لأن globals.css قد لا يكون متاحًا لحظة الانهيار. لا ترجمات هنا:
 * اللغة غير معروفة في هذا المستوى، فالنص بالعربية ثم الإنجليزية.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: '24px',
          background: '#f6f8fb',
          color: '#12253b',
          fontFamily: "'Tajawal', Tahoma, Arial, sans-serif",
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '26rem' }}>
          <p style={{ fontSize: '3rem', margin: '0 0 8px' }} aria-hidden="true">
            ⚠️
          </p>
          <h1 style={{ fontSize: '1.375rem', margin: '0 0 8px' }}>حدث خطأ غير متوقع</h1>
          <p style={{ color: '#5b6b7f', lineHeight: 1.9, margin: '0 0 6px' }}>
            جرّب إعادة تحميل الصفحة — غالبًا يكون الخلل مؤقتًا.
          </p>
          <p style={{ color: '#5b6b7f', fontSize: '0.875rem', margin: '0 0 24px' }} lang="en" dir="ltr">
            Something went wrong. Reloading usually fixes it.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              minHeight: '44px',
              padding: '0 28px',
              border: 0,
              borderRadius: '10px',
              background: '#0e7c86',
              color: '#fff',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            إعادة المحاولة · Retry
          </button>
        </div>
      </body>
    </html>
  );
}

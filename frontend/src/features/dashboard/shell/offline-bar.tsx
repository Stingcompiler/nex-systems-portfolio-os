'use client';

import { WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * Design Reference §8 (ما يناسب لوحة متصلة — D-0008): شريط هادئ غير حاجب
 * حين ينقطع اتصال الجهاز، بصياغة فعلية لا تقنية. الحفظ يحتاج الخادم هنا،
 * فالشريط يقول ذلك صراحة بدل أن يفشل الحفظ بلا تفسير.
 */
export function OfflineBar() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-dashed border-pending-border bg-pending-soft px-4 py-2 text-sm text-pending sm:px-6"
    >
      <WifiOff className="size-4 shrink-0" aria-hidden="true" />
      <span>
        <strong className="font-semibold">بلا اتصال.</strong> جهازك غير متصل الآن؛ يمكنك القراءة، والحفظ
        يعمل عند عودة الاتصال.
      </span>
    </div>
  );
}

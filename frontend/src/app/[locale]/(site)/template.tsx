import type { ReactNode } from 'react';

/**
 * انتقال بين الصفحات: Next يعيد تركيب القالب (بخلاف التخطيط) عند كل تنقّل،
 * فيدخل محتوى الصفحة الجديدة بظهور وارتفاع خفيفين بدل استبدال مفاجئ،
 * والترويسة والتذييل ثابتان في التخطيط فلا يرمشان.
 *
 * التعبئة `backwards` لا `both`: بعد الحركة لا يبقى transform على الغلاف —
 * التحويل الباقي يجعل الغلاف مرجعًا لكل عنصر fixed أو sticky داخل الصفحة.
 */
export default function SiteTemplate({ children }: { children: ReactNode }) {
  return <div className="motion-safe:animate-page-in">{children}</div>;
}

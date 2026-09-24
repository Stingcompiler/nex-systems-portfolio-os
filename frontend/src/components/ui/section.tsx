import type { ReactNode } from 'react';

import { Container } from '@/components/ui/container';
import { cn } from '@/lib/utils/cn';

/**
 * نبرات القسم:
 * - `default` أرضية الصفحة.
 * - `muted` سطح فاتح بحدّين — فاصل خفيف.
 * - `dark` يُرجع لغة البطل الداكنة إلى منتصف الصفحة. يعمل بصنف `.dark`
 *   المحلي: darkMode في Tailwind بالصنف، فكل رموز الألوان داخل القسم
 *   (الأسطح، الحدود، النص الخافت، الظلال) تتحوّل إلى قيم الوضع الداكن
 *   الموثوقة نفسها — بلا ألوان جديدة ولا تفريع في البطاقات.
 *   في الوضع الداكن العام أرضية الصفحة داكنة أصلًا، فلو أخذ القسم
 *   الأرضية نفسها لذاب فيها واختفى الإيقاع (قِيس: 11/18/14 = 11/18/14).
 *   لذلك يرتفع إلى السطح (`--surface`) بحدّين — الدرجة الأفتح — فيبقى
 *   القسم «المميّز» في الوضعين، بالاتجاه المعاكس لكل وضع.
 */
export type SectionTone = 'default' | 'muted' | 'dark';

export function Section({
  id,
  children,
  className,
  tone = 'default',
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  tone?: SectionTone;
}) {
  return (
    <section
      id={id}
      className={cn(
        'py-16 sm:py-24',
        tone === 'muted' && 'border-y border-border bg-surface',
        // `dark:` هنا = الوضع الداكن العام فقط: Tailwind يولّدها كـ :is(.dark *)
        // أي سليل عنصر .dark، والقسم ليس سليل نفسه.
        // في الداكن العام يصير القسم مطابقًا لـ muted (سطح + حدّان)، وبطاقاته
        // تُميَّز بحدّها لا بخلفيتها — وهو مبدأ الارتفاع الموثّق للوضع الداكن.
        tone === 'dark' &&
          'dark bg-background text-foreground dark:border-y dark:border-border dark:bg-surface',
        className,
      )}
    >
      <Container>{children}</Container>
    </section>
  );
}

/**
 * سطر الجذب فوق عناوين الأقسام: رقم القسم بخط المونو + تسمية.
 *
 * هو أداة الهوية الهندسية للموقع: يستثمر IBM Plex Mono كعلامة «أنظمة»
 * ويحلّ محلّ الشريط الزخرفي العام الذي كان يظهر فوق كل عنوان — ذاك
 * الشريط لا يحمل معلومة، وكان أوضح أثر «قالب جاهز» بعد البطل.
 * الرقم يُرسم LTR عمدًا (code-inline) كي لا ينقلب الترقيم في RTL.
 */
export function Eyebrow({
  index,
  label,
  className,
}: {
  index?: number;
  label?: string;
  className?: string;
}) {
  if (index === undefined && !label) return null;

  return (
    <p
      className={cn(
        'mb-4 flex items-center gap-3 text-eyebrow font-semibold text-primary',
        className,
      )}
    >
      {index !== undefined ? (
        <span className="code-inline inline" aria-hidden="true">
          {String(index).padStart(2, '0')}
        </span>
      ) : null}
      {index !== undefined && label ? (
        <span aria-hidden="true" className="h-px w-6 bg-primary/40" />
      ) : null}
      {label ? <span>{label}</span> : null}
    </p>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
  align = 'start',
  as: Heading = 'h2',
  index,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  align?: 'start' | 'center';
  as?: 'h1' | 'h2';
  /** رقم القسم في الصفحة — يظهر في سطر الجذب بخط المونو. */
  index?: number;
  /** تسمية سطر الجذب (تُعرض بجوار الرقم أو وحدها). */
  eyebrow?: string;
}) {
  return (
    <div
      className={cn(
        'mb-12 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between',
        align === 'center' && 'sm:flex-col sm:items-center sm:text-center',
      )}
    >
      <div className={cn('max-w-prose', align === 'center' && 'mx-auto')}>
        <Eyebrow
          index={index}
          label={eyebrow}
          className={cn(align === 'center' && 'justify-center')}
        />
        <Heading
          className={cn('font-bold', Heading === 'h1' ? 'text-h1' : 'text-h2')}
        >
          {title}
        </Heading>
        {subtitle ? (
          <p className="mt-4 max-w-[52ch] text-body-lg text-muted">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

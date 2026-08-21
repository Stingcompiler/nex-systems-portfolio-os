import type { ReactNode } from 'react';

import { Link } from '@/lib/i18n/navigation';
import { toParagraphs } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

/**
 * [بند 14] كل درجة خلفية من رمز soft صريح — لا تخفيف بالشفافية.
 * [بند 4] أُضيفت النبرات الدلالية التي كانت اللوحة تكتبها يدويًا.
 */
type Tone = 'default' | 'primary' | 'accent' | 'success' | 'warning' | 'danger';

const TONES: Record<Tone, string> = {
  default: 'bg-surface-hover text-muted',
  primary: 'bg-primary-soft text-primary',
  accent: 'bg-accent-soft text-accent',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
};

export function Badge({
  children,
  tone = 'default',
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Card({
  children,
  className,
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-surface p-6 shadow-subtle',
        interactive &&
          'group/card transition-all duration-normal hover:-translate-y-1 ' +
            'hover:border-primary/30 hover:shadow-elevated focus-within:shadow-elevated',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** نص من قاعدة البيانات يُعرض كفقرات — بلا dangerouslySetInnerHTML. */
export function Prose({ text, className }: { text: string | null | undefined; className?: string }) {
  const paragraphs = toParagraphs(text);
  if (!paragraphs.length) return null;

  return (
    <div className={cn('prose-content', className)}>
      {paragraphs.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  );
}

/** [بند 8] aria-label من الترجمة لا مكتوبًا في الشيفرة. */
export function Breadcrumbs({
  items,
  label,
}: {
  items: { name: string; href?: string }[];
  label: string;
}) {
  return (
    <nav aria-label={label} className="mb-6">
      <ol className="flex flex-wrap items-center gap-2 text-sm text-muted">
        {items.map((item, index) => (
          <li key={item.name} className="flex items-center gap-2">
            {item.href ? (
              <Link href={item.href} className="hover:text-foreground">
                {item.name}
              </Link>
            ) : (
              <span aria-current="page" className="text-foreground">
                {item.name}
              </span>
            )}
            {index < items.length - 1 ? (
              <span aria-hidden="true" className="text-border">
                /
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** يحقن بيانات منظّمة بأمان — JSON فقط. */
export function JsonLd({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}

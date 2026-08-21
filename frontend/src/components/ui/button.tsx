import { LoaderCircle } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';

/** [بند 11] أُضيف danger — واللوحة تستدعي هذا المكوّن بدل الأزرار اليدوية. */
type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-primary text-primary-foreground shadow-[0_4px_16px_-6px_rgb(var(--primary)/0.6)] ' +
    'hover:bg-primary/90 hover:shadow-[0_8px_24px_-8px_rgb(var(--primary)/0.7)] hover:-translate-y-0.5',
  secondary:
    'bg-surface text-foreground border border-border shadow-subtle ' +
    'hover:bg-surface-hover hover:border-primary/30',
  // [بند 14] خلفية هادئة من رمز صريح بدل primary/10
  outline: 'border border-primary/40 text-primary hover:bg-primary-soft hover:border-primary/60',
  ghost: 'text-foreground hover:bg-surface-hover',
  danger: 'bg-danger text-white hover:brightness-110',
};

const SIZES: Record<Size, string> = {
  // [بند 7] الحد الأدنى 44px لكل الأحجام — بما فيها الزر الأيقوني
  sm: 'min-h-11 px-4 text-sm gap-1.5',
  md: 'min-h-11 px-5 text-sm gap-2',
  lg: 'min-h-12 px-7 text-base gap-2',
  icon: 'size-11 p-0',
};

const BASE =
  'inline-flex items-center justify-center rounded-lg font-medium transition-all ' +
  'duration-fast focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60';

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  ...props
}: CommonProps & { loading?: boolean } & ComponentProps<'button'>) {
  return (
    <button
      aria-busy={loading || undefined}
      disabled={loading || disabled}
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      {...props}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

/**
 * [بند 7] زر أيقوني بهدف لمس 44px والأيقونة 16px.
 * label إلزامي — لا زر أيقوني بلا اسم مقروء.
 */
export function IconButton({
  label,
  tone = 'default',
  className,
  children,
  ...props
}: {
  label: string;
  tone?: 'default' | 'danger';
  className?: string;
  children: ReactNode;
} & Omit<ComponentProps<'button'>, 'children'>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'grid size-11 place-items-center rounded-lg text-muted transition-colors duration-fast',
        'hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring',
        'focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:pointer-events-none disabled:opacity-40',
        tone === 'danger' ? 'hover:text-danger' : 'hover:text-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: CommonProps & { href: string } & Omit<ComponentProps<typeof Link>, 'href' | 'className'>) {
  return (
    <Link href={href} className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...props}>
      {children}
    </Link>
  );
}

export function ExternalButtonLink({
  href,
  variant = 'secondary',
  size = 'md',
  className,
  children,
  ...props
}: CommonProps & ComponentProps<'a'>) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      {...props}
    >
      {children}
    </a>
  );
}

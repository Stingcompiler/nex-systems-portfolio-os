import { LoaderCircle } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

import {
  BASE,
  buttonClass,
  SIZES,
  VARIANTS,
  type Size,
  type Variant,
} from '@/components/ui/button-styles';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';

export { buttonClass };

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

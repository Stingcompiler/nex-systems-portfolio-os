'use client';

import { Check } from 'lucide-react';

import type { Interest } from '@/features/newsletter/newsletter-api';
import { cn } from '@/lib/utils/cn';

/** رقائق اختيار متعدد للاهتمامات — أزرار حقيقية بحالة aria-pressed. */
export function InterestPicker({
  interests,
  selected,
  onChange,
  label,
  compact = false,
}: {
  interests: Interest[];
  selected: string[];
  onChange: (keys: string[]) => void;
  label: string;
  compact?: boolean;
}) {
  if (!interests.length) return null;

  function toggle(key: string) {
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);
  }

  return (
    <fieldset>
      <legend className="mb-2 block text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {interests.map((interest) => {
          const active = selected.includes(interest.key);
          return (
            <button
              key={interest.key}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(interest.key)}
              title={interest.description || undefined}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 text-sm transition-colors',
                compact ? 'min-h-9' : 'min-h-10',
                active
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-muted hover:border-primary/50 hover:text-foreground',
              )}
            >
              {active ? <Check className="size-3.5" aria-hidden="true" /> : null}
              {interest.name}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

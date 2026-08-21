'use client';

import { useState } from 'react';

import { categoriesConfig, tagsConfig } from '@/features/dashboard/resource/configs';
import { ResourcePage } from '@/features/dashboard/resource/resource-page';
import { cn } from '@/lib/utils/cn';

const SECTIONS = [
  { key: 'categories', label: 'التصنيفات', config: categoriesConfig },
  { key: 'tags', label: 'الوسوم', config: tagsConfig },
];

export default function TaxonomyAdminPage() {
  const [active, setActive] = useState(SECTIONS[0].key);
  const current = SECTIONS.find((section) => section.key === active) ?? SECTIONS[0];

  return (
    <div>
      <div role="tablist" className="mb-6 flex flex-wrap gap-1 border-b border-border">
        {SECTIONS.map((section) => (
          <button
            key={section.key}
            type="button"
            role="tab"
            aria-selected={active === section.key}
            onClick={() => setActive(section.key)}
            className={cn(
              'min-h-11 border-b-2 px-4 text-sm font-medium transition-colors',
              active === section.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-foreground',
            )}
          >
            {section.label}
          </button>
        ))}
      </div>

      <ResourcePage key={current.key} config={current.config} />
    </div>
  );
}

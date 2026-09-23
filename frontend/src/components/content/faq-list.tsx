import { ChevronDown } from 'lucide-react';

import type { Faq } from '@/lib/api/types';

/**
 * قائمة أسئلة قابلة للطي بعناصر <details> الأصلية: تعمل بلا JavaScript
 * وبلوحة المفاتيح، ويقرؤها قارئ الشاشة زرًا موسّعًا.
 */
export function FaqList({ faqs }: { faqs: Pick<Faq, 'id' | 'question' | 'answer'>[] }) {
  return (
    <div className="max-w-prose space-y-3">
      {faqs.map((faq) => (
        <details
          key={faq.id}
          className="group rounded-xl border border-border bg-surface shadow-subtle"
        >
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 p-4 font-medium [&::-webkit-details-marker]:hidden">
            {faq.question}
            <ChevronDown
              className="size-4 shrink-0 text-muted transition-transform duration-fast group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <p className="whitespace-pre-line px-4 pb-4 text-muted">{faq.answer}</p>
        </details>
      ))}
    </div>
  );
}

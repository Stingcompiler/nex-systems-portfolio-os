import { MessageCircle } from 'lucide-react';

import { whatsappLink } from '@/lib/utils/format';

/**
 * زر واتساب عائم.
 *
 * في السودان والخليج يتفوّق واتساب على نماذج الويب في معدل التحويل بفارق
 * كبير، فوجوده في كل صفحة قرار تسويقي لا تجميلي.
 */
export function WhatsAppButton({
  number,
  message,
  label,
}: {
  number: string;
  message: string;
  label: string;
}) {
  const href = whatsappLink(number, message);
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="fixed bottom-5 end-5 z-40 inline-flex size-14 items-center justify-center rounded-full bg-success text-white shadow-card transition-transform duration-fast hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <MessageCircle className="size-6" aria-hidden="true" />
    </a>
  );
}

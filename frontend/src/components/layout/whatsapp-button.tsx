'use client';

import { MessageCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

import { usePathname } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils/cn';
import { whatsappLink } from '@/lib/utils/format';

/** صفحات فيها رابط واتساب داخل النموذج نفسه — الزر العائم يزاحم الحقول. */
const HIDDEN_ON = ['/request-quote', '/contact'];

/**
 * زر واتساب عائم.
 *
 * في السودان والخليج يتفوّق واتساب على نماذج الويب في معدل التحويل بفارق
 * كبير، فوجوده في كل صفحة قرار تسويقي لا تجميلي. يختفي في صفحتي النموذج
 * وأثناء الكتابة في أي حقل: على الهاتف تُرفع لوحة المفاتيح الزر فوق
 * الحقل الذي يكتب فيه الزائر.
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
  const pathname = usePathname();
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    const isField = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (target.matches('input, textarea, select') || target.isContentEditable);

    const onFocusIn = (event: FocusEvent) => setTyping(isField(event.target));
    const onFocusOut = () => setTyping(false);

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  const href = whatsappLink(number, message);
  if (!href || HIDDEN_ON.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return null;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className={cn(
        'fixed bottom-5 end-5 z-40 inline-flex size-14 items-center justify-center rounded-full bg-success text-white shadow-card transition-[transform,opacity] duration-fast hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        typing && 'pointer-events-none opacity-0',
      )}
    >
      <MessageCircle className="size-6" aria-hidden="true" />
    </a>
  );
}

'use client';

import { Download, Share, SquarePlus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils/cn';

/** حدث Chrome/Edge للتثبيت — غير معرَّف في أنواع TypeScript القياسية. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Mode = 'hidden' | 'prompt' | 'ios' | 'android-manual' | 'installed';

function detect(): Mode {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return 'hidden';
  const ua = navigator.userAgent;
  // iPadOS يعرّف نفسه «Macintosh» مع شاشة لمس
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) {
    return 'ios';
  }
  if (/android/i.test(ua)) return 'android-manual';
  return 'hidden';
}

/**
 * زر «ثبّت التطبيق» لشاشات الدخول.
 *
 * - Chrome/Edge (أندرويد والحاسوب): يلتقط `beforeinstallprompt` ويعرض نافذة
 *   التثبيت الأصلية بضغطة.
 * - iPhone/iPad: لا واجهة برمجية للتثبيت، فيعرض الخطوات بأيقونات Safari نفسها.
 * - أندرويد بمتصفح بلا الحدث (Firefox مثلًا): خطوات القائمة.
 * - مثبّت أصلًا أو حاسوب بلا دعم: لا يظهر شيء.
 */
export function InstallAppButton({ className }: { className?: string }) {
  const t = useTranslations('install');
  const [mode, setMode] = useState<Mode>('hidden');
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMode(detect());

    const onPrompt = (event: Event) => {
      // يمنع شريط المتصفح التلقائي؛ الزر يستدعيه عند الطلب
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setMode('prompt');
    };
    const onInstalled = () => {
      setDeferred(null);
      setMode('installed');
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (mode === 'hidden') return null;

  if (mode === 'installed') {
    return <p className={cn('text-center text-sm text-success', className)}>{t('installed')}</p>;
  }

  async function onClick() {
    if (mode === 'prompt' && deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      setDeferred(null);
      if (outcome === 'accepted') setMode('installed');
      return;
    }
    setOpen((value) => !value);
  }

  const steps =
    mode === 'ios'
      ? [
          { icon: Share, text: t('iosStep1') },
          { icon: SquarePlus, text: t('iosStep2') },
          { icon: Download, text: t('iosStep3') },
        ]
      : [
          { icon: null, text: t('androidStep1') },
          { icon: Download, text: t('androidStep2') },
        ];

  return (
    <div className={cn('rounded-xl border border-primary/30 bg-primary-soft/40 p-4', className)}>
      <button
        type="button"
        onClick={onClick}
        aria-expanded={mode === 'prompt' ? undefined : open}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-primary/40 bg-surface px-4 text-sm font-medium text-primary hover:bg-primary-soft"
      >
        <Download className="size-4" aria-hidden="true" />
        {t('button')}
      </button>
      <p className="mt-2 text-center text-xs text-muted">{t('hint')}</p>

      {open && mode !== 'prompt' ? (
        <div className="mt-4 rounded-lg border border-border bg-surface p-4 text-start">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              {mode === 'ios' ? t('iosTitle') : t('androidTitle')}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('close')}
              className="grid size-8 place-items-center rounded-md text-muted hover:bg-surface-hover"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          {mode === 'ios' ? <p className="mb-3 text-xs text-muted">{t('iosSafari')}</p> : null}
          <ol className="space-y-3">
            {steps.map(({ icon: Icon, text }, index) => (
              <li key={text} className="flex items-start gap-3 text-sm">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {index + 1}
                </span>
                <span className="flex-1 leading-relaxed">{text}</span>
                {Icon ? <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" /> : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

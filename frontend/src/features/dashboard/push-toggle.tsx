'use client';

import { BellOff, BellRing, LoaderCircle, Send } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { useToast } from '@/contexts/ToastContext';
import { api, toApiError } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';

type State =
  | 'loading'
  | 'unsupported'
  | 'ios-install'
  | 'denied'
  | 'off'
  | 'on';

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

async function registration() {
  // الـ Service Worker يُسجَّل من صفحات الموقع؛ اللوحة قد تُفتح أولًا
  return (await navigator.serviceWorker.getRegistration('/')) ?? navigator.serviceWorker.register('/sw.js');
}

/**
 * تفعيل إشعارات الطلبات الجديدة على هذا الجهاز (Web Push).
 *
 * كل جهاز يُفعَّل وحده: الهاتف والحاسوب اشتراكان. على iPhone لا تعمل
 * إشعارات الويب إلا من التطبيق المثبّت على الشاشة الرئيسية (iOS 16.4+)،
 * فتُعرض خطوات التثبيت بدل زر لا يعمل.
 */
export function PushToggle({ className }: { className?: string }) {
  const toast = useToast();
  const [state, setState] = useState<State>('loading');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setState(isIos() && !isStandalone() ? 'ios-install' : 'unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setState('denied');
      return;
    }
    const reg = await navigator.serviceWorker.getRegistration('/');
    const subscription = await reg?.pushManager.getSubscription();
    setState(subscription ? 'on' : 'off');
  }, []);

  useEffect(() => {
    refresh().catch(() => setState('unsupported'));
  }, [refresh]);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const { data } = await api.get<{ public_key: string }>('/notifications/push/key/');
      const reg = await registration();
      await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToBytes(data.public_key),
      });
      await api.post('/notifications/push/subscribe/', subscription.toJSON());
      setState('on');
      toast.success('فُعّلت الإشعارات على هذا الجهاز');
    } catch (caught) {
      toast.error(toApiError(caught).detail || 'تعذّر تفعيل الإشعارات');
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration('/');
      const subscription = await reg?.pushManager.getSubscription();
      if (subscription) {
        await api.post('/notifications/push/unsubscribe/', { endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setState('off');
      toast.success('أُوقفت الإشعارات على هذا الجهاز');
    } catch (caught) {
      toast.error(toApiError(caught).detail);
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      const { data } = await api.post<{ sent: number }>('/notifications/push/test/');
      if (data.sent) toast.success('أُرسل إشعار تجريبي — سيظهر خلال ثوانٍ');
      else toast.error('لم يُرسل شيء: فعّل الإشعارات على هذا الجهاز أولًا');
    } catch (caught) {
      toast.error(toApiError(caught).detail);
    } finally {
      setBusy(false);
    }
  }

  const on = state === 'on';
  const messages: Record<State, string> = {
    loading: '',
    unsupported: 'هذا المتصفح لا يدعم إشعارات الويب. جرّب Chrome أو Edge أو Firefox أو Safari الحديث.',
    'ios-install':
      'على iPhone: افتح لوحة التحكم في Safari، ثم «مشاركة» ← «إضافة إلى الشاشة الرئيسية»، وافتح التطبيق من الشاشة الرئيسية وفعّل الإشعارات منه.',
    denied:
      'الإشعارات محظورة لهذا الموقع في المتصفح. اسمح بها من إعدادات الموقع (رمز القفل بجانب العنوان) ثم أعد تحميل الصفحة.',
    off: 'فعّلها ليصلك إشعار على هذا الجهاز عند كل طلب مشروع أو رسالة جديدة، حتى والمتصفح مغلق.',
    on: 'الإشعارات مفعّلة على هذا الجهاز. فعّلها على كل جهاز تريد أن يصلك عليه التنبيه.',
  };

  return (
    <section
      className={cn(
        'flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4',
        on ? 'border-success/40 bg-success-soft/40' : 'border-border bg-surface',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 gap-3">
        <span
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-full',
            on ? 'bg-success-soft text-success' : 'bg-primary-soft text-primary',
          )}
        >
          {on ? <BellRing className="size-5" aria-hidden="true" /> : <BellOff className="size-5" aria-hidden="true" />}
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold">إشعارات الطلبات الجديدة على هذا الجهاز</h2>
          {state === 'loading' ? null : <p className="mt-0.5 text-sm text-muted">{messages[state]}</p>}
        </div>
      </div>

      {state === 'off' || state === 'on' ? (
        <div className="flex flex-wrap gap-2">
          {on ? (
            <button
              type="button"
              onClick={test}
              disabled={busy}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 text-sm hover:bg-surface-hover disabled:opacity-60"
            >
              <Send className="size-4 flip-rtl" aria-hidden="true" />
              إشعار تجريبي
            </button>
          ) : null}
          <button
            type="button"
            onClick={on ? disable : enable}
            disabled={busy}
            className={cn(
              'inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-medium disabled:opacity-60',
              on
                ? 'border border-border text-muted hover:text-danger'
                : 'bg-primary text-primary-foreground hover:bg-primary/90',
            )}
          >
            {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
            {on ? 'إيقاف' : 'تفعيل الإشعارات'}
          </button>
        </div>
      ) : null}
    </section>
  );
}

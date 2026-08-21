'use client';

import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

/**
 * عميل المتصفح للوحة التحكم.
 *
 * لا يحمل أي رمز: الوصول والتجديد في كوكيز HttpOnly يرسلها المتصفح
 * تلقائيًا. مهمة هذا الملف شيئان: إرفاق ترويسة CSRF، وتجديد الجلسة
 * مرة واحدة عند انتهاء صلاحية رمز الوصول.
 */

const CSRF_COOKIE = 'csrftoken';
const UNSAFE_METHODS = new Set(['post', 'put', 'patch', 'delete']);

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api/v1',
  withCredentials: true,
  headers: { Accept: 'application/json' },
});

function readCookie(name: string): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(new RegExp(`(^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[2]) : '';
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const method = (config.method || 'get').toLowerCase();
  if (UNSAFE_METHODS.has(method)) {
    const token = readCookie(CSRF_COOKIE);
    if (token) {
      config.headers.set('X-CSRFToken', token);
    }
  }
  return config;
});

// ---------------------------------------------------------------- التجديد

type Waiter = { resolve: () => void; reject: (error: unknown) => void };

let refreshing = false;
let queue: Waiter[] = [];

function flush(error: unknown = null) {
  for (const waiter of queue) {
    if (error) waiter.reject(error);
    else waiter.resolve();
  }
  queue = [];
}

/** يُستدعى عند فشل التجديد — تضبطه AuthContext لتنظيف الحالة والتحويل. */
let onSessionLost: (() => void) | null = null;

export function setSessionLostHandler(handler: (() => void) | null) {
  onSessionLost = handler;
}

interface RetriableConfig extends AxiosRequestConfig {
  _retried?: boolean;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const status = error.response?.status;

    const isAuthEndpoint = config?.url?.includes('/auth/');
    if (status !== 401 || !config || config._retried || isAuthEndpoint) {
      return Promise.reject(error);
    }

    config._retried = true;

    // طلبات متزامنة كثيرة قد تفشل معًا؛ تُوضع في طابور خلف تجديد واحد
    if (refreshing) {
      await new Promise<void>((resolve, reject) => queue.push({ resolve, reject }));
      return api(config);
    }

    refreshing = true;
    try {
      await api.post('/auth/refresh/', {});
      flush();
      return api(config);
    } catch (refreshError) {
      flush(refreshError);
      onSessionLost?.();
      return Promise.reject(refreshError);
    } finally {
      refreshing = false;
    }
  },
);

// ---------------------------------------------------------------- الأخطاء

export interface ApiErrorPayload {
  detail: string;
  code: string;
  errors: Record<string, string[]>;
}

/** يستخرج شكل الخطأ الموحّد القادم من DRF. */
export function toApiError(error: unknown): ApiErrorPayload {
  const fallback: ApiErrorPayload = {
    detail: 'تعذّر إتمام العملية',
    code: 'error',
    errors: {},
  };

  if (!axios.isAxiosError(error)) return fallback;

  const data = error.response?.data as Partial<ApiErrorPayload> | undefined;
  if (!data) {
    return { ...fallback, detail: 'تعذّر الاتصال بالخادم', code: 'network_error' };
  }

  return {
    detail: data.detail || fallback.detail,
    code: data.code || fallback.code,
    errors: data.errors || {},
  };
}

/** أول رسالة خطأ لحقل بعينه — تُعرض تحت الحقل في النموذج. */
export function fieldError(payload: ApiErrorPayload, field: string): string | undefined {
  return payload.errors?.[field]?.[0];
}

import type { Locale } from '@/lib/i18n/routing';

/**
 * عميل الجلب لمكوّنات الخادم.
 *
 * يتصل بـ Django مباشرة عبر `INTERNAL_API_URL` — هذا الاتصال لا يمر
 * بالمتصفح إطلاقًا، فلا يعرف الزائر عنوان الخادم الخلفي.
 */

const INTERNAL_API_URL =
  process.env.INTERNAL_API_URL ?? 'http://127.0.0.1:8000/api/v1';

const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? 'http://127.0.0.1:8000';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNotFound() {
    return this.status === 404;
  }
}

export interface FetchOptions {
  locale: Locale;
  searchParams?: Record<string, string | number | boolean | undefined | null>;
  /** ثوانٍ قبل إعادة التحقق. `false` يعني ديناميكي دائمًا. */
  revalidate?: number | false;
  tags?: string[];
}

function buildUrl(path: string, searchParams?: FetchOptions['searchParams']) {
  const url = new URL(
    `${INTERNAL_API_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`,
  );
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/**
 * يحوّل روابط الوسائط المطلقة إلى مسارات نسبية.
 *
 * الخادم يبني `http://127.0.0.1:8000/media/...` لأنه يرى طلبًا داخليًا،
 * وهذا العنوان لا يعمل من متصفح الزائر. المسار النسبي يعمل في التطوير
 * (عبر rewrites) وفي الإنتاج (عبر Nginx) بلا تغيير.
 */
function toRelativeMedia<T>(value: T): T {
  if (typeof value === 'string') {
    return (value.startsWith(BACKEND_ORIGIN)
      ? value.slice(BACKEND_ORIGIN.length)
      : value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map(toRelativeMedia) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = toRelativeMedia(item);
    }
    return result as T;
  }
  return value;
}

/** هل نحن داخل بناء إنتاج؟ */
function isProductionBuild(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build';
}

/**
 * بناء بلا API إطلاقًا (خدمة الواجهة المنفصلة على Render).
 *
 * لا يوجد Django أثناء البناء هناك، فكل جلب يعود بقيمته الفارغة فورًا:
 * الفهارس تُولَّد فارغة وتُبطَل عند الإقلاع (scripts/start.sh)، وصفحات
 * التفاصيل تُولَّد عند الطلب. أثر ذلك مطابق للبناء السابق على قاعدة فارغة.
 */
function isOfflineBuild(): boolean {
  // لا يُربط بـ NEXT_PHASE: عمّال التصيير وقت البناء لا يحملونه، فالفحص كان
  // يخفق بصمت ويعود البناء إلى جلب فعلي. المتغير يُمرَّر لأمر البناء وحده
  // (build-frontend.sh) فلا يصل إلى وقت التشغيل.
  return process.env.NEXT_BUILD_OFFLINE === 'true';
}

// أثناء البناء تنطلق عشرات الطلبات دفعة واحدة على خادم Django التطويري
// أحادي الخيط، فيرفض بعضها لحظيًا. الصبر نفسه يلزم وقت التشغيل (انظر أدناه)،
// دون إخفاء أخطاء HTTP الحقيقية (التي لا تُعاد المحاولة معها أصلًا).
// وقت التشغيل: 5 محاولات بتراجع متزايد (~6 ثوانٍ) — تغطي إعادة تدوير عامل
// gunicorn الوحيد (--max-requests في start.sh). محاولتان (~1.5 ثانية) كانتا
// تنتهيان قبل عودة العامل، فتُولَّد الصفحة بإعدادات فارغة وتُخزَّن هكذا.
const NETWORK_RETRIES = 5;
const RETRY_DELAY_MS = 400;

export async function apiGet<T>(
  path: string,
  { locale, searchParams, revalidate = 300, tags }: FetchOptions,
): Promise<T> {
  const url = buildUrl(path, searchParams);
  const init: RequestInit & { next?: object } = {
    headers: {
      'Accept-Language': locale,
      Accept: 'application/json',
    },
    next: revalidate === false ? { tags } : { revalidate, tags },
  };

  let lastNetworkError: unknown = null;

  // التوليد الثابت يطلق عشرات الطلبات دفعة واحدة، وقد يمتلئ طابور
  // الاستماع لدى الخادم فيُرفض الاتصال لحظيًا. إعادة المحاولة تعالج ذلك
  // دون إخفاء الانقطاع الحقيقي.
  for (let attempt = 0; attempt <= NETWORK_RETRIES; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (error) {
      lastNetworkError = error;
      if (attempt < NETWORK_RETRIES) {
        // تراجع تصاعدي مع اهتزاز عشوائي: بدونه ترتد كل الطلبات الفاشلة
        // معًا فتصطدم بالخادم في اللحظة نفسها مرة أخرى.
        const backoff = RETRY_DELAY_MS * (attempt + 1);
        const jitter = Math.random() * RETRY_DELAY_MS;
        await new Promise((resolve) => setTimeout(resolve, backoff + jitter));
        continue;
      }
      break;
    }

    if (!response.ok) {
      throw new ApiError(`فشل جلب ${path}: ${response.status}`, response.status, path);
    }

    return toRelativeMedia((await response.json()) as T);
  }

  throw new ApiError(
    `تعذّر الوصول إلى الـ API عند ${path}: ${(lastNetworkError as Error)?.message ?? 'خطأ شبكة'}`,
    0,
    path,
  );
}

/**
 * نسخة لا ترمي استثناء — تُستخدم لأقسام الصفحة الاختيارية.
 * انقطاع مؤقت في قسم واحد يجب ألا يُسقط الصفحة كلها.
 */
export async function apiGetSafe<T>(
  path: string,
  options: FetchOptions,
  fallback: T,
): Promise<T> {
  if (isOfflineBuild()) return fallback;

  try {
    return await apiGet<T>(path, options);
  } catch (error) {
    // في وقت التشغيل الارتداد إلى قيمة فارغة سلوك مقصود: انقطاع قسم واحد
    // يجب ألا يُسقط الصفحة. أما في البناء فالصمت يُنتج موقعًا فارغًا
    // منشورًا — وهو أسوأ بكثير من فشل صريح.
    if (isProductionBuild() && error instanceof ApiError && error.status === 0) {
      throw error;
    }

    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[api] تعذّر جلب ${path}:`, (error as Error).message);
    }
    return fallback;
  }
}

/**
 * للمحتوى الأساسي في الصفحة (قائمة الأعمال في صفحة الأعمال مثلًا).
 *
 * `apiGetSafe` يحوّل انقطاع الخادم إلى قائمة فارغة، فتعلن الصفحة «لم
 * يُنشر شيء بعد» وهو غير صحيح. هنا يُرمى الخطأ فتعرض حدود الخطأ حالة
 * قابلة لإعادة المحاولة، وعند إعادة التوليد في الخلفية يُبقي Next آخر
 * نسخة سليمة في الذاكرة المؤقتة بدل تثبيت صفحة فارغة.
 *
 * يُرمى الخطأ لانقطاع الشبكة و5xx فقط؛ البناء بلا API يعود بالقيمة
 * الفارغة كما في `apiGetSafe` (الصفحات هناك تُبطَل عند الإقلاع).
 */
export async function apiGetStrict<T>(
  path: string,
  options: FetchOptions,
  fallback: T,
): Promise<T> {
  if (isOfflineBuild()) return fallback;
  try {
    return await apiGet<T>(path, options);
  } catch (error) {
    // 4xx = طلب غير صالح (فلتر من رابط قديم مثلًا) لا عطل: نتيجة فارغة كافية
    if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
      return fallback;
    }
    throw error;
  }
}

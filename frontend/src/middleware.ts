import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';

import { routing } from '@/lib/i18n/routing';

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /**
   * توحيد المسارات بلا شرطة مائلة في النهاية.
   *
   * إعادة التوجيه التلقائية في Next معطّلة (`skipTrailingSlashRedirect`)
   * لأنها كانت تكسر مسارات Django المنتهية بشرطة. هذا الـ matcher يستثني
   * `/api` و`/media` و`/static` أصلًا، فالتوحيد يطبَّق على صفحات الموقع وحدها.
   */
  if (pathname.length > 1 && pathname.endsWith('/')) {
    const stripped = pathname.replace(/\/+$/, '');
    // عنوان عادي لا `nextUrl`: هذا الأخير يعرف بادئة اللغة، فإسناد «/ar»
    // إليه يُقرأ «لغة ar بمسار جذر» ويُعاد تسلسله «/ar/» — فيصير التحويل
    // إلى المسار نفسه وتدور حلقة لا تنتهي على كل رابط ينتهي بشرطة.
    const url = new URL(request.url);
    url.pathname = stripped || '/';
    return NextResponse.redirect(url, 308);
  }

  return intlMiddleware(request);
}

export const config = {
  // يستثني الـ API ولوحة Django والوسائط والأصول الثابتة وأي مسار يحمل امتدادًا
  matcher: [
    '/((?!api|admin|dashboard|media|static|_next|_vercel|.*\\..*).*)',
  ],
};

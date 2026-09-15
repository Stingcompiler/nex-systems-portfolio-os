import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * يستقبل إشارة الإبطال من Django عند تعديل المحتوى من لوحة التحكم.
 *
 * محمي بسر مشترك: بدونه يستطيع أي طرف إبطال التخزين المؤقت باستمرار
 * فيثقل الخادم. المسار مستثنى من إعادة الكتابة في next.config لأنه
 * مسار Next حقيقي لا يمر بـ Django.
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get('X-Revalidate-Secret');
  const expected = process.env.REVALIDATE_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json(
      { detail: 'غير مصرّح', code: 'unauthorized' },
      { status: 401 },
    );
  }

  let body: { tags?: string[]; paths?: string[]; all?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { detail: 'جسم غير صالح', code: 'invalid_body' },
      { status: 400 },
    );
  }

  const tags = Array.isArray(body.tags) ? body.tags : [];
  for (const tag of tags) {
    if (typeof tag === 'string' && tag) {
      revalidateTag(tag);
    }
  }

  const paths = Array.isArray(body.paths) ? body.paths : [];
  for (const path of paths) {
    if (typeof path === 'string' && path.startsWith('/')) {
      revalidatePath(path);
    }
  }

  // عند الإقلاع: الصفحات المخبوزة وقت البناء كلها بلا محتوى، فتُبطَل الشجرة
  // كاملة بدل الاعتماد على تطابق الوسوم
  if (body.all === true) {
    revalidatePath('/', 'layout');
  }

  return NextResponse.json({ revalidated: true, tags, paths, all: body.all === true });
}

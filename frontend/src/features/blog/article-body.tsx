import { toParagraphs } from '@/lib/utils/format';

/**
 * يعرض محتوى المقال كفقرات.
 *
 * المحتوى نص عادي من قاعدة البيانات، لا HTML — فلا نستخدم
 * dangerouslySetInnerHTML إطلاقًا، ولا سطح هجوم XSS.
 */
export function ArticleBody({ content }: { content: string }) {
  const paragraphs = toParagraphs(content);
  if (!paragraphs.length) return null;

  return (
    <div className="prose-content text-lg leading-loose">
      {paragraphs.map((paragraph, index) => (
        <p key={index} className="mb-5">
          {paragraph}
        </p>
      ))}
    </div>
  );
}

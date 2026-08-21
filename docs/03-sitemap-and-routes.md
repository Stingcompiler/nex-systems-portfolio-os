# خريطة الموقع والمسارات

## 1. تعدد اللغات

- المسار يبدأ باللغة دائمًا: `/ar/...` و`/en/...`.
- `/` يعيد التوجيه إلى `/ar` (الافتراضي من `SiteSettings`) مع مراعاة كوكي `NEXT_LOCALE` إن وُجد.
- تبديل اللغة يحافظ على الصفحة الحالية ومعاملاتها.
- الاختيار يُحفظ في كوكي `NEXT_LOCALE` (سنة، غير HttpOnly).
- `<html lang dir>` يُضبط من `[locale]` في التخطيط الجذري.

## 2. خريطة الموقع العام

```
/[locale]
├── /                       الرئيسية (14 قسمًا قابلًا للترتيب)
├── /about                  نبذة · الخبرات · التعليم · الشهادات · تحميل السيرة
├── /services               فهرس الخدمات التطويرية
│   └── /[slug]             صفحة خدمة
├── /solutions              فهرس الحلول القطاعية
│   └── /[slug]             صفحة حل
├── /projects               المشاريع (فلترة: قطاع، نوع، تقنية)
│   └── /[slug]             تفاصيل مشروع
├── /case-studies           دراسات الحالة
│   └── /[slug]             دراسة حالة كاملة
├── /technologies           التقنيات مصنّفة
├── /process                طريقة العمل ومراحل المشروع
├── /blog                   المدونة (بحث، تصنيف، وسم، ترقيم)
│   ├── /[slug]             المقال + التعليقات
│   ├── /category/[slug]
│   └── /tag/[slug]
├── /resources              الموارد والملفات
├── /contact                نموذج تواصل + واتساب + الخريطة
├── /request-quote          طلب مشروع (3 خطوات)
├── /privacy-policy
└── /terms
```

## 3. مسارات المصادقة والعضوية

```
/[locale]
├── /login
├── /register
├── /verify-email/[token]
├── /forgot-password
├── /reset-password/[token]
└── /member
    ├── /                   نظرة عامة
    ├── /profile            الملف الشخصي
    ├── /saved              المقالات المحفوظة
    ├── /comments           تعليقاتي
    ├── /subscriptions      تفضيلات النشرة
    ├── /notifications
    └── /settings           كلمة المرور · اللغة · حذف الحساب
```

## 4. مسارات لوحة التحكم

خارج `[locale]` — لغة واحدة لواجهة اللوحة (العربية) لتقليل التعقيد، مع بقاء تحرير المحتوى ثنائي اللغة.

```
/dashboard
├── /                              الإحصائيات
├── /content
│   ├── /home                      أقسام الرئيسية (سحب وإفلات) · الإحصائيات
│   ├── /about                     نبذة · خبرات · تعليم · شهادات
│   ├── /services                  + /new · /[id]
│   ├── /solutions                 + /new · /[id]
│   ├── /projects                  + /new · /[id]
│   ├── /case-studies              + /new · /[id]
│   ├── /technologies
│   ├── /process
│   ├── /testimonials
│   ├── /faq
│   └── /resources
├── /blog
│   ├── /posts                     + /new · /[id]
│   ├── /categories
│   └── /tags
├── /crm
│   ├── /leads                     جدول + Kanban · /[id]
│   ├── /clients                   /[id]
│   ├── /requests                  /[id]
│   ├── /messages
│   └── /follow-ups                تقويم + قائمة
├── /marketing
│   ├── /subscribers
│   ├── /campaigns                 + /new · /[id]
│   └── /templates
├── /community
│   ├── /members                   /[id]
│   ├── /comments                  فلترة بالحالة
│   ├── /reports
│   └── /blocked-emails
├── /media                         مكتبة الوسائط
├── /analytics
├── /seo                           إعدادات SEO · التحويلات · sitemap
├── /notifications
├── /users                         المستخدمون والأدوار
├── /audit-logs
└── /settings                      إعدادات الموقع
```

## 5. هيكل التوجيه في Next.js

```
src/app/
├── [locale]/
│   ├── layout.tsx                 html lang/dir · الخطوط · Providers
│   ├── (site)/                    مجموعة الموقع العام
│   │   ├── layout.tsx             Header + Footer
│   │   ├── page.tsx               الرئيسية
│   │   ├── about/page.tsx
│   │   ├── services/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/page.tsx
│   │   ├── ... بقية الصفحات
│   ├── (auth)/
│   │   ├── layout.tsx             تخطيط مبسّط بلا قوائم
│   │   ├── login/page.tsx
│   │   └── ...
│   └── (member)/
│       ├── layout.tsx             حماية + قائمة جانبية
│       └── member/...
├── dashboard/
│   ├── layout.tsx                 حماية + Sidebar + Topbar
│   └── ...
├── api/                           Route Handlers (BFF)
│   ├── auth/[...]/route.ts        تسجيل الدخول/الخروج/التجديد
│   └── revalidate/route.ts        إبطال التخزين المؤقت من اللوحة
├── sitemap.ts
├── robots.ts
├── manifest.ts
└── not-found.tsx
```

**لماذا مجموعات المسارات `(site)` و`(auth)` و`(member)`؟** كل مجموعة لها تخطيطها الخاص دون أن تظهر في المسار — الموقع العام بترويسة وتذييل، وصفحات المصادقة بتخطيط نظيف، وصفحات العضو بقائمة جانبية.

## 6. استراتيجية العرض والتخزين المؤقت

| الصفحة | الأسلوب | إعادة التحقق |
|---|---|---|
| الرئيسية | SSG + ISR | 300 ثانية + إبطال موجَّه |
| الخدمات والحلول | `generateStaticParams` + ISR | 3600 ثانية |
| المشاريع ودراسات الحالة | SSG + ISR | 3600 ثانية |
| المدونة (الفهرس) | ISR | 300 ثانية |
| المقال | SSG + ISR | 600 ثانية |
| التقنيات · طريقة العمل · السياسات | SSG | عند البناء |
| التواصل · طلب عرض السعر | ديناميكي (نماذج) | — |
| لوحة التحكم · صفحة العضو | ديناميكي بالكامل | لا تخزين |

**الإبطال الموجَّه:** عند حفظ محتوى من اللوحة، يستدعي Django مسار `POST /api/revalidate` في Next.js (بمفتاح داخلي مشترك) مع الوسوم المتأثرة، فيتحدث المحتوى فورًا دون انتظار المهلة.

## 7. SEO لكل نوع صفحة

| الصفحة | Structured Data | ملاحظات |
|---|---|---|
| الرئيسية | `WebSite` + `Organization` + `Person` | + `SearchAction` |
| نبذة | `Person` | مع `knowsAbout` من التقنيات |
| خدمة / حل | `Service` + `BreadcrumbList` + `FAQPage` | `areaServed`, `provider` |
| مشروع | `CreativeWork` + `BreadcrumbList` | |
| دراسة حالة | `Article` + `BreadcrumbList` | |
| مقال | `Article` + `BreadcrumbList` | `author`, `datePublished`, `wordCount` |
| المدونة | `Blog` | |
| التواصل | `ContactPage` + `ProfessionalService` | |

**عناصر إلزامية في كل صفحة:**
- `metadata` ديناميكية من قاعدة البيانات مع ارتداد إلى `SEOSettings`.
- `canonical` مطلق للغة الحالية.
- `hreflang` للغتين + `x-default` يشير إلى العربية.
- Open Graph + Twitter Card بصورة مخصصة أو مولّدة عبر `opengraph-image.tsx`.
- Breadcrumbs مرئية ومهيكلة.

**`sitemap.ts`** يُولَّد ديناميكيًا: الصفحات الثابتة + كل المحتوى المنشور بلغتيه، مع `lastModified` من `updated_at` و`alternates.languages`.

**`robots.ts`** يمنع `/dashboard` و`/member` و`/api`، ويشير إلى `sitemap.xml`.

## 8. الروابط الداخلية

نمط ثابت يقوّي بنية الموقع:

```
مشروع     → الخدمات المرتبطة · التقنيات · دراسة الحالة · مشاريع القطاع
خدمة      → المشاريع الشاهدة · الحلول القطاعية · الأسئلة الشائعة · طلب عرض سعر
دراسة حالة → المشروع · الخدمات · مقالات ذات صلة
مقال      → مقالات مرتبطة · التصنيف · الوسوم · خدمة ذات صلة
```

## 9. التحويلات و404

- `Redirect` يُنشأ آليًا عند تغيير slug منشور (301).
- الجدول يُقرأ في `middleware.ts` قبل التوجيه.
- صفحة 404 مخصصة بلغتين تقترح: الرئيسية · المشاريع · المدونة · البحث · التواصل.

## 10. الوسيط `middleware.ts`

بالترتيب:
1. تجاهل الأصول الثابتة و`/api`.
2. مطابقة `Redirect`.
3. تحديد اللغة (المسار → الكوكي → `Accept-Language` → الافتراضي) وإعادة التوجيه عند الحاجة.
4. وضع الصيانة: تحويل غير المديرين إلى صفحة الصيانة.
5. حماية `/dashboard` و`/member`: التحقق من وجود كوكي الجلسة وإعادة التوجيه إلى `/login?next=...`.

> التحقق في الوسيط تحقق **مبدئي** لتحسين التجربة فقط. الصلاحية الحقيقية تُفحص في كل استدعاء API على الخادم.

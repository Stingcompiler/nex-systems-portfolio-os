# هيكل المشروع

```
modernportfolio/
├── run.py            المدخل الوحيد: setup · dev · check · build · serve · manage
├── .env              إعدادات الطرفين — ملف واحد، غير مُتتبَّع
├── .env.example      قالب موثّق
├── backend/          Django + DRF
├── frontend/         Next.js
├── deploy/           nginx.conf · systemd/ · deploy.sh · backup.sh
├── docs/
└── README.md
```

المشروع وحدة واحدة تشغيليًا: ملف إعدادات واحد، وأمر واحد للتشغيل، ووحدة `systemd` واحدة للنشر، وكتلة Nginx واحدة. الانقسام إلى عمليتين تفصيل داخلي لا يراه الزائر ولا المشغّل.

---

## 1. Backend — Django

```
backend/
├── manage.py
├── requirements/
│   ├── base.txt
│   ├── dev.txt
│   └── prod.txt
├── .env.example
├── config/
│   ├── settings/
│   │   ├── base.py
│   │   ├── dev.py            SQLite · DEBUG · بريد للطرفية · مهام متزامنة
│   │   ├── test.py           تجزئة سريعة · قاعدة في الذاكرة · بريد locmem
│   │   └── prod.py           PG أو SQLite · SMTP · تقوية
│   ├── urls.py
│   ├── wsgi.py
│   └── asgi.py
├── apps/
│   ├── core/
│   │   ├── models/
│   │   │   ├── base.py       النماذج المجردة المشتركة
│   │   │   ├── settings.py   SiteSettings · SEOSettings · SocialLink
│   │   │   ├── sections.py   PageSection · Stat
│   │   │   └── system.py     FAQ · Redirect · AuditLog
│   │   ├── serializers/
│   │   ├── views/
│   │   ├── permissions.py    فئات الصلاحيات المشتركة
│   │   ├── pagination.py
│   │   ├── exceptions.py     معالج الأخطاء الموحّد
│   │   ├── middleware.py     اللغة · التدقيق · الصيانة
│   │   ├── throttling.py
│   │   ├── mixins.py         AuditMixin · TranslatableSerializerMixin
│   │   ├── fields.py         TranslatedField
│   │   ├── utils/
│   │   │   ├── text.py       التطبيع العربي · النقحرة · وقت القراءة
│   │   │   ├── images.py     WebP · مصغّرات · ضغط
│   │   │   ├── files.py      التحقق من النوع الفعلي
│   │   │   └── tokens.py     رموز موقّعة
│   │   ├── tasks.py
│   │   └── management/commands/
│   │       ├── seed_groups.py
│   │       └── seed_content.py
│   ├── accounts/
│   │   ├── models.py         User · MemberProfile · ClientProfile · Tokens
│   │   ├── authentication.py CookieJWTAuthentication
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── permissions.py
│   │   ├── emails.py
│   │   └── tasks.py
│   ├── portfolio/            Service · Project · CaseStudy · Technology · ...
│   ├── blog/                 Post · Category · Tag · SavedPost
│   ├── comments/             Comment · Report · BlockedEmail · antispam.py
│   ├── crm/                  Lead · Client · Request · FollowUp · export.py
│   ├── newsletter/           Subscriber · Campaign · Template · sender.py
│   ├── notifications/
│   ├── analytics/
│   └── media_library/
├── templates/emails/
│   ├── base_ar.html
│   ├── base_en.html
│   └── ...
├── static/
├── media/                    غير مُتتبَّع
└── tests/
    ├── conftest.py
    ├── factories/
    └── <app>/
```

**كل تطبيق يتبع النمط نفسه:** `models` · `serializers` · `views` · `filters` · `permissions` · `tasks` · `urls` · `tests`. عند تجاوز الملف 300 سطر يُقسَّم إلى حزمة (`models/` بدل `models.py`).

**قواعد ملزمة:**
- المنطق في النماذج والخدمات، لا في الـ Views.
- كل ViewSet يعرّف `select_related`/`prefetch_related`.
- كل مورد له مسلسلان: `Public` و`Admin`.
- التحقق في المسلسل، لا في الـ View.
- كل عملية كتابة تمر عبر `AuditMixin`.

---

## 2. Frontend — Next.js

```
frontend/
├── next.config.mjs           rewrites · images · headers
├── tailwind.config.ts
├── tsconfig.json
├── .env.example
├── public/
│   ├── fonts/
│   ├── icons/                أيقونات PWA
│   └── images/
└── src/
    ├── app/                  (المسارات — انظر 03-sitemap-and-routes.md)
    ├── components/
    │   ├── ui/               العناصر الأساسية
    │   ├── layout/           Header · Footer · Sidebar · Topbar
    │   ├── shared/           EmptyState · ErrorState · Skeletons · Toast
    │   └── sections/         أقسام الصفحات العامة
    ├── features/             تنظيم حسب النطاق
    │   ├── auth/             components · hooks · api · schemas · types
    │   ├── services/
    │   ├── projects/
    │   ├── case-studies/
    │   ├── blog/
    │   ├── comments/
    │   ├── crm/
    │   ├── newsletter/
    │   ├── members/
    │   ├── media/
    │   └── analytics/
    ├── lib/
    │   ├── api/
    │   │   ├── client.ts     Axios + interceptors (CSRF · تجديد · أخطاء)
    │   │   ├── server.ts     fetch للمكونات الخادمية + وسوم التخزين
    │   │   └── endpoints.ts  مصدر واحد لكل المسارات
    │   ├── i18n/
    │   │   ├── config.ts
    │   │   ├── request.ts
    │   │   └── navigation.ts Link · useRouter مدركان للغة
    │   ├── seo/
    │   │   ├── metadata.ts
    │   │   └── json-ld.ts
    │   ├── validation/       مخططات Zod مشتركة
    │   ├── utils/            cn · التواريخ · الأرقام · النصوص
    │   └── constants/
    ├── contexts/
    │   ├── AuthContext.tsx
    │   ├── LocaleContext.tsx
    │   ├── ThemeContext.tsx
    │   └── SettingsContext.tsx
    ├── hooks/                useMediaQuery · useDebounce · useOnClickOutside ...
    ├── types/                أنواع مشتركة مطابقة لمخطط الـ API
    ├── messages/
    │   ├── ar.json
    │   └── en.json
    └── styles/
        └── globals.css       المتغيرات · الأساس · الأدوات
```

### 2.1 محرك الموارد — قلب لوحة التحكم

الفكرة التي تجعل بناء ~35 شاشة إدارية ممكنًا دون تكرار.

```
src/features/dashboard/resource/
├── types.ts                  ResourceConfig · FieldConfig · ColumnConfig
├── ResourceTable.tsx         جدول عام: بحث · فلاتر · ترتيب · ترقيم · تحديد · إجراءات جماعية
├── ResourceForm.tsx          نموذج عام يُبنى من تعريف الحقول
├── ResourceFilters.tsx
├── ResourcePage.tsx          يجمع الثلاثة في صفحة كاملة
├── fields/                   Text · Textarea · RichText · Bilingual · Image ·
│                             Media · Relation · Date · Switch · Select · JsonList
└── useResource.ts            TanStack Query: list · detail · create · update · delete
```

كل شاشة إدارية تصبح ملف إعداد:

```ts
export const technologyResource: ResourceConfig = {
  key: 'technologies',
  endpoint: '/technologies/',
  permission: 'change_technology',
  columns: [...],
  filters: [...],
  fields: [...],
  schema: technologySchema,   // Zod
};
```

**الشاشات المستثناة (تُبنى يدويًا):** لوحة الإحصائيات · Kanban للعملاء المحتملين · مكتبة الوسائط · محرر ترتيب أقسام الرئيسية · محرر المقالات · منشئ الحملات.

### 2.2 قواعد الواجهة

| القاعدة | التفصيل |
|---|---|
| Server Components افتراضيًا | `"use client"` يُبرَّر — تفاعل، أو خطاف، أو واجهة متصفح |
| حدود العميل صغيرة | زر تفاعلي داخل قسم خادمي، لا قسم كامل كعميل |
| Context محدود | المصادقة · اللغة · الثيم · الإعدادات فقط |
| بيانات الخادم عبر TanStack Query | في اللوحة وصفحة العضو فقط |
| Zod مشترك | نفس المخطط للنموذج ولاستجابة الـ API |
| لا مسارات API مكتوبة يدويًا | كلها من `lib/api/endpoints.ts` |
| كل قائمة لها أربع حالات | تحميل · خطأ · فراغ · محتوى |
| لا `left/right` | خصائص منطقية حصرًا |

---

## 3. الوثائق

```
docs/
├── 00-overview-and-decisions.md
├── 01-architecture.md
├── 02-data-model.md
├── 03-sitemap-and-routes.md
├── 04-roles-and-use-cases.md
├── 05-api-endpoints.md
├── 06-design-system.md
├── 07-project-structure.md
└── 08-roadmap.md
```

---

## 4. متغيرات البيئة

ملف واحد في جذر المستودع: `.env`. القالب الكامل الموثّق في `.env.example`.

**الخلفية** تقرأ كل المفاتيح عبر `django-environ`.

**الواجهة** تقرأ خمسة مفاتيح فقط، بقائمة سماح صريحة في `frontend/next.config.mjs`:

```js
const FRONTEND_ENV_KEYS = [
  'NEXT_PUBLIC_SITE_URL',   // canonical و sitemap و Open Graph
  'NEXT_PUBLIC_API_URL',    // ما يراه المتصفح — نسبي دائمًا
  'INTERNAL_API_URL',       // اتصال خادم Next بـ Django مباشرة
  'BACKEND_ORIGIN',         // وجهة إعادة الكتابة
  'REVALIDATE_SECRET',      // إبطال التخزين المؤقت من اللوحة
];
```

> `SECRET_KEY` و`DB_PASSWORD` و`EMAIL_HOST_PASSWORD` **لا تدخل عملية Node إطلاقًا**.
> وحدة ملف الإعدادات لا تعني وحدة الوصول إليه.
>
> متغيّر معرَّف في بيئة النظام يتقدّم على الملف، فتستطيع خدمات systemd
> والـ CI تجاوز أي قيمة دون تعديل الملف.

---

## 5. التشغيل المحلي

كل شيء عبر `run.py` من جذر المستودع — بلا حزم خارجية:

```bash
python run.py setup                     # تهيئة كاملة أول مرة
python run.py manage createsuperuser    # حسابك الإداري
python run.py dev                       # تشغيل كل شيء
```

`dev` يشغّل Django والواجهة بمخرجات موحّدة موسومة `[api]` و`[web]`، وينهيهما معًا بـ Ctrl+C. أضف `--worker` لتشغيل عامل المهام أيضًا.

الموقع على `http://localhost:3000` · التوثيق التفاعلي على `http://localhost:3000/api/schema/swagger-ui/`

### بقية الأوامر

| الأمر | الوظيفة |
|---|---|
| `python run.py check` | Django · الترحيلات · pytest · مخطط OpenAPI · أنواع الواجهة |
| `python run.py build` | بناء الإنتاج — يشغّل الـ API مؤقتًا إن لم يكن يعمل |
| `python run.py serve` | تشغيل نسخة الإنتاج محليًا |
| `python run.py test` | اختبارات الخلفية وحدها |
| `python run.py manage …` | أي أمر Django |

> **لماذا يشغّل `build` الـ API؟** بناء الواجهة يستدعي الـ API فعليًا لتوليد
> المسارات الثابتة وبياناتها. بدونه يخرج بناء صامت بصفحات فارغة — وهو أسوأ
> من فشل صريح. ولهذا أيضًا يرمي `apiGetSafe` استثناءً وقت البناء بدل الارتداد
> إلى قيمة فارغة.

### الاختبارات

```bash
python run.py test
```

تستخدم `config.settings.test` تلقائيًا عبر `pytest.ini`. لتوليد مخطط OpenAPI مع اعتبار التحذيرات أخطاء:

```bash
python run.py manage spectacular --fail-on-warn --file ../schema.yml
```

وهو أصلًا جزء من `python run.py check`.

---

## 6. النشر

وحدة نشر واحدة بلا Docker: كتلة Nginx واحدة، و`stingdev.target` تجمع ثلاث خدمات systemd (Gunicorn، Node، عامل المهام).

```bash
cd /srv/stingdev && ./deploy/deploy.sh
```

التفاصيل الكاملة في [`deploy/README.md`](../deploy/README.md).

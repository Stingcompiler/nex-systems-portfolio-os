# واجهة REST API

الجذر: `/api/v1/` · التوثيق التفاعلي: `/api/schema/swagger-ui/` عبر `drf-spectacular`

## 1. الاصطلاحات

**رموز الوصول في الجداول:**
`P` عام بلا مصادقة · `M` عضو مصادَق · `S` بصلاحية محددة · `A` مدير عام

**الترقيم:** `?page=1&page_size=12` (افتراضي 12، أقصى 100)

```json
{ "count": 120, "next": "...", "previous": null, "results": [] }
```

**اللغة:** ترويسة `Accept-Language: ar|en` تحدد لغة الحقول المترجمة ورسائل الخطأ.
`?full=true` يعيد اللغتين معًا (تستخدمه لوحة التحكم).

**شكل الخطأ الموحّد:**

```json
{
  "detail": "بيانات غير صالحة",
  "code": "validation_error",
  "errors": { "email": ["هذا البريد مستخدم بالفعل"] }
}
```

**معاملات مشتركة:** `?search=` · `?ordering=` · `?is_featured=` · فلاتر خاصة بكل مورد.

---

## 2. المصادقة — `/api/v1/auth/`

| الطريقة | المسار | الوصول | الوصف |
|---|---|:--:|---|
| POST | `register/` | P | تسجيل عضو + بريد تحقق |
| POST | `login/` | P | ضبط الكوكيز (ويب) أو إرجاع الرموز (موبايل) |
| POST | `logout/` | M | إبطال الرمز ومسح الكوكيز |
| POST | `logout-all/` | M | إبطال كل رموز المستخدم |
| POST | `refresh/` | P | تجديد مع تدوير وإبطال القديم |
| GET | `me/` | M | بيانات المستخدم + صلاحياته |
| PATCH | `me/` | M | تعديل الملف الشخصي |
| POST | `verify-email/` | P | تأكيد البريد بالرمز |
| POST | `resend-verification/` | M | إعادة إرسال (محدود المعدل) |
| POST | `password/forgot/` | P | طلب استعادة |
| POST | `password/reset/` | P | تعيين كلمة مرور جديدة بالرمز |
| POST | `password/change/` | M | تغيير كلمة المرور (يبطل كل الرموز) |
| DELETE | `me/` | M | حذف الحساب بتأكيد كلمة المرور |

حدود المعدل: `login` 5/15د · `register` 3/ساعة · `password/forgot` 3/ساعة · `resend-verification` 1/10د

---

## 3. الإعدادات والمحتوى العام — `/api/v1/`

| الطريقة | المسار | الوصول | الوصف |
|---|---|:--:|---|
| GET | `settings/` | P | إعدادات الموقع العامة (بلا أسرار) |
| PATCH | `settings/` | S | `manage_settings` |
| GET | `settings/seo/` | P | إعدادات SEO |
| GET | `social-links/` | P | روابط التواصل |
| GET | `sections/?page=home` | P | أقسام الصفحة مرتبة |
| PATCH | `sections/{id}/` | S | تعديل قسم |
| POST | `sections/reorder/` | S | إعادة ترتيب دفعة واحدة |
| GET | `stats/` | P | إحصائيات الرئيسية |
| GET | `faqs/?scope=&service=` | P | الأسئلة الشائعة |
| GET | `process-steps/` | P | مراحل العمل |

---

## 4. الخدمات والحلول — `/api/v1/services/` · `/api/v1/solutions/`

نفس ViewSet مع فلترة `kind` مسبقة.

| الطريقة | المسار | الوصول | الوصف |
|---|---|:--:|---|
| GET | `services/` | P | فلاتر: `sector, technology, is_featured` |
| GET | `services/{slug}/` | P | + التقنيات والمشاريع والأسئلة |
| POST · PATCH · DELETE | `services/…` | S | `change_service` |
| POST | `services/{id}/publish/` | S | مع فحص الحد الأدنى للمحتوى |
| GET | `solutions/` · `solutions/{slug}/` | P | `kind=solution` |

---

## 5. المشاريع ودراسات الحالة

| الطريقة | المسار | الوصول | الوصف |
|---|---|:--:|---|
| GET | `projects/` | P | فلاتر: `sector, project_type, technology, status, is_featured` |
| GET | `projects/{slug}/` | P | + الصور والتقنيات ودراسة الحالة |
| POST · PATCH · DELETE | `projects/…` | S | |
| POST | `projects/{id}/images/` | S | رفع صور |
| POST | `projects/{id}/images/reorder/` | S | |
| GET | `case-studies/` · `{slug}/` | P | |
| POST · PATCH · DELETE | `case-studies/…` | S | |
| GET | `technologies/?category=` | P | |
| POST · PATCH · DELETE | `technologies/…` | S | |
| GET | `testimonials/?is_featured=` | P | |
| GET | `experiences/` · `education/` · `certifications/` | P | صفحة «نبذة» |
| GET | `resources/` | P | `requires_membership` يقيّد التحميل |

---

## 6. المدونة

| الطريقة | المسار | الوصول | الوصف |
|---|---|:--:|---|
| GET | `posts/` | P | فلاتر: `category, tag, author, is_featured` · `search` · `ordering=-published_at,-view_count` |
| GET | `posts/{slug}/` | P | + المقالات المرتبطة |
| GET | `posts/popular/` | P | الأكثر قراءة |
| GET | `posts/latest/` | P | الأحدث |
| POST · PATCH · DELETE | `posts/…` | S | Editor مقيَّد بمقالاته |
| POST | `posts/{id}/publish/` | S | `publish_post` |
| POST | `posts/{id}/save/` | M | حفظ/إلغاء حفظ |
| GET | `posts/saved/` | M | محفوظات العضو |
| GET | `categories/` · `tags/` | P | |
| POST · PATCH · DELETE | `categories/…` · `tags/…` | S | |

المسودات والمجدولة لا تظهر في الاستجابات العامة إطلاقًا — يُطبَّق على مستوى `get_queryset`.

---

## 7. التعليقات

| الطريقة | المسار | الوصول | الوصف |
|---|---|:--:|---|
| GET | `comments/?post={slug}` | P | المعتمدة فقط، متشعبة بمستويين |
| POST | `comments/` | P | ضيف أو عضو → حالة `pending` |
| PATCH · DELETE | `comments/{id}/` | M | العضو لتعليقه خلال 15 دقيقة |
| GET | `comments/mine/` | M | تعليقات العضو بكل حالاتها |
| GET | `comments/admin/?status=` | S | كل التعليقات للمراجعة |
| POST | `comments/{id}/approve/` | S | |
| POST | `comments/{id}/reject/` | S | |
| POST | `comments/{id}/spam/` | S | + خيار حظر البريد |
| POST | `comments/{id}/report/` | P | بلاغ |
| GET | `comment-reports/` | S | |
| PATCH | `comment-reports/{id}/` | S | معالجة البلاغ |
| GET · POST · DELETE | `blocked-emails/` | S | |

حد المعدل: 3 تعليقات/ساعة/IP · 5/ساعة/بريد

---

## 8. التواصل وطلبات المشاريع

| الطريقة | المسار | الوصول | الوصف |
|---|---|:--:|---|
| POST | `contact-messages/` | P | 3/ساعة/IP |
| GET | `contact-messages/` | S | |
| PATCH | `contact-messages/{id}/` | S | تغيير الحالة |
| POST | `project-requests/draft/` | P | حفظ جزئي بعد الخطوة 1 |
| PATCH | `project-requests/draft/{key}/` | P | تحديث المسودة |
| POST | `project-requests/` | P | الإرسال النهائي → Lead + إشعارات |
| POST | `project-requests/{id}/attachments/` | P | رفع مرفقات |
| GET | `project-requests/` | S | فلاتر: `status, sector, project_type` |
| GET · PATCH | `project-requests/{id}/` | S | |
| POST | `project-requests/{id}/convert-to-lead/` | S | يدوي عند الحاجة |

---

## 9. CRM

| الطريقة | المسار | الوصول | الوصف |
|---|---|:--:|---|
| GET | `leads/` | S | فلاتر: `status, priority, source, owner, country` · `search` |
| POST · GET · PATCH · DELETE | `leads/…` | S | |
| POST | `leads/{id}/convert/` | S | تحويل إلى Client |
| GET | `leads/export/` | S | CSV مفلتر · `export_leads` |
| GET | `leads/kanban/` | S | مجمّع حسب الحالة |
| GET · POST · PATCH · DELETE | `clients/…` | S | |
| GET · POST | `crm/notes/` | S | `?lead=` أو `?client=` |
| GET · POST | `crm/interactions/` | S | يحدّث `last_contact_at` |
| GET · POST · PATCH | `crm/follow-ups/` | S | `?due=today,week,overdue` |
| POST | `crm/attachments/` | S | |

---

## 10. النشرة والحملات

| الطريقة | المسار | الوصول | الوصف |
|---|---|:--:|---|
| POST | `subscribers/subscribe/` | P | Double Opt-in |
| POST | `subscribers/confirm/` | P | تأكيد بالرمز |
| POST | `subscribers/unsubscribe/` | P | برمز موقّع، بلا تسجيل دخول |
| GET · PATCH | `subscribers/preferences/{token}/` | P | تعديل التفضيلات برابط آمن |
| GET | `subscribers/` | S | فلاتر: `status, language, interest` |
| GET | `subscribers/export/` | S | CSV |
| GET | `interests/` | P | |
| GET · POST · PATCH · DELETE | `campaigns/…` | S | |
| POST | `campaigns/{id}/preview-audience/` | S | عدد المستلمين قبل الإرسال |
| POST | `campaigns/{id}/test-send/` | S | إرسال اختباري |
| POST | `campaigns/{id}/send/` | S | `send_campaign` |
| POST | `campaigns/{id}/schedule/` | S | |
| POST | `campaigns/{id}/cancel/` | S | |
| GET | `campaigns/{id}/stats/` | S | |
| GET · POST · PATCH · DELETE | `email-templates/…` | S | |

---

## 11. الأعضاء والمستخدمون

| الطريقة | المسار | الوصول | الوصف |
|---|---|:--:|---|
| GET | `members/` | S | قائمة الأعضاء |
| GET | `members/{id}/` | S | + تعليقاته ومحفوظاته واشتراكه |
| POST | `members/{id}/convert-to-client/` | A | إنشاء `ClientProfile` |
| GET · POST · PATCH · DELETE | `users/…` | A | |
| POST | `users/{id}/set-role/` | A | |
| GET | `roles/` | A | المجموعات وصلاحياتها |

---

## 12. الوسائط

| الطريقة | المسار | الوصول | الوصف |
|---|---|:--:|---|
| GET | `media/?folder=&type=&search=` | S | |
| POST | `media/upload/` | S | تحقق من المحتوى الفعلي + معالجة خلفية |
| PATCH | `media/{id}/` | S | العنوان و Alt text والمجلد |
| DELETE | `media/{id}/` | S | تحذير إذا `usage_count > 0` |
| GET · POST · PATCH · DELETE | `media/folders/…` | S | |

الحدود: صور 5MB · مستندات 10MB · مجموع الطلب 25MB

---

## 13. الإشعارات

| الطريقة | المسار | الوصول | الوصف |
|---|---|:--:|---|
| GET | `notifications/?is_read=` | M | إشعارات المستخدم أو دوره |
| GET | `notifications/unread-count/` | M | |
| POST | `notifications/{id}/read/` | M | |
| POST | `notifications/read-all/` | M | |
| DELETE | `notifications/{id}/` | M | |

الاستقصاء كل 60 ثانية في اللوحة عبر TanStack Query (لا WebSocket في هذه المرحلة).

---

## 14. التحليلات

| الطريقة | المسار | الوصول | الوصف |
|---|---|:--:|---|
| POST | `analytics/view/` | P | إشارة مشاهدة — تُجمَّع دفعيًا |
| GET | `analytics/overview/?range=7d,30d,90d` | S | البطاقات الرئيسية |
| GET | `analytics/traffic/` | S | الزيارات عبر الزمن |
| GET | `analytics/top-content/?type=` | S | الأكثر مشاهدة |
| GET | `analytics/sources/` | S | مصادر الزيارات |
| GET | `analytics/geo/` | S | الدول |
| GET | `analytics/devices/` | S | الأجهزة |
| GET | `analytics/conversions/` | S | زيارة ← طلب |
| GET | `analytics/subscribers-growth/` | S | |
| GET | `analytics/requests-by-status/` | S | |

---

## 15. سجل التدقيق والنظام

| الطريقة | المسار | الوصول | الوصف |
|---|---|:--:|---|
| GET | `audit-logs/?user=&model=&action=&date_from=` | A | |
| GET | `dashboard/summary/` | S | بطاقات لوحة التحكم |
| GET | `health/` | P | فحص الحالة للمراقبة |
| GET | `redirects/` · POST · DELETE | S | إدارة التحويلات |

---

## 16. قواعد ثابتة عبر كل الـ API

1. **القراءة العامة فقط للمنشور** — `get_queryset` يفلتر، ولا يُعتمد على الواجهة إطلاقًا.
2. **لا حقول حساسة في الاستجابات العامة** — `guest_email`, `ip`, `user_agent`, `consent_ip` مستثناة على مستوى المسلسل.
3. **مسلسلان لكل مورد** — `PublicSerializer` مختصر و`AdminSerializer` كامل، يُختار حسب صلاحية الطالب.
4. **التحقق في المسلسل لا في الـ View** — ليعمل مع كل العملاء بالتساوي.
5. **كل عملية كتابة تُسجَّل** في `AuditLog` عبر Mixin مشترك.
6. **`select_related` و`prefetch_related` إلزاميان** في كل ViewSet لمنع استعلامات N+1.
7. **تحديد المعدل على كل نقطة كتابة عامة** بلا استثناء.
8. **الاستجابات العامة قابلة للتخزين المؤقت** بترويسات `Cache-Control` مناسبة.

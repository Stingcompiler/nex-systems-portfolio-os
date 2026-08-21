from django.db import models

from apps.core.models.base import (
    AuthoredModel,
    OrderableModel,
    PublishableModel,
    SearchableModel,
    SEOModel,
    TimeStampedModel,
    TranslatableMixin,
    ViewCountModel,
)
from apps.core.utils.text import count_words, unique_slug
from apps.portfolio.enums import Sector

#: الحد الأدنى لعدد كلمات الوصف العربي قبل السماح بالنشر.
#  الهدف منع الصفحات الرقيقة التي تضر بترتيب الموقع كله في محركات البحث.
MIN_PUBLISH_WORDS = 120


class Service(
    TranslatableMixin,
    SEOModel,
    SearchableModel,
    PublishableModel,
    OrderableModel,
    ViewCountModel,
    AuthoredModel,
    TimeStampedModel,
):
    """نموذج واحد يخدم الخدمات التطويرية والحلول القطاعية معًا.

    الفارق بينهما `kind` فقط: نفس الحقول ونفس المنطق ونفس المسلسلات،
    ومساران مختلفان في الواجهة (`/services` و`/solutions`).
    """

    class Kind(models.TextChoices):
        SERVICE = "service", "خدمة تطويرية"
        SOLUTION = "solution", "حل قطاعي"

    translatable_fields = (
        "title",
        "short_description",
        "description",
        "price_note",
        "duration_estimate",
    )
    search_source_fields = (
        "title_ar", "title_en",
        "short_description_ar", "short_description_en",
        "description_ar", "description_en",
    )

    kind = models.CharField(
        "النوع", max_length=12, choices=Kind.choices, default=Kind.SERVICE, db_index=True
    )
    sector = models.CharField(
        "القطاع", max_length=20, choices=Sector.choices, default=Sector.GENERAL, db_index=True
    )

    title_ar = models.CharField("العنوان (عربي)", max_length=160, blank=True)
    title_en = models.CharField("العنوان (إنجليزي)", max_length=160, blank=True)
    slug = models.SlugField("المعرّف", max_length=180, unique=True, blank=True)

    short_description_ar = models.TextField("وصف مختصر (عربي)", max_length=400, blank=True)
    short_description_en = models.TextField("وصف مختصر (إنجليزي)", max_length=400, blank=True)
    description_ar = models.TextField("الوصف الكامل (عربي)", blank=True)
    description_en = models.TextField("الوصف الكامل (إنجليزي)", blank=True)

    icon = models.CharField("الأيقونة", max_length=60, blank=True)
    cover_image = models.ForeignKey(
        "media_library.MediaFile", verbose_name="صورة الغلاف",
        related_name="+", null=True, blank=True, on_delete=models.SET_NULL,
    )

    #: [{title_ar, title_en, description_ar, description_en, icon}]
    features = models.JSONField("المميزات", default=list, blank=True)
    #: ["..."] قائمة نصية بالمخرجات
    deliverables = models.JSONField("المخرجات", default=list, blank=True)

    price_from = models.DecimalField(
        "السعر يبدأ من", max_digits=10, decimal_places=2, null=True, blank=True
    )
    price_currency = models.CharField("العملة", max_length=8, default="USD", blank=True)
    price_note_ar = models.CharField("ملاحظة السعر (عربي)", max_length=200, blank=True)
    price_note_en = models.CharField("ملاحظة السعر (إنجليزي)", max_length=200, blank=True)
    duration_estimate_ar = models.CharField("المدة التقديرية (عربي)", max_length=80, blank=True)
    duration_estimate_en = models.CharField("المدة التقديرية (إنجليزي)", max_length=80, blank=True)

    technologies = models.ManyToManyField(
        "portfolio.Technology", verbose_name="التقنيات", related_name="services", blank=True
    )
    related_projects = models.ManyToManyField(
        "portfolio.Project", verbose_name="مشاريع شاهدة", related_name="services", blank=True
    )

    is_featured = models.BooleanField("مميزة", default=False, db_index=True)

    class Meta:
        verbose_name = "خدمة أو حل"
        verbose_name_plural = "الخدمات والحلول"
        ordering = ["display_order", "-created_at"]
        indexes = [models.Index(fields=["kind", "is_published", "display_order"])]

    def __str__(self):
        return self.title_ar or self.title_en or self.slug or f"خدمة #{self.pk}"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(self, self.title_en or self.title_ar)
        super().save(*args, **kwargs)

    def publication_blockers(self) -> list[str]:  # noqa: D401
        """اقتراحات لتحسين الصفحة — إرشادية فقط ولا تمنع النشر.

        النشر أصبح اختياريًا بلا حد أدنى للمحتوى؛ تُعرض هذه القائمة في اللوحة
        كتلميحات لرفع جودة الصفحة دون إجبار.
        """
        problems: list[str] = []

        words = count_words(self.description_ar)
        if words < MIN_PUBLISH_WORDS:
            problems.append(
                f"الوصف العربي {words} كلمة، والحد الأدنى للنشر {MIN_PUBLISH_WORDS} كلمة. "
                "الصفحات الرقيقة تضر بترتيب الموقع كله."
            )
        if not self.short_description_ar.strip():
            problems.append("الوصف المختصر العربي مطلوب.")
        if not isinstance(self.features, list) or len(self.features) < 3:
            problems.append("يلزم ثلاث مميزات على الأقل.")

        return problems


#: مرجع على مستوى الوحدة — يحتاجه drf-spectacular لتسمية التعداد
#  (لا يستطيع استيراد مسار يمر عبر فئة متداخلة).
SERVICE_KIND_CHOICES = Service.Kind.choices

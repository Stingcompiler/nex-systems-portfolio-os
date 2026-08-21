"""محتوى صفحة «نبذة» والموارد وشهادات العملاء."""

from django.db import models

from apps.core.models.base import (
    ActivatableModel,
    OrderableModel,
    PublishableModel,
    TimeStampedModel,
    TranslatableMixin,
)
from apps.core.utils.text import unique_slug


class Testimonial(TranslatableMixin, OrderableModel, PublishableModel, TimeStampedModel):
    translatable_fields = ("client_name", "client_title", "company", "content")

    client_name_ar = models.CharField("اسم العميل (عربي)", max_length=120, blank=True)
    client_name_en = models.CharField("اسم العميل (إنجليزي)", max_length=120, blank=True)
    client_title_ar = models.CharField("المسمى (عربي)", max_length=120, blank=True)
    client_title_en = models.CharField("المسمى (إنجليزي)", max_length=120, blank=True)
    company_ar = models.CharField("الجهة (عربي)", max_length=120, blank=True)
    company_en = models.CharField("الجهة (إنجليزي)", max_length=120, blank=True)

    content_ar = models.TextField("نص الشهادة (عربي)", blank=True)
    content_en = models.TextField("نص الشهادة (إنجليزي)", blank=True)
    rating = models.PositiveSmallIntegerField(
        "التقييم", default=5, choices=[(i, str(i)) for i in range(1, 6)]
    )

    avatar = models.ForeignKey(
        "media_library.MediaFile", verbose_name="الصورة",
        related_name="+", null=True, blank=True, on_delete=models.SET_NULL,
    )
    project = models.ForeignKey(
        "portfolio.Project", verbose_name="المشروع",
        related_name="testimonials", null=True, blank=True, on_delete=models.SET_NULL,
    )
    proof_url = models.URLField(
        "رابط يثبت الشهادة", blank=True,
        help_text="رابط LinkedIn أو رسالة عامة — يرفع مصداقية الشهادة.",
    )
    is_featured = models.BooleanField("مميزة", default=False, db_index=True)

    class Meta:
        verbose_name = "شهادة عميل"
        verbose_name_plural = "شهادات العملاء"
        ordering = ["display_order", "-created_at"]

    def __str__(self):
        return self.client_name_ar or self.client_name_en or f"شهادة #{self.pk}"


class Experience(TranslatableMixin, OrderableModel, ActivatableModel, TimeStampedModel):
    translatable_fields = ("title", "organization", "location", "description")

    title_ar = models.CharField("المسمى (عربي)", max_length=140, blank=True)
    title_en = models.CharField("المسمى (إنجليزي)", max_length=140, blank=True)
    organization_ar = models.CharField("الجهة (عربي)", max_length=140, blank=True)
    organization_en = models.CharField("الجهة (إنجليزي)", max_length=140, blank=True)
    location_ar = models.CharField("الموقع (عربي)", max_length=100, blank=True)
    location_en = models.CharField("الموقع (إنجليزي)", max_length=100, blank=True)
    start_date = models.DateField("تاريخ البداية", null=True, blank=True)
    end_date = models.DateField("تاريخ النهاية", null=True, blank=True)
    is_current = models.BooleanField("مستمر", default=False)
    description_ar = models.TextField("الوصف (عربي)", blank=True)
    description_en = models.TextField("الوصف (إنجليزي)", blank=True)

    class Meta:
        verbose_name = "خبرة"
        verbose_name_plural = "الخبرات"
        ordering = ["-is_current", "-start_date"]

    def __str__(self):
        return f"{self.title_ar or '—'} — {self.organization_ar or '—'}"


class Education(TranslatableMixin, OrderableModel, ActivatableModel, TimeStampedModel):
    translatable_fields = ("degree", "institution", "field", "description")

    degree_ar = models.CharField("الدرجة (عربي)", max_length=140, blank=True)
    degree_en = models.CharField("الدرجة (إنجليزي)", max_length=140, blank=True)
    institution_ar = models.CharField("المؤسسة (عربي)", max_length=140, blank=True)
    institution_en = models.CharField("المؤسسة (إنجليزي)", max_length=140, blank=True)
    field_ar = models.CharField("التخصص (عربي)", max_length=140, blank=True)
    field_en = models.CharField("التخصص (إنجليزي)", max_length=140, blank=True)
    start_date = models.DateField("تاريخ البداية", null=True, blank=True)
    end_date = models.DateField("تاريخ التخرج", null=True, blank=True)
    description_ar = models.TextField("الوصف (عربي)", blank=True)
    description_en = models.TextField("الوصف (إنجليزي)", blank=True)

    class Meta:
        verbose_name = "مؤهل علمي"
        verbose_name_plural = "المؤهلات العلمية"
        ordering = ["-end_date", "display_order"]

    def __str__(self):
        return f"{self.degree_ar or '—'} — {self.institution_ar or '—'}"


class Certification(TranslatableMixin, OrderableModel, ActivatableModel, TimeStampedModel):
    translatable_fields = ("name", "issuer")

    name_ar = models.CharField("الاسم (عربي)", max_length=180, blank=True)
    name_en = models.CharField("الاسم (إنجليزي)", max_length=180, blank=True)
    issuer_ar = models.CharField("الجهة المانحة (عربي)", max_length=140, blank=True)
    issuer_en = models.CharField("الجهة المانحة (إنجليزي)", max_length=140, blank=True)
    issue_date = models.DateField("تاريخ الإصدار", null=True, blank=True)
    expiry_date = models.DateField("تاريخ الانتهاء", null=True, blank=True)
    credential_id = models.CharField("رقم الشهادة", max_length=120, blank=True)
    credential_url = models.URLField("رابط التحقق", blank=True)
    image = models.ForeignKey(
        "media_library.MediaFile", verbose_name="الصورة",
        related_name="+", null=True, blank=True, on_delete=models.SET_NULL,
    )

    class Meta:
        verbose_name = "شهادة"
        verbose_name_plural = "الشهادات"
        ordering = ["-issue_date", "display_order"]

    def __str__(self):
        return self.name_ar or self.name_en or f"شهادة #{self.pk}"


class Resource(TranslatableMixin, OrderableModel, PublishableModel, TimeStampedModel):
    class Kind(models.TextChoices):
        PDF = "pdf", "ملف PDF"
        LINK = "link", "رابط"
        TOOL = "tool", "أداة"
        TEMPLATE = "template", "قالب"

    translatable_fields = ("title", "description")

    title_ar = models.CharField("العنوان (عربي)", max_length=180, blank=True)
    title_en = models.CharField("العنوان (إنجليزي)", max_length=180, blank=True)
    slug = models.SlugField("المعرّف", max_length=200, unique=True, blank=True)
    description_ar = models.TextField("الوصف (عربي)", blank=True)
    description_en = models.TextField("الوصف (إنجليزي)", blank=True)

    kind = models.CharField("النوع", max_length=12, choices=Kind.choices, default=Kind.PDF)
    file = models.ForeignKey(
        "media_library.MediaFile", verbose_name="الملف",
        related_name="+", null=True, blank=True, on_delete=models.SET_NULL,
    )
    url = models.URLField("الرابط", blank=True)
    cover_image = models.ForeignKey(
        "media_library.MediaFile", verbose_name="صورة الغلاف",
        related_name="+", null=True, blank=True, on_delete=models.SET_NULL,
    )
    requires_membership = models.BooleanField("يتطلب عضوية", default=False)
    download_count = models.PositiveIntegerField("مرات التحميل", default=0, editable=False)

    class Meta:
        verbose_name = "مورد"
        verbose_name_plural = "الموارد"
        ordering = ["display_order", "-created_at"]

    def __str__(self):
        return self.title_ar or self.title_en or self.slug or f"مورد #{self.pk}"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(self, self.title_en or self.title_ar)
        super().save(*args, **kwargs)


#: مرجع على مستوى الوحدة لتسمية التعداد في مخطط OpenAPI
RESOURCE_KIND_CHOICES = Resource.Kind.choices

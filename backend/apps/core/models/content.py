"""عناصر المحتوى العامة: أقسام الصفحات، الإحصائيات، الأسئلة الشائعة، مراحل العمل."""

from django.db import models

from apps.core.models.base import (
    ActivatableModel,
    OrderableModel,
    TimeStampedModel,
    TranslatableMixin,
)


class PageSection(TranslatableMixin, OrderableModel, TimeStampedModel):
    """يتحكم في ظهور أقسام الصفحات وترتيبها ونصوصها من لوحة التحكم."""

    class Page(models.TextChoices):
        HOME = "home", "الرئيسية"
        ABOUT = "about", "نبذة"
        SERVICES = "services", "الخدمات"
        SOLUTIONS = "solutions", "الحلول"
        PROJECTS = "projects", "المشاريع"
        CONTACT = "contact", "التواصل"

    class Key(models.TextChoices):
        HERO = "hero", "الواجهة"
        INTRO = "intro", "نبذة مختصرة"
        STATS = "stats", "الإحصائيات"
        SERVICES = "services", "الخدمات الرئيسية"
        SOLUTIONS = "solutions", "الحلول حسب القطاعات"
        PROJECTS = "projects", "المشاريع المميزة"
        CASE_STUDIES = "case_studies", "دراسات الحالة"
        PROCESS = "process", "طريقة العمل"
        TECHNOLOGIES = "technologies", "التقنيات"
        TESTIMONIALS = "testimonials", "شهادات العملاء"
        POSTS = "posts", "أحدث المقالات"
        NEWSLETTER = "newsletter", "النشرة البريدية"
        CTA = "cta", "دعوة للتواصل"

    translatable_fields = ("title", "subtitle", "cta_label")

    page = models.CharField("الصفحة", max_length=20, choices=Page.choices, default=Page.HOME, db_index=True)
    key = models.CharField("المفتاح", max_length=32, choices=Key.choices, blank=True)

    title_ar = models.CharField("العنوان (عربي)", max_length=200, blank=True)
    title_en = models.CharField("العنوان (إنجليزي)", max_length=200, blank=True)
    subtitle_ar = models.TextField("الوصف (عربي)", blank=True)
    subtitle_en = models.TextField("الوصف (إنجليزي)", blank=True)
    cta_label_ar = models.CharField("نص الزر (عربي)", max_length=80, blank=True)
    cta_label_en = models.CharField("نص الزر (إنجليزي)", max_length=80, blank=True)
    cta_url = models.CharField("رابط الزر", max_length=200, blank=True)

    image = models.ForeignKey(
        "media_library.MediaFile", verbose_name="الصورة",
        related_name="+", null=True, blank=True, on_delete=models.SET_NULL,
    )

    is_visible = models.BooleanField("ظاهر", default=True, db_index=True)
    auto_hide_when_empty = models.BooleanField("إخفاء تلقائي عند الفراغ", default=True)
    config = models.JSONField("إعدادات القسم", default=dict, blank=True)

    class Meta:
        verbose_name = "قسم صفحة"
        verbose_name_plural = "أقسام الصفحات"
        ordering = ["page", "display_order"]
        constraints = [
            models.UniqueConstraint(fields=["page", "key"], name="unique_section_per_page")
        ]

    def __str__(self):
        return f"{self.get_page_display()} — {self.get_key_display()}"

    @property
    def item_limit(self) -> int:
        try:
            return int(self.config.get("limit", 6))
        except (TypeError, ValueError):
            return 6


class Stat(TranslatableMixin, OrderableModel, ActivatableModel, TimeStampedModel):
    """أرقام قسم الإحصائيات في الصفحة الرئيسية."""

    translatable_fields = ("label", "suffix")

    label_ar = models.CharField("التسمية (عربي)", max_length=80, blank=True)
    label_en = models.CharField("التسمية (إنجليزي)", max_length=80, blank=True)
    value = models.CharField("القيمة", max_length=20, blank=True)
    suffix_ar = models.CharField("اللاحقة (عربي)", max_length=20, blank=True)
    suffix_en = models.CharField("اللاحقة (إنجليزي)", max_length=20, blank=True)
    icon = models.CharField("الأيقونة", max_length=40, blank=True)

    class Meta:
        verbose_name = "إحصائية"
        verbose_name_plural = "الإحصائيات"
        ordering = ["display_order"]

    def __str__(self):
        return f"{self.value} {self.label_ar}"


class FAQ(TranslatableMixin, OrderableModel, ActivatableModel, TimeStampedModel):
    class Scope(models.TextChoices):
        GLOBAL = "global", "عام"
        SERVICE = "service", "خاص بخدمة"
        PRICING = "pricing", "الأسعار"
        PROCESS = "process", "طريقة العمل"

    translatable_fields = ("question", "answer")

    question_ar = models.CharField("السؤال (عربي)", max_length=255, blank=True)
    question_en = models.CharField("السؤال (إنجليزي)", max_length=255, blank=True)
    answer_ar = models.TextField("الإجابة (عربي)", blank=True)
    answer_en = models.TextField("الإجابة (إنجليزي)", blank=True)
    scope = models.CharField("النطاق", max_length=20, choices=Scope.choices, default=Scope.GLOBAL, db_index=True)
    service = models.ForeignKey(
        "portfolio.Service", verbose_name="الخدمة",
        related_name="faqs", null=True, blank=True, on_delete=models.CASCADE,
    )

    class Meta:
        verbose_name = "سؤال شائع"
        verbose_name_plural = "الأسئلة الشائعة"
        ordering = ["display_order"]

    def __str__(self):
        return self.question_ar[:80]


class ProcessStep(TranslatableMixin, OrderableModel, ActivatableModel, TimeStampedModel):
    """مراحل العمل المعروضة في صفحة «طريقة العمل»."""

    translatable_fields = ("title", "description", "duration")

    title_ar = models.CharField("العنوان (عربي)", max_length=120, blank=True)
    title_en = models.CharField("العنوان (إنجليزي)", max_length=120, blank=True)
    description_ar = models.TextField("الوصف (عربي)", blank=True)
    description_en = models.TextField("الوصف (إنجليزي)", blank=True)
    duration_ar = models.CharField("المدة (عربي)", max_length=60, blank=True)
    duration_en = models.CharField("المدة (إنجليزي)", max_length=60, blank=True)
    icon = models.CharField("الأيقونة", max_length=40, blank=True)
    deliverables = models.JSONField("المخرجات", default=list, blank=True)

    class Meta:
        verbose_name = "مرحلة عمل"
        verbose_name_plural = "مراحل العمل"
        ordering = ["display_order"]

    def __str__(self):
        return self.title_ar

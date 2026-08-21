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
from apps.core.utils.text import unique_slug
from apps.portfolio.enums import ProjectStatus, ProjectType, Sector


class Project(
    TranslatableMixin,
    SEOModel,
    SearchableModel,
    PublishableModel,
    OrderableModel,
    ViewCountModel,
    AuthoredModel,
    TimeStampedModel,
):
    translatable_fields = ("title", "summary", "description")
    search_source_fields = (
        "title_ar", "title_en", "summary_ar", "summary_en",
        "description_ar", "description_en", "client_name",
    )

    title_ar = models.CharField("الاسم (عربي)", max_length=160, blank=True)
    title_en = models.CharField("الاسم (إنجليزي)", max_length=160, blank=True)
    slug = models.SlugField("المعرّف", max_length=180, unique=True, blank=True)

    summary_ar = models.TextField("وصف مختصر (عربي)", max_length=400, blank=True)
    summary_en = models.TextField("وصف مختصر (إنجليزي)", max_length=400, blank=True)
    description_ar = models.TextField("الوصف الكامل (عربي)", blank=True)
    description_en = models.TextField("الوصف الكامل (إنجليزي)", blank=True)

    sector = models.CharField(
        "القطاع", max_length=20, choices=Sector.choices, default=Sector.GENERAL, db_index=True
    )
    project_type = models.CharField(
        "نوع المشروع", max_length=20, choices=ProjectType.choices, default=ProjectType.WEB,
        db_index=True,
    )
    status = models.CharField(
        "الحالة", max_length=20, choices=ProjectStatus.choices, default=ProjectStatus.COMPLETED
    )

    # ---- هوية العميل
    client_name = models.CharField("اسم العميل", max_length=160, blank=True)
    client_permission = models.BooleanField(
        "العميل يسمح بذكر اسمه", default=False,
        help_text="بدون إذن صريح يُعرض المشروع مجهّلًا.",
    )
    is_anonymized = models.BooleanField("عرض مجهّل", default=False)

    cover_image = models.ForeignKey(
        "media_library.MediaFile", verbose_name="صورة الغلاف",
        related_name="+", null=True, blank=True, on_delete=models.SET_NULL,
    )
    video_url = models.URLField("رابط الفيديو", blank=True)

    technologies = models.ManyToManyField(
        "portfolio.Technology",
        verbose_name="التقنيات",
        through="portfolio.ProjectTechnology",
        related_name="projects",
        blank=True,
    )

    live_url = models.URLField("رابط الموقع", blank=True)
    github_url = models.URLField("رابط GitHub", blank=True)
    play_store_url = models.URLField("رابط Google Play", blank=True)
    app_store_url = models.URLField("رابط App Store", blank=True)

    completed_at = models.DateField("تاريخ الإنجاز", null=True, blank=True)
    is_featured = models.BooleanField("مميز", default=False, db_index=True)

    class Meta:
        verbose_name = "مشروع"
        verbose_name_plural = "المشاريع"
        ordering = ["display_order", "-completed_at", "-created_at"]
        indexes = [models.Index(fields=["is_published", "is_featured", "display_order"])]

    def __str__(self):
        return self.title_ar or self.title_en or self.slug or f"مشروع #{self.pk}"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(self, self.title_en or self.title_ar)
        # لا يُعرض اسم العميل إطلاقًا بلا إذن صريح
        if not self.client_permission:
            self.is_anonymized = True
        super().save(*args, **kwargs)

    @property
    def public_client_name(self) -> str:
        return self.client_name if self.client_permission and not self.is_anonymized else ""


class ProjectImage(TranslatableMixin, OrderableModel, TimeStampedModel):
    translatable_fields = ("caption",)

    project = models.ForeignKey(
        Project, verbose_name="المشروع", related_name="images", on_delete=models.CASCADE
    )
    image = models.ForeignKey(
        "media_library.MediaFile", verbose_name="الصورة",
        related_name="+", null=True, blank=True, on_delete=models.SET_NULL,
    )
    caption_ar = models.CharField("الشرح (عربي)", max_length=255, blank=True)
    caption_en = models.CharField("الشرح (إنجليزي)", max_length=255, blank=True)

    class Meta:
        verbose_name = "صورة مشروع"
        verbose_name_plural = "صور المشاريع"
        ordering = ["display_order"]

    def __str__(self):
        return f"صورة {self.project.title_ar}"


class ProjectTechnology(models.Model):
    class Role(models.TextChoices):
        PRIMARY = "primary", "أساسية"
        SECONDARY = "secondary", "مساندة"

    project = models.ForeignKey(Project, related_name="technology_links", on_delete=models.CASCADE)
    technology = models.ForeignKey(
        "portfolio.Technology", related_name="project_links", on_delete=models.CASCADE
    )
    role = models.CharField("الدور", max_length=12, choices=Role.choices, default=Role.PRIMARY)

    class Meta:
        verbose_name = "تقنية مشروع"
        verbose_name_plural = "تقنيات المشاريع"
        constraints = [
            models.UniqueConstraint(
                fields=["project", "technology"], name="unique_project_technology"
            )
        ]

    def __str__(self):
        return f"{self.project.title_ar} — {self.technology.name}"


class CaseStudy(
    TranslatableMixin,
    SEOModel,
    SearchableModel,
    PublishableModel,
    ViewCountModel,
    AuthoredModel,
    TimeStampedModel,
):
    translatable_fields = (
        "title", "overview", "problem", "requirements", "challenges",
        "solution", "architecture", "results", "lessons",
    )
    search_source_fields = (
        "title_ar", "title_en", "overview_ar", "overview_en",
        "problem_ar", "problem_en", "solution_ar", "solution_en",
    )

    project = models.OneToOneField(
        Project, verbose_name="المشروع", related_name="case_study", on_delete=models.CASCADE
    )

    title_ar = models.CharField("العنوان (عربي)", max_length=200)
    title_en = models.CharField("العنوان (إنجليزي)", max_length=200, blank=True)
    slug = models.SlugField("المعرّف", max_length=220, unique=True, blank=True)

    overview_ar = models.TextField("نبذة (عربي)", blank=True)
    overview_en = models.TextField("نبذة (إنجليزي)", blank=True)
    problem_ar = models.TextField("المشكلة (عربي)", blank=True)
    problem_en = models.TextField("المشكلة (إنجليزي)", blank=True)
    requirements_ar = models.TextField("تحليل المتطلبات (عربي)", blank=True)
    requirements_en = models.TextField("تحليل المتطلبات (إنجليزي)", blank=True)
    challenges_ar = models.TextField("التحديات (عربي)", blank=True)
    challenges_en = models.TextField("التحديات (إنجليزي)", blank=True)
    solution_ar = models.TextField("الحل (عربي)", blank=True)
    solution_en = models.TextField("الحل (إنجليزي)", blank=True)
    architecture_ar = models.TextField("المعمارية (عربي)", blank=True)
    architecture_en = models.TextField("المعمارية (إنجليزي)", blank=True)
    results_ar = models.TextField("النتائج (عربي)", blank=True)
    results_en = models.TextField("النتائج (إنجليزي)", blank=True)
    lessons_ar = models.TextField("الدروس المستفادة (عربي)", blank=True)
    lessons_en = models.TextField("الدروس المستفادة (إنجليزي)", blank=True)

    diagram_image = models.ForeignKey(
        "media_library.MediaFile", verbose_name="مخطط UML أو ERD",
        related_name="+", null=True, blank=True, on_delete=models.SET_NULL,
    )
    #: [{title_ar, title_en, description_ar, description_en, duration}]
    development_phases = models.JSONField("مراحل التطوير", default=list, blank=True)
    #: [{label_ar, label_en, value, suffix}]
    metrics = models.JSONField("النتائج المقاسة", default=list, blank=True)

    testimonial = models.ForeignKey(
        "portfolio.Testimonial", verbose_name="شهادة العميل",
        related_name="case_studies", null=True, blank=True, on_delete=models.SET_NULL,
    )
    related_services = models.ManyToManyField(
        "portfolio.Service", verbose_name="الخدمات المرتبطة",
        related_name="case_studies", blank=True,
    )

    class Meta:
        verbose_name = "دراسة حالة"
        verbose_name_plural = "دراسات الحالة"
        ordering = ["-published_at", "-created_at"]

    def __str__(self):
        return self.title_ar or self.title_en or self.slug or f"دراسة حالة #{self.pk}"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(self, self.title_en or self.title_ar)
        super().save(*args, **kwargs)

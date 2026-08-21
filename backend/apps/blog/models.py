from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.core.models.base import (
    ActivatableModel,
    OrderableModel,
    SearchableModel,
    SEOModel,
    TimeStampedModel,
    TranslatableMixin,
    ViewCountModel,
)
from apps.core.utils.text import reading_time_minutes, unique_slug


class Category(TranslatableMixin, OrderableModel, ActivatableModel, TimeStampedModel):
    translatable_fields = ("name", "description")

    name_ar = models.CharField("الاسم (عربي)", max_length=100, blank=True)
    name_en = models.CharField("الاسم (إنجليزي)", max_length=100, blank=True)
    slug = models.SlugField("المعرّف", max_length=120, unique=True, blank=True)
    description_ar = models.TextField("الوصف (عربي)", blank=True)
    description_en = models.TextField("الوصف (إنجليزي)", blank=True)
    color = models.CharField("اللون", max_length=9, blank=True)

    class Meta:
        verbose_name = "تصنيف"
        verbose_name_plural = "التصنيفات"
        ordering = ["display_order", "name_ar"]

    def __str__(self):
        return self.name_ar or self.name_en or self.slug or f"تصنيف #{self.pk}"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(self, self.name_en or self.name_ar)
        super().save(*args, **kwargs)


class Tag(TranslatableMixin, TimeStampedModel):
    translatable_fields = ("name",)

    name_ar = models.CharField("الاسم (عربي)", max_length=60, blank=True)
    name_en = models.CharField("الاسم (إنجليزي)", max_length=60, blank=True)
    slug = models.SlugField("المعرّف", max_length=80, unique=True, blank=True)
    usage_count = models.PositiveIntegerField("عدد الاستخدامات", default=0, editable=False)

    class Meta:
        verbose_name = "وسم"
        verbose_name_plural = "الوسوم"
        ordering = ["-usage_count", "name_ar"]

    def __str__(self):
        return self.name_ar or self.name_en or self.slug or f"وسم #{self.pk}"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(self, self.name_en or self.name_ar)
        super().save(*args, **kwargs)


class Post(
    TranslatableMixin,
    SEOModel,
    SearchableModel,
    ViewCountModel,
    TimeStampedModel,
):
    """مقال ثنائي اللغة.

    لا يرث PublishableModel لأنه يحتاج حالات أكثر من منشور/مسودة (مراجعة،
    مجدول، مؤرشف). المنشور فعليًا = status=published و published_at ماضٍ.
    """

    class Status(models.TextChoices):
        DRAFT = "draft", "مسودة"
        IN_REVIEW = "in_review", "قيد المراجعة"
        SCHEDULED = "scheduled", "مجدول"
        PUBLISHED = "published", "منشور"
        ARCHIVED = "archived", "مؤرشف"

    translatable_fields = ("title", "excerpt", "content")
    search_source_fields = (
        "title_ar", "title_en", "excerpt_ar", "excerpt_en",
        "content_ar", "content_en",
    )

    title_ar = models.CharField("العنوان (عربي)", max_length=200, blank=True)
    title_en = models.CharField("العنوان (إنجليزي)", max_length=200, blank=True)
    slug = models.SlugField("المعرّف", max_length=220, unique=True, blank=True)

    excerpt_ar = models.TextField("الملخص (عربي)", max_length=400, blank=True)
    excerpt_en = models.TextField("الملخص (إنجليزي)", max_length=400, blank=True)
    content_ar = models.TextField("المحتوى (عربي)", blank=True)
    content_en = models.TextField("المحتوى (إنجليزي)", blank=True)

    cover_image = models.ForeignKey(
        "media_library.MediaFile", verbose_name="صورة الغلاف",
        related_name="+", null=True, blank=True, on_delete=models.SET_NULL,
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name="الكاتب",
        related_name="posts", null=True, blank=True, on_delete=models.SET_NULL,
    )
    category = models.ForeignKey(
        Category, verbose_name="التصنيف",
        related_name="posts", null=True, blank=True, on_delete=models.SET_NULL,
    )
    tags = models.ManyToManyField(Tag, verbose_name="الوسوم", related_name="posts", blank=True)

    reading_time_ar = models.PositiveSmallIntegerField("وقت القراءة (عربي)", default=0)
    reading_time_en = models.PositiveSmallIntegerField("وقت القراءة (إنجليزي)", default=0)

    status = models.CharField(
        "الحالة", max_length=12, choices=Status.choices,
        default=Status.DRAFT, db_index=True,
    )
    published_at = models.DateTimeField("تاريخ النشر", null=True, blank=True, db_index=True)
    is_featured = models.BooleanField("مميز", default=False, db_index=True)
    allow_comments = models.BooleanField("يسمح بالتعليقات", default=True)

    related_posts = models.ManyToManyField(
        "self", verbose_name="مقالات مرتبطة", blank=True, symmetrical=False
    )

    class Meta:
        verbose_name = "مقال"
        verbose_name_plural = "المقالات"
        ordering = ["-published_at", "-created_at"]
        indexes = [models.Index(fields=["status", "-published_at"])]
        permissions = [("publish_post", "نشر المقالات")]

    def __str__(self):
        return self.title_ar or self.title_en or self.slug or f"مقال #{self.pk}"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(self, self.title_en or self.title_ar)
        self.reading_time_ar = reading_time_minutes(self.content_ar)
        self.reading_time_en = reading_time_minutes(self.content_en)
        # النشر يثبّت التاريخ إن لم يُحدَّد
        if self.status == self.Status.PUBLISHED and self.published_at is None:
            self.published_at = timezone.now()
        super().save(*args, **kwargs)

    @property
    def is_live(self) -> bool:
        return (
            self.status == self.Status.PUBLISHED
            and self.published_at is not None
            and self.published_at <= timezone.now()
        )


class SavedPost(TimeStampedModel):
    """مقال حفظه عضو للقراءة لاحقًا."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name="العضو",
        related_name="saved_posts", on_delete=models.CASCADE,
    )
    post = models.ForeignKey(
        Post, verbose_name="المقال", related_name="saved_by", on_delete=models.CASCADE
    )

    class Meta:
        verbose_name = "مقال محفوظ"
        verbose_name_plural = "المقالات المحفوظة"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "post"], name="unique_saved_post")
        ]

    def __str__(self):
        return f"{self.user} — {self.post}"

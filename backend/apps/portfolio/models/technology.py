from django.db import models

from apps.core.models.base import (
    ActivatableModel,
    OrderableModel,
    TimeStampedModel,
    TranslatableMixin,
)
from apps.core.utils.text import unique_slug
from apps.portfolio.enums import TechnologyCategory


class Technology(TranslatableMixin, OrderableModel, ActivatableModel, TimeStampedModel):
    translatable_fields = ("description",)

    name = models.CharField("الاسم", max_length=80, unique=True, blank=True)
    slug = models.SlugField("المعرّف", max_length=90, unique=True, blank=True)
    category = models.CharField(
        "التصنيف", max_length=20, choices=TechnologyCategory.choices, blank=True, db_index=True
    )
    description_ar = models.TextField("الوصف (عربي)", blank=True)
    description_en = models.TextField("الوصف (إنجليزي)", blank=True)
    icon = models.CharField("الأيقونة", max_length=60, blank=True)
    color = models.CharField("اللون", max_length=9, blank=True)
    proficiency = models.PositiveSmallIntegerField(
        "مستوى الإتقان",
        default=4,
        choices=[(1, "مبتدئ"), (2, "أساسي"), (3, "متوسط"), (4, "متقدم"), (5, "خبير")],
    )
    is_featured = models.BooleanField("مميزة", default=False, db_index=True)

    class Meta:
        verbose_name = "تقنية"
        verbose_name_plural = "التقنيات"
        ordering = ["category", "display_order", "name"]

    def __str__(self):
        return self.name or self.slug or f"تقنية #{self.pk}"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = unique_slug(self, self.name)
        super().save(*args, **kwargs)

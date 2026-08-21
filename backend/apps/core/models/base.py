"""النماذج المجردة المشتركة.

تُعرَّف هنا مرة واحدة وترثها بقية النماذج في كل التطبيقات، فتمنع تكرار
الحقول والمنطق عبر عشرات النماذج.
"""

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.core.i18n import (
    DEFAULT_LANGUAGE,
    get_current_language,
    get_supported_languages,
    normalize_language,
)
from apps.core.utils.text import build_search_text


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField("تاريخ الإنشاء", auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField("تاريخ التحديث", auto_now=True)

    class Meta:
        abstract = True


class AuthoredModel(models.Model):
    """يتتبّع من أنشأ السجل ومن عدّله آخر مرة."""

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="أنشأه",
        related_name="%(app_label)s_%(class)s_created",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="عدّله",
        related_name="%(app_label)s_%(class)s_updated",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )

    class Meta:
        abstract = True


class ActivatableModel(models.Model):
    is_active = models.BooleanField("مُفعّل", default=True, db_index=True)

    class Meta:
        abstract = True


class OrderableModel(models.Model):
    display_order = models.PositiveIntegerField("الترتيب", default=0, db_index=True)

    class Meta:
        abstract = True


class PublishableModel(models.Model):
    is_published = models.BooleanField("منشور", default=False, db_index=True)
    published_at = models.DateTimeField("تاريخ النشر", null=True, blank=True, db_index=True)

    class Meta:
        abstract = True

    def publish(self, when=None, save=True):
        self.is_published = True
        self.published_at = when or self.published_at or timezone.now()
        if save:
            self.save(update_fields=["is_published", "published_at", "updated_at"])
        return self

    def unpublish(self, save=True):
        self.is_published = False
        if save:
            self.save(update_fields=["is_published", "updated_at"])
        return self

    @property
    def is_live(self) -> bool:
        """منشور فعليًا الآن — يستبعد المجدول للمستقبل."""
        if not self.is_published:
            return False
        return self.published_at is None or self.published_at <= timezone.now()


class ViewCountModel(models.Model):
    view_count = models.PositiveIntegerField("عدد المشاهدات", default=0, editable=False)

    class Meta:
        abstract = True


class SingletonModel(models.Model):
    """نموذج بسجل واحد فقط (إعدادات الموقع مثلًا)."""

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        self.pk = 1
        kwargs.pop("force_insert", None)
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        # الحذف ممنوع — الإعدادات يجب أن تبقى موجودة دائمًا
        return (0, {})

    @classmethod
    def load(cls):
        instance, _ = cls.objects.get_or_create(pk=1)
        return instance


class SEOModel(models.Model):
    """حقول SEO المستقلة لكل عنصر."""

    og_image = models.ForeignKey(
        "media_library.MediaFile",
        verbose_name="صورة المشاركة",
        related_name="+",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    seo_title_ar = models.CharField("عنوان SEO (عربي)", max_length=160, blank=True)
    seo_title_en = models.CharField("عنوان SEO (إنجليزي)", max_length=160, blank=True)
    seo_description_ar = models.TextField("وصف SEO (عربي)", max_length=320, blank=True)
    seo_description_en = models.TextField("وصف SEO (إنجليزي)", max_length=320, blank=True)

    class Meta:
        abstract = True


class SearchableModel(models.Model):
    """يوفّر بحثًا موحّدًا يعمل على SQLite وPostgreSQL بنفس النتيجة.

    الحقول المذكورة في `search_source_fields` تُطبَّع وتُدمج في `search_text`
    عند كل حفظ، والبحث يتم بـ `icontains` على نص المستخدم بعد تطبيعه.
    """

    search_text = models.TextField("نص البحث", blank=True, editable=False)

    search_source_fields: tuple[str, ...] = ()

    class Meta:
        abstract = True

    def build_search_index(self) -> str:
        values = [getattr(self, name, "") for name in self.search_source_fields]
        return build_search_text(*values)

    def save(self, *args, **kwargs):
        self.search_text = self.build_search_index()
        update_fields = kwargs.get("update_fields")
        if update_fields is not None and "search_text" not in update_fields:
            kwargs["update_fields"] = list(update_fields) + ["search_text"]
        super().save(*args, **kwargs)


class TranslatableMixin:
    """يحل الحقول ثنائية اللغة حسب لغة الطلب الحالية.

    مثال: نموذج فيه `title_ar` و`title_en` ويعلن
    `translatable_fields = ("title",)` يمكن قراءة `obj.title` منه مباشرة،
    فيُرجع النسخة المطابقة للغة الطلب مع ارتداد إلى العربية عند الفراغ.
    """

    translatable_fields: tuple[str, ...] = ()

    def tr(self, field: str, lang: str | None = None) -> str:
        language = normalize_language(lang) if lang else get_current_language()
        value = getattr(self, f"{field}_{language}", None)
        if value:
            return value
        for fallback in (DEFAULT_LANGUAGE, *get_supported_languages()):
            if fallback == language:
                continue
            alternative = getattr(self, f"{field}_{fallback}", None)
            if alternative:
                return alternative
        return ""

    def __getattr__(self, name: str):
        # يُستدعى فقط عند فشل البحث العادي عن السمة.
        if name.startswith("_"):
            raise AttributeError(name)
        fields = getattr(type(self), "translatable_fields", ())
        if name in fields:
            return self.tr(name)
        raise AttributeError(
            f"{type(self).__name__!r} object has no attribute {name!r}"
        )

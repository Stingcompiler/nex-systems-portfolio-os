"""إعدادات الموقع — كل ما يظهر للزائر يُقرأ من هنا لا من الكود."""

from django.db import models

from apps.core.constants import LANGUAGE_CHOICES, THEME_CHOICES
from apps.core.models.base import (
    ActivatableModel,
    OrderableModel,
    SingletonModel,
    TimeStampedModel,
    TranslatableMixin,
)


class SiteSettings(TranslatableMixin, SingletonModel, TimeStampedModel):
    translatable_fields = (
        "site_name",
        "tagline",
        "owner_name",
        "owner_title",
        "owner_bio",
        "address",
        "maintenance_message",
        "whatsapp_default_message",
    )

    # ---- الهوية
    site_name_ar = models.CharField("اسم الموقع (عربي)", max_length=120, default="نيكسا سيستمز", blank=True)
    site_name_en = models.CharField("اسم الموقع (إنجليزي)", max_length=120, default="NEXA SYSTEMS", blank=True)
    tagline_ar = models.CharField("الشعار النصي (عربي)", max_length=200, blank=True)
    tagline_en = models.CharField("الشعار النصي (إنجليزي)", max_length=200, blank=True)
    logo_light = models.ForeignKey(
        "media_library.MediaFile", verbose_name="الشعار (وضع فاتح)",
        related_name="+", null=True, blank=True, on_delete=models.SET_NULL,
    )
    logo_dark = models.ForeignKey(
        "media_library.MediaFile", verbose_name="الشعار (وضع داكن)",
        related_name="+", null=True, blank=True, on_delete=models.SET_NULL,
    )
    favicon = models.ForeignKey(
        "media_library.MediaFile", verbose_name="أيقونة الموقع",
        related_name="+", null=True, blank=True, on_delete=models.SET_NULL,
    )

    # ---- المالك
    owner_name_ar = models.CharField("اسم المطور (عربي)", max_length=120, blank=True)
    owner_name_en = models.CharField("اسم المطور (إنجليزي)", max_length=120, blank=True)
    owner_title_ar = models.CharField("المسمى المهني (عربي)", max_length=160, blank=True)
    owner_title_en = models.CharField("المسمى المهني (إنجليزي)", max_length=160, blank=True)
    owner_bio_ar = models.TextField("النبذة (عربي)", blank=True)
    owner_bio_en = models.TextField("النبذة (إنجليزي)", blank=True)
    owner_photo = models.ForeignKey(
        "media_library.MediaFile", verbose_name="صورة المطور",
        related_name="+", null=True, blank=True, on_delete=models.SET_NULL,
    )
    cv_ar = models.ForeignKey(
        "media_library.MediaFile", verbose_name="السيرة الذاتية (عربي)",
        related_name="+", null=True, blank=True, on_delete=models.SET_NULL,
    )
    cv_en = models.ForeignKey(
        "media_library.MediaFile", verbose_name="السيرة الذاتية (إنجليزي)",
        related_name="+", null=True, blank=True, on_delete=models.SET_NULL,
    )

    # ---- التواصل
    email = models.EmailField("البريد", blank=True)
    phone = models.CharField("الهاتف", max_length=32, blank=True)
    whatsapp = models.CharField("رقم واتساب", max_length=32, blank=True)
    whatsapp_default_message_ar = models.CharField(
        "رسالة واتساب الافتراضية (عربي)", max_length=255, blank=True
    )
    whatsapp_default_message_en = models.CharField(
        "رسالة واتساب الافتراضية (إنجليزي)", max_length=255, blank=True
    )
    address_ar = models.CharField("العنوان (عربي)", max_length=200, blank=True)
    address_en = models.CharField("العنوان (إنجليزي)", max_length=200, blank=True)
    country = models.CharField("الدولة", max_length=64, blank=True)
    city = models.CharField("المدينة", max_length=64, blank=True)

    # ---- التشغيل
    default_language = models.CharField(
        "اللغة الافتراضية", max_length=5, choices=LANGUAGE_CHOICES, default="ar"
    )
    default_theme = models.CharField(
        "الوضع الافتراضي", max_length=10, choices=THEME_CHOICES, default="system"
    )
    currency = models.CharField("العملة", max_length=8, default="USD", blank=True)

    # ---- الصيانة
    maintenance_mode = models.BooleanField("وضع الصيانة", default=False)
    maintenance_message_ar = models.TextField("رسالة الصيانة (عربي)", blank=True)
    maintenance_message_en = models.TextField("رسالة الصيانة (إنجليزي)", blank=True)

    # ---- التحليلات والبريد
    analytics_provider = models.CharField(
        "مزود التحليلات", max_length=20,
        choices=[("none", "بدون"), ("plausible", "Plausible"), ("umami", "Umami"), ("ga4", "Google Analytics")],
        default="none",
    )
    analytics_site_id = models.CharField("معرّف الموقع في التحليلات", max_length=120, blank=True)
    analytics_script_url = models.URLField("رابط سكربت التحليلات", blank=True)
    email_from_name = models.CharField("اسم المرسل", max_length=120, blank=True)
    email_from_address = models.EmailField("بريد المرسل", blank=True)

    class Meta:
        verbose_name = "إعدادات الموقع"
        verbose_name_plural = "إعدادات الموقع"

    def __str__(self):
        return self.tr("site_name") or "إعدادات الموقع"


class SEOSettings(TranslatableMixin, SingletonModel, TimeStampedModel):
    translatable_fields = ("default_seo_title", "default_seo_description")

    default_seo_title_ar = models.CharField("عنوان SEO الافتراضي (عربي)", max_length=160, blank=True)
    default_seo_title_en = models.CharField("عنوان SEO الافتراضي (إنجليزي)", max_length=160, blank=True)
    default_seo_description_ar = models.TextField("وصف SEO الافتراضي (عربي)", max_length=320, blank=True)
    default_seo_description_en = models.TextField("وصف SEO الافتراضي (إنجليزي)", max_length=320, blank=True)
    default_og_image = models.ForeignKey(
        "media_library.MediaFile", verbose_name="صورة المشاركة الافتراضية",
        related_name="+", null=True, blank=True, on_delete=models.SET_NULL,
    )
    twitter_handle = models.CharField("حساب تويتر", max_length=64, blank=True)
    google_verification = models.CharField("تحقق Google", max_length=120, blank=True)
    bing_verification = models.CharField("تحقق Bing", max_length=120, blank=True)
    robots_txt = models.TextField("محتوى robots.txt الإضافي", blank=True)

    class Meta:
        verbose_name = "إعدادات SEO"
        verbose_name_plural = "إعدادات SEO"

    def __str__(self):
        return "إعدادات SEO"


class SocialLink(OrderableModel, ActivatableModel, TimeStampedModel):
    class Platform(models.TextChoices):
        GITHUB = "github", "GitHub"
        LINKEDIN = "linkedin", "LinkedIn"
        X = "x", "X"
        FACEBOOK = "facebook", "Facebook"
        INSTAGRAM = "instagram", "Instagram"
        YOUTUBE = "youtube", "YouTube"
        TELEGRAM = "telegram", "Telegram"
        WHATSAPP = "whatsapp", "WhatsApp"
        EMAIL = "email", "البريد"
        OTHER = "other", "أخرى"

    platform = models.CharField("المنصة", max_length=20, choices=Platform.choices, blank=True)
    label = models.CharField("التسمية", max_length=60, blank=True)
    url = models.URLField("الرابط", max_length=300, blank=True)

    class Meta:
        verbose_name = "رابط تواصل"
        verbose_name_plural = "روابط التواصل"
        ordering = ["display_order", "platform"]

    def __str__(self):
        return f"{self.get_platform_display()}"

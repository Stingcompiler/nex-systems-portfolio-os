"""النشرة البريدية: المشتركون والاهتمامات والقوالب والحملات.

الاشتراك بتأكيد مزدوج (Double Opt-in): لا يُرسَل شيء إلى بريد لم يؤكّد
صاحبه رغبته صراحة. كل رسالة حملة تحمل رابط إلغاء اشتراك موقّعًا فريدًا
يعمل بنقرة واحدة دون تسجيل دخول.
"""

import secrets
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.core.models.base import (
    ActivatableModel,
    AuthoredModel,
    OrderableModel,
    TimeStampedModel,
    TranslatableMixin,
)


def _token() -> str:
    return secrets.token_urlsafe(32)


class Interest(TranslatableMixin, OrderableModel, models.Model):
    """اهتمام يختاره المشترك ليستقبل ما يخصه فقط."""

    translatable_fields = ("name", "description")

    key = models.SlugField("المفتاح", max_length=40, unique=True)
    name_ar = models.CharField("الاسم (عربي)", max_length=80)
    name_en = models.CharField("الاسم (إنجليزي)", max_length=80, blank=True)
    description_ar = models.CharField("الوصف (عربي)", max_length=200, blank=True)
    description_en = models.CharField("الوصف (إنجليزي)", max_length=200, blank=True)

    class Meta:
        verbose_name = "اهتمام"
        verbose_name_plural = "الاهتمامات"
        ordering = ["display_order", "key"]

    def __str__(self):
        return self.name_ar or self.key


#: الاهتمامات الثابتة — تُزرع عند أول تشغيل ويُعتمد عليها في ربط المحتوى بالحملات
DEFAULT_INTERESTS = [
    ("new_projects", "مشاريع جديدة", "New projects",
     "عند نشر مشروع جديد في المعرض", "When a new project is published"),
    ("new_services", "خدمات جديدة", "New services",
     "عند إضافة خدمة أو حل جديد", "When a new service or solution is added"),
    ("articles", "المقالات", "Articles",
     "أحدث مقالات المدونة", "The latest blog articles"),
    ("offers", "العروض", "Offers",
     "عروض وخصومات موسمية", "Seasonal offers and discounts"),
    ("product_updates", "تحديثات المنتجات", "Product updates",
     "تحديثات الأنظمة والمنتجات", "System and product updates"),
]


class Subscriber(TimeStampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "بانتظار التأكيد"
        ACTIVE = "active", "نشط"
        UNSUBSCRIBED = "unsubscribed", "ألغى الاشتراك"
        BOUNCED = "bounced", "مرتد"
        COMPLAINED = "complained", "اشتكى"

    class Source(models.TextChoices):
        FOOTER = "footer", "التذييل"
        HOME = "home", "الرئيسية"
        BLOG_POST = "blog_post", "مقال"
        POPUP = "popup", "نافذة منبثقة"
        MANUAL = "manual", "يدوي"
        MEMBER_SIGNUP = "member_signup", "تسجيل عضو"
        MEMBER_AREA = "member_area", "صفحة العضو"

    email = models.EmailField("البريد", unique=True)
    name = models.CharField("الاسم", max_length=120, blank=True)
    language = models.CharField("اللغة", max_length=2, default="ar", db_index=True)
    interests = models.ManyToManyField(
        Interest, verbose_name="الاهتمامات", related_name="subscribers", blank=True
    )
    status = models.CharField(
        "الحالة", max_length=14, choices=Status.choices,
        default=Status.PENDING, db_index=True,
    )
    source = models.CharField(
        "المصدر", max_length=16, choices=Source.choices, default=Source.HOME
    )

    confirm_token = models.CharField("رمز التأكيد", max_length=64, blank=True, db_index=True)
    confirm_sent_at = models.DateTimeField("آخر إرسال للتأكيد", null=True, blank=True)
    confirmed_at = models.DateTimeField("تاريخ التأكيد", null=True, blank=True)
    #: دائم وفريد — يُضمَّن في كل رسالة لإلغاء الاشتراك أو تعديل التفضيلات
    unsubscribe_token = models.CharField(
        "رمز إلغاء الاشتراك", max_length=64, unique=True, default=_token
    )
    unsubscribed_at = models.DateTimeField("تاريخ الإلغاء", null=True, blank=True)

    consent_ip = models.GenericIPAddressField("IP الموافقة", null=True, blank=True)
    consent_at = models.DateTimeField("تاريخ الموافقة", null=True, blank=True)

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name="العضو",
        related_name="subscriptions", null=True, blank=True, on_delete=models.SET_NULL,
    )

    class Meta:
        verbose_name = "مشترك"
        verbose_name_plural = "المشتركون"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "language"])]
        permissions = [("export_subscribers", "تصدير المشتركين")]

    def __str__(self):
        return self.email

    @property
    def is_active(self) -> bool:
        return self.status == self.Status.ACTIVE

    def issue_confirm_token(self) -> str:
        self.confirm_token = _token()
        self.confirm_sent_at = timezone.now()
        return self.confirm_token

    @property
    def confirm_token_expired(self) -> bool:
        if not self.confirm_sent_at:
            return True
        hours = getattr(settings, "NEWSLETTER_CONFIRM_HOURS", 48)
        return timezone.now() - self.confirm_sent_at > timedelta(hours=hours)

    def activate(self, ip: str | None = None):
        now = timezone.now()
        self.status = self.Status.ACTIVE
        self.confirmed_at = now
        self.consent_at = now
        self.consent_ip = ip
        self.confirm_token = ""
        self.unsubscribed_at = None
        self.save(update_fields=[
            "status", "confirmed_at", "consent_at", "consent_ip",
            "confirm_token", "unsubscribed_at", "updated_at",
        ])

    def unsubscribe(self):
        self.status = self.Status.UNSUBSCRIBED
        self.unsubscribed_at = timezone.now()
        self.save(update_fields=["status", "unsubscribed_at", "updated_at"])


class EmailTemplate(TranslatableMixin, ActivatableModel, TimeStampedModel):
    """قالب HTML للحملات. `{{ content }}` و`{{ unsubscribe_url }}` إلزاميان."""

    translatable_fields = ("subject", "html")

    name = models.CharField("الاسم", max_length=120)
    key = models.SlugField("المفتاح", max_length=60, unique=True)
    subject_ar = models.CharField("الموضوع الافتراضي (عربي)", max_length=200, blank=True)
    subject_en = models.CharField("الموضوع الافتراضي (إنجليزي)", max_length=200, blank=True)
    html_ar = models.TextField("HTML (عربي)", blank=True)
    html_en = models.TextField("HTML (إنجليزي)", blank=True)
    #: أسماء المتغيرات المتاحة داخل القالب — للعرض في اللوحة فقط
    variables = models.JSONField("المتغيرات", default=list, blank=True)

    class Meta:
        verbose_name = "قالب بريد"
        verbose_name_plural = "قوالب البريد"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Campaign(AuthoredModel, TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "مسودة"
        SCHEDULED = "scheduled", "مجدولة"
        SENDING = "sending", "قيد الإرسال"
        SENT = "sent", "أُرسلت"
        FAILED = "failed", "فشلت"
        CANCELLED = "cancelled", "أُلغيت"

    class TargetLanguage(models.TextChoices):
        AR = "ar", "العربية"
        EN = "en", "الإنجليزية"
        ALL = "all", "الكل"

    name = models.CharField("الاسم الداخلي", max_length=160)
    subject_ar = models.CharField("الموضوع (عربي)", max_length=200, blank=True)
    subject_en = models.CharField("الموضوع (إنجليزي)", max_length=200, blank=True)
    #: نص عادي بفقرات — يُعرض كفقرات لا كـ HTML، فلا سطح حقن
    content_ar = models.TextField("المحتوى (عربي)", blank=True)
    content_en = models.TextField("المحتوى (إنجليزي)", blank=True)
    image = models.ForeignKey(
        "media_library.MediaFile", verbose_name="الصورة",
        null=True, blank=True, on_delete=models.SET_NULL, related_name="+",
    )
    cta_label_ar = models.CharField("نص الزر (عربي)", max_length=80, blank=True)
    cta_label_en = models.CharField("نص الزر (إنجليزي)", max_length=80, blank=True)
    cta_url = models.URLField("رابط الزر", blank=True)
    template = models.ForeignKey(
        EmailTemplate, verbose_name="القالب",
        null=True, blank=True, on_delete=models.SET_NULL, related_name="campaigns",
    )

    target_language = models.CharField(
        "اللغة المستهدفة", max_length=3,
        choices=TargetLanguage.choices, default=TargetLanguage.ALL,
    )
    target_interests = models.ManyToManyField(
        Interest, verbose_name="الاهتمامات المستهدفة", related_name="campaigns", blank=True,
        help_text="فارغ = كل المشتركين النشطين",
    )

    status = models.CharField(
        "الحالة", max_length=10, choices=Status.choices,
        default=Status.DRAFT, db_index=True,
    )
    scheduled_at = models.DateTimeField("موعد الإرسال", null=True, blank=True, db_index=True)
    started_at = models.DateTimeField("بداية الإرسال", null=True, blank=True)
    sent_at = models.DateTimeField("اكتمال الإرسال", null=True, blank=True)
    last_activity_at = models.DateTimeField("آخر نشاط إرسال", null=True, blank=True)

    total_recipients = models.PositiveIntegerField("إجمالي المستلمين", default=0)
    sent_count = models.PositiveIntegerField("أُرسل", default=0)
    failed_count = models.PositiveIntegerField("فشل", default=0)
    open_count = models.PositiveIntegerField("فتح", default=0)
    click_count = models.PositiveIntegerField("نقر", default=0)
    unsubscribe_count = models.PositiveIntegerField("إلغاء اشتراك", default=0)

    #: مصدر الحملة إن أُنشئت من محتوى منشور (مقال/مشروع/خدمة)
    source_model = models.CharField("نموذج المصدر", max_length=32, blank=True)
    source_id = models.PositiveIntegerField("معرّف المصدر", null=True, blank=True)

    class Meta:
        verbose_name = "حملة"
        verbose_name_plural = "الحملات"
        ordering = ["-created_at"]
        permissions = [("send_campaign", "إرسال الحملات")]

    def __str__(self):
        return self.name

    @property
    def is_editable(self) -> bool:
        return self.status in (self.Status.DRAFT, self.Status.SCHEDULED)

    def subject_for(self, language: str) -> str:
        return (getattr(self, f"subject_{language}", "") or self.subject_ar
                or self.subject_en or self.name)

    def content_for(self, language: str) -> str:
        return (getattr(self, f"content_{language}", "") or self.content_ar
                or self.content_en)


class CampaignRecipient(models.Model):
    """سجل مستلم واحد لحملة واحدة — يجعل الإرسال قابلًا للاستئناف بلا تكرار."""

    class Status(models.TextChoices):
        PENDING = "pending", "بانتظار الإرسال"
        SENT = "sent", "أُرسل"
        FAILED = "failed", "فشل"
        BOUNCED = "bounced", "مرتد"

    campaign = models.ForeignKey(
        Campaign, verbose_name="الحملة", related_name="recipients", on_delete=models.CASCADE
    )
    subscriber = models.ForeignKey(
        Subscriber, verbose_name="المشترك", related_name="campaign_recipients",
        on_delete=models.CASCADE,
    )
    #: رمز فريد لتتبع الفتح والنقر لهذا المستلم دون كشف بريده
    token = models.CharField("رمز التتبع", max_length=64, unique=True, default=_token)
    status = models.CharField(
        "الحالة", max_length=8, choices=Status.choices,
        default=Status.PENDING, db_index=True,
    )
    sent_at = models.DateTimeField("تاريخ الإرسال", null=True, blank=True)
    error_message = models.CharField("رسالة الخطأ", max_length=255, blank=True)
    opened_at = models.DateTimeField("أول فتح", null=True, blank=True)
    clicked_at = models.DateTimeField("أول نقر", null=True, blank=True)

    class Meta:
        verbose_name = "مستلم حملة"
        verbose_name_plural = "مستلمو الحملات"
        constraints = [
            models.UniqueConstraint(
                fields=["campaign", "subscriber"], name="uniq_campaign_subscriber"
            )
        ]
        indexes = [models.Index(fields=["campaign", "status"])]

    def __str__(self):
        return f"{self.campaign_id} → {self.subscriber_id}"


#: مراجع على مستوى الوحدة لتسمية تعدادات OpenAPI
SUBSCRIBER_STATUS_CHOICES = Subscriber.Status.choices
SUBSCRIBER_SOURCE_CHOICES = Subscriber.Source.choices
CAMPAIGN_STATUS_CHOICES = Campaign.Status.choices
TARGET_LANGUAGE_CHOICES = Campaign.TargetLanguage.choices
RECIPIENT_STATUS_CHOICES = CampaignRecipient.Status.choices

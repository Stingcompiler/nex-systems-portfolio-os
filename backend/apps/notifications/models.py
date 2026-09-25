from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.core.models.base import TranslatableMixin


class Notification(TranslatableMixin, models.Model):
    """إشعار داخل لوحة التحكم.

    `recipient` فارغ يعني إشعارًا لكل مستخدمي اللوحة — أغلب الأحداث
    (طلب مشروع، تعليق، مشترك) تخص الفريق لا شخصًا بعينه.
    """

    class Type(models.TextChoices):
        PROJECT_REQUEST = "project_request", "طلب مشروع"
        CONTACT_MESSAGE = "contact_message", "رسالة تواصل"
        NEW_MEMBER = "new_member", "عضو جديد"
        NEW_COMMENT = "new_comment", "تعليق جديد"
        COMMENT_REPORT = "comment_report", "بلاغ عن تعليق"
        NEW_SUBSCRIBER = "new_subscriber", "مشترك جديد"
        EMAIL_FAILED = "email_failed", "فشل إرسال بريد"
        FOLLOW_UP_DUE = "follow_up_due", "موعد متابعة"
        POST_IN_REVIEW = "post_in_review", "مقال بانتظار المراجعة"
        COMMENT_REPLY = "comment_reply", "رد على تعليقك"
        SYSTEM = "system", "نظام"

    translatable_fields = ("title", "message")

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="المستقبِل",
        related_name="notifications",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        help_text="فارغ = لكل مستخدمي لوحة التحكم",
    )
    type = models.CharField("النوع", max_length=32, choices=Type.choices, db_index=True)

    title_ar = models.CharField("العنوان (عربي)", max_length=200)
    title_en = models.CharField("العنوان (إنجليزي)", max_length=200, blank=True)
    message_ar = models.TextField("النص (عربي)", blank=True)
    message_en = models.TextField("النص (إنجليزي)", blank=True)

    #: مسار داخل لوحة التحكم يفتح العنصر المرتبط
    link = models.CharField("الرابط", max_length=255, blank=True)
    model_name = models.CharField("النموذج", max_length=64, blank=True)
    object_id = models.CharField("معرّف الكائن", max_length=64, blank=True)

    is_read = models.BooleanField("مقروء", default=False, db_index=True)
    read_at = models.DateTimeField("تاريخ القراءة", null=True, blank=True)
    created_at = models.DateTimeField("التاريخ", auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "إشعار"
        verbose_name_plural = "الإشعارات"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["recipient", "is_read", "-created_at"]),
        ]

    def __str__(self):
        return self.title_ar

    def mark_read(self):
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=["is_read", "read_at"])
        return self

    @classmethod
    def notify(
        cls,
        notification_type: str,
        title_ar: str,
        *,
        title_en: str = "",
        message_ar: str = "",
        message_en: str = "",
        link: str = "",
        instance=None,
        recipient=None,
    ) -> "Notification":
        """ينشئ إشعارًا ويرسله إلى أجهزة الفريق إن كان من الأنواع العاجلة."""
        notification = cls.objects.create(
            recipient=recipient,
            type=notification_type,
            title_ar=title_ar[:200],
            title_en=title_en[:200],
            message_ar=message_ar,
            message_en=message_en,
            link=link[:255],
            model_name=instance.__class__.__name__ if instance is not None else "",
            object_id=str(getattr(instance, "pk", "") or "") if instance is not None else "",
        )
        from apps.notifications.push import queue_push

        queue_push(notification)
        return notification

    @classmethod
    def visible_to(cls, user):
        """إشعارات المستخدم: الموجّهة إليه، والعامة إن كان من فريق اللوحة."""
        if not (user and user.is_authenticated):
            return cls.objects.none()

        queryset = cls.objects.filter(recipient=user)
        if user.is_superuser or getattr(user, "is_dashboard_user", False):
            queryset = cls.objects.filter(
                models.Q(recipient=user) | models.Q(recipient__isnull=True)
            )
        return queryset.select_related("recipient")


class PushSubscription(models.Model):
    """جهاز فعّل إشعارات المتصفح (Web Push) لعضو في فريق اللوحة.

    ``endpoint`` عنوان خدمة الإشعارات لدى المتصفح (Google/Mozilla/Apple)،
    والمفتاحان يشفّران محتوى الإشعار فلا يقرؤه وسيط الخدمة.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name="المستخدم",
        related_name="push_subscriptions", on_delete=models.CASCADE,
    )
    endpoint = models.URLField("عنوان الاشتراك", max_length=600, unique=True)
    p256dh = models.CharField("مفتاح التشفير", max_length=200)
    auth = models.CharField("مفتاح المصادقة", max_length=100)
    user_agent = models.CharField("المتصفح", max_length=200, blank=True)
    created_at = models.DateTimeField("تاريخ التفعيل", auto_now_add=True)
    last_used_at = models.DateTimeField("آخر إرسال", null=True, blank=True)

    class Meta:
        verbose_name = "اشتراك إشعارات"
        verbose_name_plural = "اشتراكات الإشعارات"

    def __str__(self):
        return f"{self.user} — {self.user_agent[:40]}"


class PushKeys(models.Model):
    """مفتاحا VAPID للموقع: يُولَّدان مرة واحدة ويُحفظان.

    المتصفح يربط كل اشتراك بالمفتاح العام؛ تغييره يُبطل الاشتراكات كلها،
    لذلك يُحفظ في قاعدة البيانات لا في ذاكرة العملية — ولا يحتاج إعدادًا
    يدويًا في بيئة الاستضافة.
    """

    public_key = models.CharField("المفتاح العام", max_length=200)
    private_pem = models.TextField("المفتاح الخاص")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "مفاتيح الإشعارات"
        verbose_name_plural = "مفاتيح الإشعارات"

    @classmethod
    def load(cls) -> "PushKeys":
        keys = cls.objects.order_by("pk").first()
        if keys is not None:
            return keys

        import base64

        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.asymmetric import ec

        private = ec.generate_private_key(ec.SECP256R1())
        public_raw = private.public_key().public_bytes(
            serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
        )
        pem = private.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        ).decode()
        return cls.objects.create(
            public_key=base64.urlsafe_b64encode(public_raw).decode().rstrip("="),
            private_pem=pem,
        )

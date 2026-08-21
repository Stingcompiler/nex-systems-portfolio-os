from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.core.models.base import TimeStampedModel


class Comment(TimeStampedModel):
    """تعليق على مقال.

    يقبل التعليق من عضو مسجّل أو من زائر بالاسم والبريد. لا يظهر أي تعليق
    قبل موافقة المدير. البريد لا يُعاد أبدًا في أي استجابة عامة.
    """

    class Status(models.TextChoices):
        PENDING = "pending", "قيد المراجعة"
        APPROVED = "approved", "معتمد"
        REJECTED = "rejected", "مرفوض"
        SPAM = "spam", "سبام"

    post = models.ForeignKey(
        "blog.Post", verbose_name="المقال", related_name="comments", on_delete=models.CASCADE
    )
    parent = models.ForeignKey(
        "self", verbose_name="ردًا على", related_name="replies",
        null=True, blank=True, on_delete=models.CASCADE,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name="العضو",
        related_name="comments", null=True, blank=True, on_delete=models.SET_NULL,
    )
    guest_name = models.CharField("اسم الزائر", max_length=80, blank=True)
    guest_email = models.EmailField("بريد الزائر", blank=True)

    content = models.TextField("النص", max_length=3000, blank=True)
    status = models.CharField(
        "الحالة", max_length=10, choices=Status.choices,
        default=Status.PENDING, db_index=True,
    )
    notify_on_reply = models.BooleanField("إشعار عند الرد", default=True)

    ip_address = models.GenericIPAddressField("عنوان IP", null=True, blank=True)
    user_agent = models.CharField("المتصفح", max_length=255, blank=True)

    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name="اعتمده",
        related_name="approved_comments", null=True, blank=True, on_delete=models.SET_NULL,
    )
    approved_at = models.DateTimeField("تاريخ الاعتماد", null=True, blank=True)

    class Meta:
        verbose_name = "تعليق"
        verbose_name_plural = "التعليقات"
        ordering = ["created_at"]
        indexes = [models.Index(fields=["post", "status", "created_at"])]
        permissions = [("approve_comment", "اعتماد التعليقات")]

    def __str__(self):
        return f"{self.author_name}: {self.content[:40]}"

    @property
    def author_name(self) -> str:
        if self.user_id:
            return self.user.full_name
        return self.guest_name or "زائر"

    @property
    def author_email(self) -> str:
        """للاستخدام الداخلي فقط — لا يُعاد في الاستجابات العامة."""
        return self.user.email if self.user_id else self.guest_email

    @property
    def is_reply(self) -> bool:
        return self.parent_id is not None

    def approve(self, by=None):
        self.status = self.Status.APPROVED
        self.approved_by = by
        self.approved_at = timezone.now()
        self.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])


class CommentReport(TimeStampedModel):
    """بلاغ عن تعليق مسيء أو مزعج."""

    class Reason(models.TextChoices):
        SPAM = "spam", "سبام"
        OFFENSIVE = "offensive", "مسيء"
        OFF_TOPIC = "off_topic", "خارج الموضوع"
        OTHER = "other", "أخرى"

    class Status(models.TextChoices):
        OPEN = "open", "مفتوح"
        RESOLVED = "resolved", "تمت المعالجة"
        DISMISSED = "dismissed", "مرفوض"

    comment = models.ForeignKey(
        Comment, verbose_name="التعليق", related_name="reports", on_delete=models.CASCADE
    )
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name="المبلِّغ",
        related_name="comment_reports", null=True, blank=True, on_delete=models.SET_NULL,
    )
    reporter_email = models.EmailField("بريد المبلِّغ", blank=True)
    reason = models.CharField("السبب", max_length=12, choices=Reason.choices, blank=True)
    note = models.TextField("ملاحظة", blank=True)
    status = models.CharField(
        "الحالة", max_length=12, choices=Status.choices,
        default=Status.OPEN, db_index=True,
    )
    ip_address = models.GenericIPAddressField("عنوان IP", null=True, blank=True)

    class Meta:
        verbose_name = "بلاغ تعليق"
        verbose_name_plural = "بلاغات التعليقات"
        ordering = ["-created_at"]

    def __str__(self):
        return f"بلاغ {self.get_reason_display()} على #{self.comment_id}"


class BlockedEmail(TimeStampedModel):
    """بريد أو نطاق محظور من التعليق."""

    value = models.CharField(
        "البريد أو النطاق", max_length=254, unique=True, blank=True,
        help_text="بريد كامل مثل spam@x.com أو نطاق مثل @spam.com",
    )
    reason = models.CharField("السبب", max_length=200, blank=True)
    blocked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name="حظره",
        related_name="blocked_emails", null=True, blank=True, on_delete=models.SET_NULL,
    )

    class Meta:
        verbose_name = "بريد محظور"
        verbose_name_plural = "البريد المحظور"
        ordering = ["-created_at"]

    def __str__(self):
        return self.value

    @classmethod
    def is_blocked(cls, email: str) -> bool:
        if not email:
            return False
        email = email.lower().strip()
        domain = "@" + email.split("@")[-1] if "@" in email else ""
        return cls.objects.filter(
            models.Q(value__iexact=email) | models.Q(value__iexact=domain)
        ).exists()


#: مراجع على مستوى الوحدة لتسمية تعدادات OpenAPI (لا تمر عبر فئات متداخلة)
COMMENT_STATUS_CHOICES = Comment.Status.choices
REPORT_REASON_CHOICES = CommentReport.Reason.choices
REPORT_STATUS_CHOICES = CommentReport.Status.choices

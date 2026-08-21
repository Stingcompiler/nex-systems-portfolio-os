"""نماذج النظام: سجل التدقيق، التحويلات، والصلاحيات المخصصة."""

from django.conf import settings
from django.db import models

from apps.core.models.base import TimeStampedModel


class AuditLog(models.Model):
    """سجل كامل لكل عملية كتابة أو حدث أمني في المنصة."""

    class Action(models.TextChoices):
        CREATE = "create", "إنشاء"
        UPDATE = "update", "تعديل"
        DELETE = "delete", "حذف"
        PUBLISH = "publish", "نشر"
        UNPUBLISH = "unpublish", "إلغاء نشر"
        LOGIN = "login", "تسجيل دخول"
        LOGIN_FAILED = "login_failed", "محاولة دخول فاشلة"
        LOGOUT = "logout", "تسجيل خروج"
        PASSWORD_CHANGE = "password_change", "تغيير كلمة المرور"
        PASSWORD_RESET = "password_reset", "استعادة كلمة المرور"
        EMAIL_VERIFIED = "email_verified", "تأكيد البريد"
        ACCOUNT_DELETED = "account_deleted", "حذف حساب"
        EXPORT = "export", "تصدير"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="المستخدم",
        related_name="audit_logs",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    action = models.CharField("الإجراء", max_length=32, choices=Action.choices, db_index=True)
    model_name = models.CharField("النموذج", max_length=64, blank=True, db_index=True)
    object_id = models.CharField("معرّف الكائن", max_length=64, blank=True, db_index=True)
    object_repr = models.CharField("وصف الكائن", max_length=255, blank=True)
    changes = models.JSONField("التغييرات", default=dict, blank=True)
    ip_address = models.GenericIPAddressField("عنوان IP", null=True, blank=True)
    user_agent = models.CharField("متصفح المستخدم", max_length=255, blank=True)
    created_at = models.DateTimeField("التاريخ", auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "سجل تدقيق"
        verbose_name_plural = "سجلات التدقيق"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["model_name", "object_id"]),
            models.Index(fields=["user", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.get_action_display()} — {self.object_repr or self.model_name}"


class Redirect(TimeStampedModel):
    """تحويلات المسارات — تُنشأ آليًا عند تغيير slug منشور."""

    old_path = models.CharField("المسار القديم", max_length=255, unique=True)
    new_path = models.CharField("المسار الجديد", max_length=255)
    status_code = models.PositiveSmallIntegerField(
        "رمز الحالة",
        default=301,
        choices=[(301, "301 دائم"), (302, "302 مؤقت")],
    )
    hits = models.PositiveIntegerField("عدد الاستخدامات", default=0, editable=False)
    is_active = models.BooleanField("مُفعّل", default=True, db_index=True)
    note = models.CharField("ملاحظة", max_length=255, blank=True)

    class Meta:
        verbose_name = "تحويل"
        verbose_name_plural = "التحويلات"
        ordering = ["old_path"]

    def __str__(self):
        return f"{self.old_path} → {self.new_path}"


class SystemPermission(models.Model):
    """حامل الصلاحيات المخصصة غير المرتبطة بنموذج بعينه.

    نموذج غير مُدار (لا جدول له) — وجوده فقط لتسجيل الصلاحيات في
    `auth_permission` كي تُسنَد إلى المجموعات.
    """

    class Meta:
        managed = False
        default_permissions = ()
        verbose_name = "صلاحية نظام"
        verbose_name_plural = "صلاحيات النظام"
        permissions = [
            ("manage_settings", "إدارة إعدادات الموقع"),
            ("manage_seo", "إدارة إعدادات SEO"),
            ("view_analytics", "عرض التحليلات"),
            ("view_auditlog_full", "عرض سجل التدقيق الكامل"),
            ("manage_users", "إدارة المستخدمين والأدوار"),
            ("manage_media", "إدارة مكتبة الوسائط"),
        ]

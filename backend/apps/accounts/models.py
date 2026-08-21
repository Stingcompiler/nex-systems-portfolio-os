from datetime import timedelta

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone

from apps.accounts.managers import UserManager
from apps.accounts.roles import STAFF_ROLES, Role
from apps.core.constants import LANGUAGE_CHOICES
from apps.core.models.base import TimeStampedModel
from apps.core.utils.tokens import generate_token

#: عدد المحاولات الفاشلة التي تُفعّل القفل المؤقت
LOCKOUT_THRESHOLD = 10
#: مدة النافذة التي تُحسب فيها المحاولات، ومدة القفل نفسها
LOCKOUT_WINDOW_MINUTES = 15


class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField("البريد الإلكتروني", unique=True, db_index=True)
    full_name = models.CharField("الاسم الكامل", max_length=120, blank=True)
    phone = models.CharField("الهاتف", max_length=32, blank=True)
    avatar = models.ImageField(
        "الصورة الشخصية", upload_to="avatars/%Y/%m/", blank=True, null=True
    )
    role = models.CharField(
        "الدور", max_length=32, choices=Role.choices, default=Role.MEMBER, db_index=True
    )
    preferred_language = models.CharField(
        "اللغة المفضلة", max_length=5, choices=LANGUAGE_CHOICES, default="ar"
    )
    is_email_verified = models.BooleanField("البريد مؤكَّد", default=False)
    is_active = models.BooleanField("نشط", default=True)
    is_staff = models.BooleanField("موظف", default=False)
    last_login_ip = models.GenericIPAddressField("آخر IP للدخول", null=True, blank=True)
    date_joined = models.DateTimeField("تاريخ التسجيل", default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "email"
    EMAIL_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]

    class Meta:
        verbose_name = "مستخدم"
        verbose_name_plural = "المستخدمون"
        ordering = ["-date_joined"]

    def __str__(self):
        return f"{self.full_name} <{self.email}>"

    def save(self, *args, **kwargs):
        self.email = self.email.lower().strip()
        # الأدوار الإدارية تمنح حق الدخول إلى لوحة التحكم تلقائيًا
        if self.role in STAFF_ROLES:
            self.is_staff = True
        elif not self.is_superuser:
            self.is_staff = False
        super().save(*args, **kwargs)

    def get_full_name(self) -> str:
        return self.full_name

    def get_short_name(self) -> str:
        return self.full_name.split(" ")[0] if self.full_name else self.email

    @property
    def is_dashboard_user(self) -> bool:
        return self.is_superuser or self.role in STAFF_ROLES


class MemberProfile(TimeStampedModel):
    user = models.OneToOneField(
        User, verbose_name="المستخدم", related_name="member_profile",
        on_delete=models.CASCADE,
    )
    bio_ar = models.TextField("نبذة (عربي)", blank=True)
    bio_en = models.TextField("نبذة (إنجليزي)", blank=True)
    website = models.URLField("الموقع", blank=True)
    country = models.CharField("الدولة", max_length=64, blank=True)
    city = models.CharField("المدينة", max_length=64, blank=True)
    newsletter_opt_in = models.BooleanField("مشترك في النشرة", default=False)
    notify_on_comment_reply = models.BooleanField("إشعار عند الرد على تعليقي", default=True)

    class Meta:
        verbose_name = "ملف عضو"
        verbose_name_plural = "ملفات الأعضاء"

    def __str__(self):
        return f"ملف {self.user.full_name}"


class ClientProfile(TimeStampedModel):
    """جسر تحويل العضو إلى عميل.

    الربط بسجل `crm.Client` يُضاف في المرحلة الخامسة مع بناء تطبيق CRM.
    """

    user = models.OneToOneField(
        User, verbose_name="المستخدم", related_name="client_profile",
        on_delete=models.CASCADE,
    )
    company = models.CharField("الشركة", max_length=120, blank=True)
    country = models.CharField("الدولة", max_length=64, blank=True)
    city = models.CharField("المدينة", max_length=64, blank=True)
    whatsapp = models.CharField("واتساب", max_length=32, blank=True)
    notes = models.TextField("ملاحظات", blank=True)

    class Meta:
        verbose_name = "ملف عميل"
        verbose_name_plural = "ملفات العملاء"

    def __str__(self):
        return f"عميل: {self.user.full_name}"


class BaseToken(TimeStampedModel):
    """أساس مشترك لرموز التحقق واستعادة كلمة المرور."""

    token = models.CharField("الرمز", max_length=64, unique=True, db_index=True)
    expires_at = models.DateTimeField("تاريخ الانتهاء")
    used_at = models.DateTimeField("تاريخ الاستخدام", null=True, blank=True)
    ip_address = models.GenericIPAddressField("عنوان IP", null=True, blank=True)

    class Meta:
        abstract = True
        ordering = ["-created_at"]

    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at

    @property
    def is_valid(self) -> bool:
        return self.used_at is None and not self.is_expired

    def consume(self):
        self.used_at = timezone.now()
        self.save(update_fields=["used_at", "updated_at"])

    @classmethod
    def issue(cls, user, hours: int, ip: str | None = None):
        """يبطل الرموز السابقة غير المستخدمة ثم يصدر رمزًا جديدًا."""
        cls.objects.filter(user=user, used_at__isnull=True).update(
            used_at=timezone.now()
        )
        return cls.objects.create(
            user=user,
            token=generate_token(),
            expires_at=timezone.now() + timedelta(hours=hours),
            ip_address=ip,
        )


class EmailVerificationToken(BaseToken):
    user = models.ForeignKey(
        User, verbose_name="المستخدم", related_name="verification_tokens",
        on_delete=models.CASCADE,
    )

    class Meta(BaseToken.Meta):
        abstract = False
        verbose_name = "رمز تحقق بريد"
        verbose_name_plural = "رموز تحقق البريد"

    def __str__(self):
        return f"تحقق: {self.user.email}"


class PasswordResetToken(BaseToken):
    user = models.ForeignKey(
        User, verbose_name="المستخدم", related_name="password_reset_tokens",
        on_delete=models.CASCADE,
    )

    class Meta(BaseToken.Meta):
        abstract = False
        verbose_name = "رمز استعادة كلمة مرور"
        verbose_name_plural = "رموز استعادة كلمة المرور"

    def __str__(self):
        return f"استعادة: {self.user.email}"


class LoginAttempt(models.Model):
    """سجل محاولات الدخول — أساس القفل المتدرج ورصد الهجمات."""

    email = models.CharField("البريد", max_length=254, db_index=True)
    ip_address = models.GenericIPAddressField("عنوان IP", null=True, blank=True, db_index=True)
    success = models.BooleanField("ناجحة", default=False)
    user_agent = models.CharField("المتصفح", max_length=255, blank=True)
    created_at = models.DateTimeField("التاريخ", auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "محاولة دخول"
        verbose_name_plural = "محاولات الدخول"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["email", "-created_at"])]

    def __str__(self):
        state = "ناجحة" if self.success else "فاشلة"
        return f"{self.email} — {state}"

    @classmethod
    def record(cls, email: str, ip: str | None, success: bool, user_agent: str = ""):
        return cls.objects.create(
            email=(email or "").lower().strip()[:254],
            ip_address=ip,
            success=success,
            user_agent=(user_agent or "")[:255],
        )

    @classmethod
    def recent_failures(cls, email: str, ip: str | None) -> int:
        since = timezone.now() - timedelta(minutes=LOCKOUT_WINDOW_MINUTES)
        queryset = cls.objects.filter(
            success=False, created_at__gte=since, email=(email or "").lower().strip()
        )
        if ip:
            queryset = queryset.filter(ip_address=ip)
        return queryset.count()

    @classmethod
    def is_locked(cls, email: str, ip: str | None) -> bool:
        """قفل مؤقت بعد تجاوز عتبة المحاولات الفاشلة في النافذة الزمنية."""
        return cls.recent_failures(email, ip) >= LOCKOUT_THRESHOLD

    @classmethod
    def clear_failures(cls, email: str, ip: str | None):
        """يُستدعى بعد دخول ناجح كي لا تتراكم المحاولات القديمة."""
        since = timezone.now() - timedelta(minutes=LOCKOUT_WINDOW_MINUTES)
        queryset = cls.objects.filter(
            success=False, created_at__gte=since, email=(email or "").lower().strip()
        )
        if ip:
            queryset = queryset.filter(ip_address=ip)
        queryset.delete()

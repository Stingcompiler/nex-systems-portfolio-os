from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.core.models.base import TimeStampedModel
from apps.crm.enums import (
    BudgetRange,
    ContactStatus,
    FollowUpStatus,
    InteractionDirection,
    InteractionType,
    LeadSource,
    LeadStatus,
    Priority,
    RequestProjectType,
    RequestStatus,
    Timeline,
)


class ContactMessage(TimeStampedModel):
    """رسالة من نموذج التواصل العام."""

    name = models.CharField("الاسم", max_length=120, blank=True)
    email = models.EmailField("البريد", blank=True)
    phone = models.CharField("الهاتف", max_length=32, blank=True)
    subject = models.CharField("الموضوع", max_length=200, blank=True)
    message = models.TextField("الرسالة", blank=True)
    language = models.CharField("اللغة", max_length=5, default="ar")
    status = models.CharField(
        "الحالة", max_length=16, choices=ContactStatus.choices,
        default=ContactStatus.NEW, db_index=True,
    )
    ip_address = models.GenericIPAddressField("عنوان IP", null=True, blank=True)
    lead = models.ForeignKey(
        "crm.Lead", verbose_name="العميل المحتمل",
        related_name="contact_messages", null=True, blank=True, on_delete=models.SET_NULL,
    )

    class Meta:
        verbose_name = "رسالة تواصل"
        verbose_name_plural = "رسائل التواصل"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} — {self.subject or 'بلا موضوع'}"


class ProjectRequest(TimeStampedModel):
    """طلب مشروع من النموذج متعدد الخطوات.

    يُنشأ Lead تلقائيًا عند الإرسال النهائي (انظر signals). الحفظ الجزئي
    يبقي السجل بحالة draft مربوطًا بـ session_key حتى يُستكمل.
    """

    reference_code = models.CharField(
        "الرمز المرجعي", max_length=20, unique=True, blank=True, db_index=True
    )

    # الخطوة 1
    project_type = models.CharField(
        "نوع المشروع", max_length=20, choices=RequestProjectType.choices, blank=True
    )
    sector = models.CharField("القطاع", max_length=20, blank=True)

    # الخطوة 2 — المتطلبات في JSON مرن (أسئلة نعم/لا + عدد مستخدمين)
    requirements = models.JSONField("المتطلبات", default=dict, blank=True)
    description = models.TextField("وصف المشروع", blank=True)
    budget_range = models.CharField(
        "الميزانية", max_length=20, choices=BudgetRange.choices, blank=True
    )
    timeline = models.CharField(
        "المدة المتوقعة", max_length=20, choices=Timeline.choices, blank=True
    )

    # الخطوة 3 — التواصل
    name = models.CharField("الاسم", max_length=120, blank=True)
    email = models.EmailField("البريد", blank=True)
    phone = models.CharField("الهاتف", max_length=32, blank=True)
    whatsapp = models.CharField("واتساب", max_length=32, blank=True)
    company = models.CharField("الشركة", max_length=120, blank=True)
    country = models.CharField("الدولة", max_length=64, blank=True)
    city = models.CharField("المدينة", max_length=64, blank=True)
    preferred_language = models.CharField("اللغة المفضلة", max_length=5, default="ar")

    # النظام
    status = models.CharField(
        "الحالة", max_length=20, choices=RequestStatus.choices,
        default=RequestStatus.NEW, db_index=True,
    )
    source = models.CharField("المصدر", max_length=20, default=LeadSource.WEBSITE_FORM)
    session_key = models.CharField("مفتاح الجلسة", max_length=64, blank=True, db_index=True)
    ip_address = models.GenericIPAddressField("عنوان IP", null=True, blank=True)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name="المسؤول",
        related_name="assigned_requests", null=True, blank=True, on_delete=models.SET_NULL,
    )
    lead = models.ForeignKey(
        "crm.Lead", verbose_name="العميل المحتمل",
        related_name="requests", null=True, blank=True, on_delete=models.SET_NULL,
    )

    class Meta:
        verbose_name = "طلب مشروع"
        verbose_name_plural = "طلبات المشاريع"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "-created_at"])]

    def __str__(self):
        return f"{self.reference_code} — {self.get_project_type_display()}"

    def save(self, *args, **kwargs):
        if not self.reference_code:
            self.reference_code = self._generate_reference()
        super().save(*args, **kwargs)

    @staticmethod
    def _generate_reference() -> str:
        year = timezone.now().year
        prefix = f"REQ-{year}-"
        last = (
            ProjectRequest.objects.filter(reference_code__startswith=prefix)
            .order_by("-reference_code")
            .first()
        )
        sequence = 1
        if last and last.reference_code:
            try:
                sequence = int(last.reference_code.rsplit("-", 1)[1]) + 1
            except (ValueError, IndexError):
                sequence = ProjectRequest.objects.count() + 1
        return f"{prefix}{sequence:04d}"

    @property
    def is_complete(self) -> bool:
        return bool(self.email and self.status != RequestStatus.DRAFT)


class RequestAttachment(TimeStampedModel):
    request = models.ForeignKey(
        ProjectRequest, verbose_name="الطلب",
        related_name="attachments", on_delete=models.CASCADE,
    )
    file = models.FileField("الملف", upload_to="requests/%Y/%m/")
    original_name = models.CharField("الاسم الأصلي", max_length=255, blank=True)
    size = models.PositiveIntegerField("الحجم", default=0)
    mime_type = models.CharField("نوع المحتوى", max_length=120, blank=True)

    class Meta:
        verbose_name = "مرفق طلب"
        verbose_name_plural = "مرفقات الطلبات"

    def __str__(self):
        return self.original_name


class Lead(TimeStampedModel):
    """عميل محتمل — قلب نظام CRM."""

    name = models.CharField("الاسم", max_length=120, blank=True)
    company = models.CharField("الشركة", max_length=120, blank=True)
    email = models.EmailField("البريد", blank=True, db_index=True)
    phone = models.CharField("الهاتف", max_length=32, blank=True)
    whatsapp = models.CharField("واتساب", max_length=32, blank=True)
    country = models.CharField("الدولة", max_length=64, blank=True)
    city = models.CharField("المدينة", max_length=64, blank=True)

    source = models.CharField(
        "المصدر", max_length=20, choices=LeadSource.choices,
        default=LeadSource.WEBSITE_FORM, db_index=True,
    )
    services = models.ManyToManyField(
        "portfolio.Service", verbose_name="الخدمات المطلوبة",
        related_name="leads", blank=True,
    )
    expected_budget = models.CharField("الميزانية المتوقعة", max_length=80, blank=True)
    notes = models.TextField("ملاحظات", blank=True)

    first_contact_at = models.DateTimeField("أول تواصل", null=True, blank=True)
    last_contact_at = models.DateTimeField("آخر تواصل", null=True, blank=True)
    next_follow_up_at = models.DateTimeField("موعد المتابعة", null=True, blank=True, db_index=True)

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name="المسؤول",
        related_name="owned_leads", null=True, blank=True, on_delete=models.SET_NULL,
    )
    priority = models.CharField(
        "الأولوية", max_length=10, choices=Priority.choices, default=Priority.MEDIUM
    )
    status = models.CharField(
        "الحالة", max_length=20, choices=LeadStatus.choices,
        default=LeadStatus.NEW, db_index=True,
    )
    member = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name="العضو المرتبط",
        related_name="member_leads", null=True, blank=True, on_delete=models.SET_NULL,
    )

    class Meta:
        verbose_name = "عميل محتمل"
        verbose_name_plural = "العملاء المحتملون"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "priority", "-created_at"])]
        permissions = [("export_leads", "تصدير العملاء المحتملين")]

    def __str__(self):
        return f"{self.name or 'بلا اسم'} ({self.get_status_display()})"

    def touch_contact(self):
        """يحدّث تواريخ التواصل — يُستدعى عند تسجيل تفاعل."""
        now = timezone.now()
        if not self.first_contact_at:
            self.first_contact_at = now
        self.last_contact_at = now
        self.save(update_fields=["first_contact_at", "last_contact_at", "updated_at"])


class Client(TimeStampedModel):
    """عميل متعاقد — يُنشأ من تحويل Lead مقبول."""

    lead = models.OneToOneField(
        Lead, verbose_name="العميل المحتمل الأصلي",
        related_name="client", null=True, blank=True, on_delete=models.SET_NULL,
    )
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, verbose_name="حساب المستخدم",
        related_name="crm_client", null=True, blank=True, on_delete=models.SET_NULL,
    )
    name = models.CharField("الاسم", max_length=120, blank=True)
    company = models.CharField("الشركة", max_length=120, blank=True)
    email = models.EmailField("البريد", blank=True)
    phone = models.CharField("الهاتف", max_length=32, blank=True)
    whatsapp = models.CharField("واتساب", max_length=32, blank=True)
    country = models.CharField("الدولة", max_length=64, blank=True)
    city = models.CharField("المدينة", max_length=64, blank=True)
    notes = models.TextField("ملاحظات", blank=True)
    projects = models.ManyToManyField(
        "portfolio.Project", verbose_name="المشاريع",
        related_name="clients", blank=True,
    )
    client_since = models.DateField("عميل منذ", default=timezone.now)
    is_active = models.BooleanField("نشط", default=True, db_index=True)

    class Meta:
        verbose_name = "عميل"
        verbose_name_plural = "العملاء"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name or 'بلا اسم'} — {self.company or 'فرد'}"


class CrmNote(TimeStampedModel):
    """ملاحظة على عميل محتمل أو عميل."""

    lead = models.ForeignKey(
        Lead, related_name="crm_notes", null=True, blank=True, on_delete=models.CASCADE
    )
    client = models.ForeignKey(
        Client, related_name="crm_notes", null=True, blank=True, on_delete=models.CASCADE
    )
    content = models.TextField("الملاحظة", blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="crm_notes",
        null=True, blank=True, on_delete=models.SET_NULL,
    )

    class Meta:
        verbose_name = "ملاحظة"
        verbose_name_plural = "الملاحظات"
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                name="crmnote_target_required",
                condition=models.Q(lead__isnull=False) | models.Q(client__isnull=False),
            )
        ]

    def __str__(self):
        return self.content[:60]


class Interaction(TimeStampedModel):
    """تسجيل تواصل مع عميل محتمل أو عميل."""

    lead = models.ForeignKey(
        Lead, related_name="interactions", null=True, blank=True, on_delete=models.CASCADE
    )
    client = models.ForeignKey(
        Client, related_name="interactions", null=True, blank=True, on_delete=models.CASCADE
    )
    type = models.CharField("النوع", max_length=12, choices=InteractionType.choices, blank=True)
    direction = models.CharField(
        "الاتجاه", max_length=10, choices=InteractionDirection.choices,
        default=InteractionDirection.OUTBOUND,
    )
    summary = models.TextField("الملخص", blank=True)
    occurred_at = models.DateTimeField("وقت التواصل", default=timezone.now)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="interactions",
        null=True, blank=True, on_delete=models.SET_NULL,
    )

    class Meta:
        verbose_name = "تواصل"
        verbose_name_plural = "سجل التواصل"
        ordering = ["-occurred_at"]
        constraints = [
            models.CheckConstraint(
                name="interaction_target_required",
                condition=models.Q(lead__isnull=False) | models.Q(client__isnull=False),
            )
        ]

    def __str__(self):
        return f"{self.get_type_display()} — {self.summary[:40]}"


class FollowUp(TimeStampedModel):
    """موعد متابعة مجدول."""

    lead = models.ForeignKey(
        Lead, related_name="follow_ups", null=True, blank=True, on_delete=models.CASCADE
    )
    client = models.ForeignKey(
        Client, related_name="follow_ups", null=True, blank=True, on_delete=models.CASCADE
    )
    title = models.CharField("العنوان", max_length=200, blank=True)
    due_at = models.DateTimeField("الموعد", null=True, blank=True, db_index=True)
    notes = models.TextField("ملاحظات", blank=True)
    status = models.CharField(
        "الحالة", max_length=10, choices=FollowUpStatus.choices,
        default=FollowUpStatus.PENDING, db_index=True,
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="follow_ups",
        null=True, blank=True, on_delete=models.SET_NULL,
    )
    reminder_sent = models.BooleanField("أُرسل التذكير", default=False)

    class Meta:
        verbose_name = "متابعة"
        verbose_name_plural = "المتابعات"
        ordering = ["due_at"]
        constraints = [
            models.CheckConstraint(
                name="followup_target_required",
                condition=models.Q(lead__isnull=False) | models.Q(client__isnull=False),
            )
        ]

    def __str__(self):
        due = f"{self.due_at:%Y-%m-%d}" if self.due_at else "بلا موعد"
        return f"{self.title or 'متابعة'} — {due}"

    @property
    def is_overdue(self) -> bool:
        return (
            self.status == FollowUpStatus.PENDING
            and self.due_at is not None
            and self.due_at < timezone.now()
        )


class CrmAttachment(TimeStampedModel):
    lead = models.ForeignKey(
        Lead, related_name="attachments", null=True, blank=True, on_delete=models.CASCADE
    )
    client = models.ForeignKey(
        Client, related_name="attachments", null=True, blank=True, on_delete=models.CASCADE
    )
    file = models.FileField("الملف", upload_to="crm/%Y/%m/")
    name = models.CharField("الاسم", max_length=255, blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="crm_attachments",
        null=True, blank=True, on_delete=models.SET_NULL,
    )

    class Meta:
        verbose_name = "مرفق"
        verbose_name_plural = "المرفقات"
        ordering = ["-created_at"]

    def __str__(self):
        return self.name

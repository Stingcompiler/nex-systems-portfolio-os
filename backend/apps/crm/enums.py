"""قوائم ثابتة لإدارة العملاء."""

from django.db import models


class LeadStatus(models.TextChoices):
    NEW = "new", "جديد"
    CONTACTED = "contacted", "تم التواصل"
    WAITING = "waiting", "بانتظار الرد"
    NEGOTIATING = "negotiating", "تفاوض"
    PROPOSAL_SENT = "proposal_sent", "أُرسل العرض"
    ACCEPTED = "accepted", "مقبول"
    IN_PROGRESS = "in_progress", "قيد التنفيذ"
    COMPLETED = "completed", "مكتمل"
    LONG_TERM = "long_term", "عميل دائم"
    REJECTED = "rejected", "مرفوض"
    ARCHIVED = "archived", "مؤرشف"


#: الحالات التي تعني أن التعامل انتهى — تُستبعد من لوحة Kanban النشطة
CLOSED_LEAD_STATUSES = frozenset(
    {LeadStatus.COMPLETED, LeadStatus.LONG_TERM, LeadStatus.REJECTED, LeadStatus.ARCHIVED}
)


class RequestStatus(models.TextChoices):
    NEW = "new", "جديد"
    REVIEWED = "reviewed", "تمت المراجعة"
    CONTACTED = "contacted", "تم التواصل"
    MEETING_SCHEDULED = "meeting_scheduled", "موعد محدد"
    PROPOSAL_SENT = "proposal_sent", "أُرسل العرض"
    ACCEPTED = "accepted", "مقبول"
    IN_PROGRESS = "in_progress", "قيد التنفيذ"
    COMPLETED = "completed", "مكتمل"
    REJECTED = "rejected", "مرفوض"
    DRAFT = "draft", "غير مكتمل"


class RequestProjectType(models.TextChoices):
    WEBSITE = "website", "موقع"
    MOBILE = "mobile", "تطبيق موبايل"
    DESKTOP = "desktop", "تطبيق سطح مكتب"
    SYSTEM = "system", "نظام إداري"
    EXISTING = "existing", "تطوير نظام قائم"
    API = "api", "واجهة برمجية"
    HOSTING = "hosting", "استضافة"
    CONSULTING = "consulting", "استشارة وتحليل"


class Priority(models.TextChoices):
    LOW = "low", "منخفضة"
    MEDIUM = "medium", "متوسطة"
    HIGH = "high", "عالية"
    URGENT = "urgent", "عاجلة"


class LeadSource(models.TextChoices):
    WEBSITE_FORM = "website_form", "نموذج طلب مشروع"
    CONTACT_FORM = "contact_form", "نموذج تواصل"
    WHATSAPP = "whatsapp", "واتساب"
    REFERRAL = "referral", "توصية"
    SOCIAL = "social", "وسائل التواصل"
    DIRECT = "direct", "مباشر"
    OTHER = "other", "أخرى"


class ContactStatus(models.TextChoices):
    NEW = "new", "جديدة"
    READ = "read", "مقروءة"
    REPLIED = "replied", "تم الرد"
    ARCHIVED = "archived", "مؤرشفة"


class InteractionType(models.TextChoices):
    CALL = "call", "مكالمة"
    WHATSAPP = "whatsapp", "واتساب"
    EMAIL = "email", "بريد"
    MEETING = "meeting", "اجتماع"
    OTHER = "other", "أخرى"


class InteractionDirection(models.TextChoices):
    INBOUND = "inbound", "وارد"
    OUTBOUND = "outbound", "صادر"


class FollowUpStatus(models.TextChoices):
    PENDING = "pending", "معلّقة"
    DONE = "done", "منجزة"
    MISSED = "missed", "فائتة"


class BudgetRange(models.TextChoices):
    UNDER_500 = "under_500", "أقل من 500$"
    R_500_2K = "500_2000", "500$ – 2000$"
    R_2K_5K = "2000_5000", "2000$ – 5000$"
    R_5K_10K = "5000_10000", "5000$ – 10000$"
    OVER_10K = "over_10000", "أكثر من 10000$"
    UNSURE = "unsure", "غير محدد"


class Timeline(models.TextChoices):
    URGENT = "urgent", "عاجل (أقل من شهر)"
    SHORT = "short", "1 – 3 أشهر"
    MEDIUM = "medium", "3 – 6 أشهر"
    FLEXIBLE = "flexible", "مرن"

"""ملخص لوحة التحكم وسجل التدقيق."""

from datetime import timedelta

from django.db.models import Count, Q
from django.db.models.functions import TruncDate
from django.utils import timezone
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import serializers, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.comments.models import Comment, CommentReport
from apps.core.models.content import FAQ, ProcessStep, Stat
from apps.core.models.settings import SEOSettings, SiteSettings, SocialLink
from apps.core.models.system import AuditLog
from apps.core.pagination import LargePagination
from apps.core.permissions import HasDashboardPermission, IsSuperAdmin
from apps.crm.enums import ContactStatus, FollowUpStatus, RequestStatus
from apps.crm.models import Client, ContactMessage, FollowUp, ProjectRequest
from apps.media_library.models import MediaFile
from apps.notifications.models import Notification
from apps.portfolio.models import (
    CaseStudy,
    Certification,
    Education,
    Experience,
    Project,
    Service,
    Technology,
    Testimonial,
)


class ChecklistItemSerializer(serializers.Serializer):
    key = serializers.CharField()
    label = serializers.CharField()
    done = serializers.BooleanField()
    hint = serializers.CharField(allow_blank=True)


class DashboardSummarySerializer(serializers.Serializer):
    content = serializers.DictField()
    people = serializers.DictField()
    system = serializers.DictField()
    activity = serializers.DictField()
    checklist = ChecklistItemSerializer(many=True)
    completion = serializers.IntegerField()


def build_checklist() -> list[dict]:
    """ما ينقص الموقع فعلًا، مشتقًا من البيانات لا من قائمة ثابتة.

    الأقسام الفارغة تختفي من الموقع تلقائيًا، فبدون هذه القائمة قد يمر
    شهر دون أن يلاحظ صاحب الموقع أن قسمًا كاملًا لا يظهر.
    """
    settings_record = SiteSettings.load()
    seo = SEOSettings.load()

    def item(key: str, label: str, done: bool, hint: str = "") -> dict:
        return {"key": key, "label": label, "done": bool(done), "hint": hint}

    return [
        item(
            "contact",
            "بيانات التواصل",
            settings_record.email and settings_record.phone and settings_record.whatsapp,
            "البريد والهاتف ورقم واتساب — زر واتساب لا يظهر بدون الرقم",
        ),
        item(
            "branding",
            "الشعار وأيقونة الموقع",
            settings_record.logo_light_id and settings_record.favicon_id,
            "ارفعها من مكتبة الوسائط ثم اخترها في الإعدادات",
        ),
        item(
            "owner",
            "نبذتك وصورتك",
            settings_record.owner_bio_ar and settings_record.owner_photo_id,
            "قسم «نبذة» في الرئيسية مخفي حتى تُملأ النبذة",
        ),
        item(
            "cv",
            "السيرة الذاتية",
            settings_record.cv_ar_id or settings_record.cv_en_id,
            "زر التحميل في صفحة «نبذة» مخفي بدونها",
        ),
        item("stats", "الإحصائيات", Stat.objects.filter(is_active=True).exists(),
             "أرقام حقيقية فقط — قسم الإحصائيات مخفي حتى تُضاف"),
        item("testimonials", "شهادات العملاء",
             Testimonial.objects.filter(is_published=True).exists(),
             "أضف رابطًا يثبت الشهادة لرفع مصداقيتها"),
        item("resume", "الخبرات والمؤهلات",
             Experience.objects.exists() or Education.objects.exists()
             or Certification.objects.exists(),
             "تظهر في صفحة «نبذة»"),
        item("covers", "صور أغلفة المشاريع",
             not Project.objects.filter(is_published=True, cover_image__isnull=True).exists(),
             "المشروع بلا غلاف يظهر بمربع فارغ"),
        item("case_studies", "دراسات الحالة",
             CaseStudy.objects.filter(is_published=True).exists(),
             "أقوى دليل على قدرتك — ابدأ بمشروع واحد"),
        item("social", "روابط التواصل الاجتماعي",
             SocialLink.objects.filter(is_active=True).exists()),
        item("faq", "تفعيل الأسئلة الشائعة",
             FAQ.objects.filter(is_active=True).exists(),
             "راجع الإجابات المزروعة أولًا فهي التزامات تجارية"),
        item("seo", "إعدادات SEO الافتراضية",
             seo.default_seo_title_ar and seo.default_seo_description_ar),
        item("drafts", "استكمال المسودات",
             not Service.objects.filter(is_published=False).exists(),
             f"{Service.objects.filter(is_published=False).count()} صفحة بانتظار محتواها"),
    ]


def build_activity() -> dict:
    """مؤشرات النشاط الحديثة: طلبات، عملاء، رسائل، تعليقات، سلسلة أسبوعية، ومتابعات اليوم."""
    now = timezone.now()
    last30 = now - timedelta(days=30)
    prev30 = now - timedelta(days=60)
    today = timezone.localdate()

    # الطلبات الجديدة خلال 30 يومًا مقابل الثلاثين السابقة
    cur_requests = ProjectRequest.objects.filter(created_at__gte=last30).count()
    prev_requests = ProjectRequest.objects.filter(
        created_at__gte=prev30, created_at__lt=last30
    ).count()
    if prev_requests:
        req_delta = round((cur_requests - prev_requests) * 100 / prev_requests)
    else:
        req_delta = 100 if cur_requests else 0

    # الطلبات غير المعالَجة (بحاجة انتباه) — للشارة الجانبية
    pending_requests = ProjectRequest.objects.filter(status=RequestStatus.NEW).count()

    active_clients = Client.objects.filter(is_active=True).count()
    new_clients = Client.objects.filter(created_at__gte=last30).count()

    unanswered_qs = ContactMessage.objects.filter(status=ContactStatus.NEW)
    unanswered = unanswered_qs.count()
    oldest = unanswered_qs.order_by("created_at").values_list("created_at", flat=True).first()
    oldest_days = (now - oldest).days if oldest else 0

    pending_comments = Comment.objects.filter(status=Comment.Status.PENDING).count()
    reported = CommentReport.objects.filter(status=CommentReport.Status.OPEN).count()

    # سلسلة الطلبات الأسبوعية (آخر 7 أيام) — TruncDate يعمل على SQLite وPostgreSQL معًا
    week_start = today - timedelta(days=6)
    per_day = {
        row["day"]: row["c"]
        for row in ProjectRequest.objects.filter(created_at__date__gte=week_start)
        .annotate(day=TruncDate("created_at"))
        .values("day")
        .annotate(c=Count("id"))
    }
    weekly = [
        {
            "date": (week_start + timedelta(days=index)).isoformat(),
            "value": per_day.get(week_start + timedelta(days=index), 0),
        }
        for index in range(7)
    ]

    follow_ups = []
    for follow_up in (
        FollowUp.objects.filter(status=FollowUpStatus.PENDING, due_at__date=today)
        .select_related("lead", "client")
        .order_by("due_at")[:6]
    ):
        target = follow_up.lead or follow_up.client
        follow_ups.append(
            {
                "id": follow_up.id,
                "title": follow_up.title,
                "target": getattr(target, "name", "") if target else "",
                "due_at": follow_up.due_at.isoformat() if follow_up.due_at else None,
            }
        )

    return {
        "new_requests": cur_requests,
        "new_requests_delta_pct": req_delta,
        "pending_requests": pending_requests,
        "active_clients": active_clients,
        "new_clients_month": new_clients,
        "unanswered_messages": unanswered,
        "unanswered_oldest_days": oldest_days,
        "pending_comments": pending_comments,
        "reported_comments": reported,
        "weekly_requests": weekly,
        "follow_ups_today": follow_ups,
    }


class DashboardSummaryView(APIView):
    """بطاقات الصفحة الأولى في لوحة التحكم."""

    permission_classes = [HasDashboardPermission]
    required_permissions: list[str] = []

    @extend_schema(summary="ملخص لوحة التحكم", responses={200: DashboardSummarySerializer})
    def get(self, request):
        services = Service.objects.aggregate(
            total=Count("id"),
            published=Count("id", filter=Q(is_published=True)),
            solutions=Count("id", filter=Q(kind="solution")),
        )
        projects = Project.objects.aggregate(
            total=Count("id"),
            published=Count("id", filter=Q(is_published=True)),
            featured=Count("id", filter=Q(is_featured=True)),
        )

        checklist = build_checklist()
        completed = sum(1 for entry in checklist if entry["done"])

        return Response(
            {
                "content": {
                    "services_total": services["total"],
                    "services_published": services["published"],
                    "solutions_total": services["solutions"],
                    "projects_total": projects["total"],
                    "projects_published": projects["published"],
                    "projects_featured": projects["featured"],
                    "case_studies": CaseStudy.objects.count(),
                    "case_studies_published": CaseStudy.objects.filter(
                        is_published=True
                    ).count(),
                    "technologies": Technology.objects.filter(is_active=True).count(),
                    "testimonials": Testimonial.objects.count(),
                    "process_steps": ProcessStep.objects.filter(is_active=True).count(),
                    "media_files": MediaFile.objects.count(),
                },
                "people": {
                    "members": User.objects.filter(role="member").count(),
                    "staff": User.objects.filter(is_staff=True).count(),
                    "unverified": User.objects.filter(is_email_verified=False).count(),
                },
                "system": {
                    "unread_notifications": Notification.visible_to(request.user)
                    .filter(is_read=False)
                    .count(),
                    "audit_events_today": AuditLog.objects.filter(
                        created_at__date=timezone.localdate()
                    ).count(),
                },
                "activity": build_activity(),
                "checklist": checklist,
                "completion": round(completed * 100 / len(checklist)) if checklist else 0,
            }
        )


class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.full_name", read_only=True, default="")
    action_display = serializers.CharField(source="get_action_display", read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            "id", "user", "user_name", "action", "action_display",
            "model_name", "object_id", "object_repr", "changes",
            "ip_address", "created_at",
        ]
        read_only_fields = fields


@extend_schema_view(
    list=extend_schema(summary="سجل التدقيق"),
    retrieve=extend_schema(summary="تفاصيل حدث"),
)
class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """سجل التدقيق للقراءة فقط — لا يُعدَّل ولا يُحذف من الواجهة."""

    queryset = AuditLog.objects.select_related("user").all()
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    pagination_class = LargePagination
    filterset_fields = ["action", "model_name", "user"]
    search_fields = ["object_repr", "model_name"]
    ordering_fields = ["created_at"]

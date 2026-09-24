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
from apps.analytics.models import PageView
from apps.blog.models import Post
from apps.comments.models import Comment, CommentReport
from apps.core.models.content import FAQ, ProcessStep, Stat
from apps.core.models.settings import SEOSettings, SiteSettings, SocialLink
from apps.core.models.system import AuditLog
from apps.core.pagination import LargePagination
from apps.core.permissions import HasDashboardPermission, IsSuperAdmin
from apps.crm.enums import ContactStatus, FollowUpStatus, RequestStatus
from apps.crm.models import Client, ContactMessage, FollowUp, ProjectRequest
from apps.media_library.models import MediaFile
from apps.newsletter.models import Campaign, Subscriber
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
    """الأقسام تختلف بحسب صلاحيات المستخدم — كل قسم غائب لمن لا يملك صلاحيته.

    `sections` تسرد المفاتيح الحاضرة بالترتيب الذي تُعرض به.
    """

    role = serializers.CharField()
    role_display = serializers.CharField()
    sections = serializers.ListField(child=serializers.CharField())
    crm = serializers.DictField(required=False)
    community = serializers.DictField(required=False)
    my_posts = serializers.DictField(required=False)
    marketing = serializers.DictField(required=False)
    analytics = serializers.DictField(required=False)
    site = serializers.DictField(required=False)
    system = serializers.DictField(required=False)


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


def build_crm() -> dict:
    """مؤشرات إدارة العملاء: طلبات، عملاء، رسائل، سلسلة أسبوعية، ومتابعات اليوم."""
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
        "weekly_requests": weekly,
        "follow_ups_today": follow_ups,
    }


def build_community() -> dict:
    return {
        "pending_comments": Comment.objects.filter(status=Comment.Status.PENDING).count(),
        "reported_comments": CommentReport.objects.filter(
            status=CommentReport.Status.OPEN
        ).count(),
    }


def build_my_posts(user) -> dict:
    """مقالات المستخدم نفسه — ما يحتاجه المحرر كل يوم."""
    mine = Post.objects.filter(author=user)
    counts = dict(
        mine.values_list("status").annotate(c=Count("id")).values_list("status", "c")
    )
    recent = [
        {
            "id": post.id,
            "slug": post.slug,
            "title": post.title_ar or post.title_en or "بلا عنوان",
            "status": post.status,
            "status_display": post.get_status_display(),
            "updated_at": post.updated_at.isoformat(),
        }
        for post in mine.exclude(status=Post.Status.ARCHIVED).order_by("-updated_at")[:5]
    ]
    return {
        "drafts": counts.get(Post.Status.DRAFT, 0),
        "in_review": counts.get(Post.Status.IN_REVIEW, 0),
        "scheduled": counts.get(Post.Status.SCHEDULED, 0),
        "published": counts.get(Post.Status.PUBLISHED, 0),
        "recent": recent,
    }


def build_marketing() -> dict:
    now = timezone.now()
    last30 = now - timedelta(days=30)
    subscribers = Subscriber.objects.aggregate(
        active=Count("id", filter=Q(status=Subscriber.Status.ACTIVE)),
        pending=Count("id", filter=Q(status=Subscriber.Status.PENDING)),
        new_month=Count("id", filter=Q(created_at__gte=last30)),
        unsubscribed_month=Count(
            "id",
            filter=Q(status=Subscriber.Status.UNSUBSCRIBED, updated_at__gte=last30),
        ),
    )
    campaigns = Campaign.objects.aggregate(
        drafts=Count("id", filter=Q(status=Campaign.Status.DRAFT)),
        scheduled=Count("id", filter=Q(status=Campaign.Status.SCHEDULED)),
    )
    last = (
        Campaign.objects.filter(status=Campaign.Status.SENT)
        .order_by("-sent_at")
        .values("id", "subject_ar", "sent_at", "sent_count", "open_count", "click_count")
        .first()
    )
    if last:
        last = {**last, "sent_at": last["sent_at"].isoformat() if last["sent_at"] else None}
    return {**subscribers, **campaigns, "last_campaign": last}


def build_analytics() -> dict:
    now = timezone.now()
    last30 = now - timedelta(days=30)
    prev30 = now - timedelta(days=60)
    current = PageView.objects.filter(created_at__gte=last30)
    views = current.count()
    previous = PageView.objects.filter(created_at__gte=prev30, created_at__lt=last30).count()
    return {
        "views_month": views,
        "visitors_month": current.exclude(session_hash="")
        .values("session_hash")
        .distinct()
        .count(),
        "views_delta_pct": round((views - previous) * 100 / previous) if previous else 0,
    }


class DashboardSummaryView(APIView):
    """بطاقات الصفحة الأولى في لوحة التحكم."""

    permission_classes = [HasDashboardPermission]
    required_permissions: list[str] = []

    @extend_schema(summary="ملخص لوحة التحكم", responses={200: DashboardSummarySerializer})
    def get(self, request):
        user = request.user
        is_super = user.is_superuser or user.role == "super_admin"
        payload: dict = {
            "role": user.role or "",
            "role_display": "مدير عام" if user.is_superuser and not user.role
            else user.get_role_display(),
            "sections": [],
        }

        # كل قسم خلف صلاحية النموذج الذي يعرضه: المحرر لم يعد يرى طلبات
        # العملاء ورسائلهم، ومدير التسويق لا يرى سجل التدقيق وأعداد الموظفين
        def add(key: str, allowed: bool, builder):
            if allowed:
                payload[key] = builder()
                payload["sections"].append(key)

        add("crm", user.has_perm("crm.view_projectrequest"), build_crm)
        add("my_posts", user.has_perm("blog.change_post"), lambda: build_my_posts(user))
        add("community", user.has_perm("comments.view_comment"), build_community)
        add("marketing", user.has_perm("newsletter.view_subscriber"), build_marketing)
        add("analytics", user.has_perm("core.view_analytics"), build_analytics)
        add("site", user.has_perm("core.change_sitesettings"), build_site)
        add("system", is_super, lambda: build_system(user))

        return Response(payload)


def build_site() -> dict:
    services = Service.objects.aggregate(
        total=Count("id"),
        published=Count("id", filter=Q(is_published=True)),
    )
    projects = Project.objects.aggregate(
        total=Count("id"),
        published=Count("id", filter=Q(is_published=True)),
    )
    checklist = build_checklist()
    completed = sum(1 for entry in checklist if entry["done"])
    return {
        "services_total": services["total"],
        "services_published": services["published"],
        "projects_total": projects["total"],
        "projects_published": projects["published"],
        "case_studies_published": CaseStudy.objects.filter(is_published=True).count(),
        "media_files": MediaFile.objects.count(),
        "checklist": checklist,
        "completion": round(completed * 100 / len(checklist)) if checklist else 0,
    }


def build_system(user) -> dict:
    return {
        "members": User.objects.filter(role="member").count(),
        "staff": User.objects.filter(is_staff=True).count(),
        "unverified": User.objects.filter(is_email_verified=False).count(),
        "unread_notifications": Notification.visible_to(user).filter(is_read=False).count(),
        "audit_events_today": AuditLog.objects.filter(
            created_at__date=timezone.localdate()
        ).count(),
    }


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
